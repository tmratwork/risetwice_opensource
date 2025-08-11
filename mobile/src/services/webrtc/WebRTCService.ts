import { EventEmitter } from 'events';

export interface WebRTCConfig {
  apiKey: string;
  model: string;
  voice: string;
  instructions: string;
  functions?: any[];
}

// Simplified WebRTC Service for mobile compatibility
// This is a basic implementation that can be extended with actual WebRTC functionality
export class WebRTCService extends EventEmitter {
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private connectionState: string = 'disconnected';

  constructor() {
    super();
  }

  async connect(config: WebRTCConfig): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      throw new Error('Already connected or connecting');
    }

    this.isConnecting = true;
    
    try {
      // For now, we'll focus on WebSocket connection to OpenAI
      // WebRTC peer connection can be added later with proper mobile setup
      await this.connectWebSocket(config);

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

  private async connectWebSocket(config: WebRTCConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      // IMPORTANT: React Native WebSocket limitations
      // - Cannot send headers (like Authorization) in constructor
      // - For production, you should:
      //   1. Use a backend proxy to handle OpenAI authentication
      //   2. Or implement token-based auth through WebSocket messages
      //   3. Or use a different WebSocket library that supports headers
      
      const wsUrl = 'wss://api.openai.com/v1/realtime?model=' + config.model;
      
      try {
        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
          // Send authentication and session config
          this.sendAuthAndSessionConfig(config);
          resolve();
        };

        this.websocket.onerror = () => {
          reject(new Error('WebSocket connection failed'));
        };

        this.websocket.onmessage = (event) => {
          this.handleWebSocketMessage(event.data);
        };

        this.websocket.onclose = () => {
          this.isConnected = false;
          this.connectionState = 'disconnected';
          this.emit('disconnected');
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private sendAuthAndSessionConfig(config: WebRTCConfig): void {
    if (!this.websocket) return;

    // For React Native, we'll need to handle authentication differently
    // This is a simplified implementation - in production you'd need proper auth flow
    this.websocket.send(JSON.stringify({
      type: 'session.update',
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
        // Note: API key would need to be handled through a different auth mechanism
        // in a real React Native app (e.g., through a backend proxy)
      },
    }));
  }

  private handleWebSocketMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      this.emit('message', message);

      switch (message.type) {
        case 'response.audio.delta':
          this.emit('audioData', message.delta);
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
        case 'error':
          this.emit('error', new Error(message.error.message));
          break;
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  public sendAudio(audioData: ArrayBuffer): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: this.arrayBufferToBase64(audioData),
    }));
  }

  public sendText(text: string): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    }));

    this.websocket.send(JSON.stringify({
      type: 'response.create',
    }));
  }

  public setMuted(muted: boolean): void {
    // Mock implementation - in a real app this would control microphone
    console.log('Mute state changed:', muted);
    this.emit('muteChanged', muted);
  }

  public disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    this.isConnected = false;
    this.connectionState = 'disconnected';
    this.emit('disconnected');
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public getConnectionState(): string {
    return this.connectionState;
  }

  public isConnectionOpen(): boolean {
    return this.isConnected;
  }

  // Mock methods for audio stream simulation
  public startLocalAudioStream(): void {
    // Simulate local audio stream
    this.emit('localStream', { id: 'mock-local-stream' });
  }

  public getLocalAudioLevel(): number {
    // Mock audio level between 0-1
    return Math.random() * 0.5;
  }
}