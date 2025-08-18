import { EventEmitter } from 'events';
import { webRTCProxyService } from '../webrtc-proxy';

export interface WebRTCConfig {
  apiKey: string;
  model: string;
  voice: string;
  instructions: string;
  functions?: any[];
}

export interface AudioData {
  audio: string; // base64 encoded audio
  type: 'input_audio_buffer.append' | 'input_audio_buffer.commit';
}

// Enhanced WebRTC Service with authentication proxy support
export class WebRTCService extends EventEmitter {
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private connectionState: string = 'disconnected';
  private config: WebRTCConfig | null = null;
  private proxyEndpoint: string;

  constructor(proxyEndpoint?: string) {
    super();
    // Use backend proxy to handle OpenAI authentication
    this.proxyEndpoint = proxyEndpoint || 'ws://localhost:3000/api/v16/webrtc-proxy';
  }

  async connect(config: WebRTCConfig): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      throw new Error('Already connected or connecting');
    }

    this.isConnecting = true;
    this.config = config;
    
    try {
      // First setup the proxy with our configuration
      await webRTCProxyService.setupProxy({
        apiKey: config.apiKey,
        session: {
          modalities: ['text', 'audio'],
          instructions: config.instructions,
          voice: config.voice,
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          tools: config.functions || [],
        }
      });

      // Then connect through backend proxy WebSocket
      await this.connectThroughProxy(config);

      this.isConnected = true;
      this.isConnecting = false;
      this.connectionState = 'connected';
      this.emit('connected');
    } catch (error) {
      this.isConnecting = false;
      this.connectionState = 'failed';
      this.emit('error', error);
      throw error;
    }
  }

  private async connectThroughProxy(config: WebRTCConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect to backend proxy WebSocket endpoint
        // The backend will handle OpenAI authentication
        this.websocket = new WebSocket(this.proxyEndpoint);

        this.websocket.onopen = () => {
          // Send session configuration through proxy
          this.sendSessionConfig(config);
          resolve();
        };

        this.websocket.onerror = (error) => {
          console.error('[webrtc_service] WebSocket connection error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        this.websocket.onmessage = (event) => {
          this.handleWebSocketMessage(event.data);
        };

        this.websocket.onclose = (event) => {
          console.log('[webrtc_service] WebSocket connection closed:', event.code, event.reason);
          this.isConnected = false;
          this.connectionState = 'disconnected';
          this.emit('disconnected');
        };
      } catch (error) {
        console.error('[webrtc_service] WebSocket connection setup error:', error);
        reject(error);
      }
    });
  }

  private sendSessionConfig(config: WebRTCConfig): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.error('[webrtc_service] Cannot send session config - WebSocket not open');
      return;
    }

    console.log('[webrtc_service] Sending session configuration');

    // Send authentication and session configuration through proxy
    this.websocket.send(JSON.stringify({
      type: 'session.update',
      apiKey: config.apiKey, // Proxy will use this for OpenAI auth
      session: {
        modalities: ['text', 'audio'],
        instructions: config.instructions,
        voice: config.voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200,
        },
        tools: config.functions || [],
      },
    }));
  }

  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // Log important messages for debugging
      if (message.type === 'error') {
        console.error('[webrtc_service] Error from server:', message.error);
      } else if (message.type === 'response.done') {
        console.log('[webrtc_service] Response completed');
      } else if (message.type === 'session.updated') {
        console.log('[webrtc_service] Session updated successfully');
      }

      this.emit('message', message);

      switch (message.type) {
        case 'response.audio.delta':
          this.emit('audioData', message.delta);
          break;
        case 'response.audio_transcript.delta':
          this.emit('audioTranscript', message.delta);
          break;
        case 'conversation.item.input_audio_transcription.completed':
          this.emit('transcription', message.transcript);
          break;
        case 'response.text.delta':
          this.emit('textDelta', message.delta);
          break;
        case 'response.function_call_arguments.delta':
          this.emit('functionCall', message);
          break;
        case 'response.function_call_arguments.done':
          this.emit('functionCallComplete', message);
          break;
        case 'input_audio_buffer.speech_started':
          this.emit('speechStarted');
          break;
        case 'input_audio_buffer.speech_stopped':  
          this.emit('speechStopped');
          break;
        case 'response.audio.done':
          this.emit('audioComplete');
          break;
        case 'response.done':
          this.emit('responseComplete');
          break;
        case 'error':
          this.emit('error', new Error(message.error?.message || 'Unknown error'));
          break;
      }
    } catch (error) {
      console.error('[webrtc_service] Error parsing WebSocket message:', error);
      this.emit('error', new Error('Failed to parse server message'));
    }
  }

  public sendAudio(audioData: ArrayBuffer): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[webrtc_service] Cannot send audio - WebSocket not open');
      return;
    }

    try {
      this.websocket.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: this.arrayBufferToBase64(audioData),
      }));
    } catch (error) {
      console.error('[webrtc_service] Error sending audio data:', error);
      this.emit('error', new Error('Failed to send audio data'));
    }
  }

  public commitAudioBuffer(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[webrtc_service] Cannot commit audio buffer - WebSocket not open');
      return;
    }

    this.websocket.send(JSON.stringify({
      type: 'input_audio_buffer.commit',
    }));
  }

  public sendText(text: string): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[webrtc_service] Cannot send text - WebSocket not open');
      return;
    }

    console.log('[webrtc_service] Sending text message:', text);

    try {
      // Create conversation item
      this.websocket.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      }));

      // Generate response
      this.websocket.send(JSON.stringify({
        type: 'response.create',
      }));
    } catch (error) {
      console.error('[webrtc_service] Error sending text:', error);
      this.emit('error', new Error('Failed to send text message'));
    }
  }

  public cancelResponse(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(JSON.stringify({
      type: 'response.cancel',
    }));
  }

  public setMuted(muted: boolean): void {
    console.log('[webrtc_service] Mute state changed:', muted);
    this.emit('muteChanged', muted);
  }

  public disconnect(): void {
    console.log('[webrtc_service] Disconnecting...');
    
    if (this.websocket) {
      this.websocket.close(1000, 'Client disconnect');
      this.websocket = null;
    }

    this.isConnected = false;
    this.connectionState = 'disconnected';
    this.config = null;
    this.emit('disconnected');
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    try {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (error) {
      console.error('[webrtc_service] Error converting audio to base64:', error);
      throw new Error('Failed to encode audio data');
    }
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  public isConnectionOpen(): boolean {
    return this.isConnected && this.websocket?.readyState === WebSocket.OPEN;
  }

  // Audio stream simulation methods for development
  public startLocalAudioStream(): void {
    console.log('[webrtc_service] Starting local audio stream simulation');
    this.emit('localStream', { id: 'mock-local-stream' });
  }

  public getLocalAudioLevel(): number {
    // Mock audio level between 0-1 for visualization
    return Math.random() * 0.5;
  }

  // Function calling support
  public executeFunctionCall(name: string, args: string): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: Date.now().toString(),
        output: args,
      },
    }));
  }

  // Reconnection support
  public async reconnect(): Promise<void> {
    if (this.config) {
      console.log('[webrtc_service] Attempting to reconnect...');
      this.disconnect();
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return this.connect(this.config);
    }
    throw new Error('No configuration available for reconnection');
  }
}

export default WebRTCService;