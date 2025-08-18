import { EventEmitter } from 'events';
import { API_BASE_URL } from '@env';

// WebSocket-based service for mobile WebRTC proxy
// Requires mobile WebSocket server (mobile_webrtc-websocket-server.ts) to be running
// See: mobile/docs/mobile_webrtc_setup.md for setup instructions

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

// WebSocket-based service that connects to NextJS WebRTC proxy
export class WebSocketService extends EventEmitter {
  private websocket: WebSocket | null = null;
  private isConnected = false;
  private isConnecting = false;
  private config: WebRTCConfig | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    super();
  }

  async connect(config: WebRTCConfig): Promise<void> {
    if (this.isConnected || this.isConnecting) {
      throw new Error('Already connected or connecting');
    }

    this.isConnecting = true;
    this.config = config;
    
    try {
      console.log('[websocket_service] Starting connection to NextJS proxy...');
      
      // Step 1: Setup proxy (get WebSocket URL)
      const proxyInfo = await this.setupProxy();
      
      // Step 2: Connect WebSocket
      await this.connectWebSocket(proxyInfo.websocketUrl);
      
      // Step 3: Send connection request with config
      await this.sendConnectionRequest(config);
      
      console.log('[websocket_service] Successfully connected via WebSocket proxy');
      
    } catch (error) {
      this.isConnecting = false;
      console.error('[websocket_service] Connection failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async setupProxy(): Promise<{ websocketUrl: string }> {
    const apiBaseUrl = API_BASE_URL || 'http://localhost:3000';
    
    console.log('[websocket_service] Setting up proxy...');
    
    const response = await fetch(`${apiBaseUrl}/api/v16/webrtc-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'setup-proxy',
        apiKey: this.config?.apiKey
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to setup proxy: ${response.status}`);
    }

    const data = await response.json();
    console.log('[websocket_service] Proxy setup successful');
    
    return {
      websocketUrl: data.websocketUrl || 'ws://localhost:8080'
    };
  }

  private async connectWebSocket(websocketUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('[websocket_service] Connecting to WebSocket:', websocketUrl);
      
      this.websocket = new WebSocket(websocketUrl);

      this.websocket.onopen = () => {
        console.log('[websocket_service] WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[websocket_service] Error parsing message:', error);
        }
      };

      this.websocket.onclose = (event) => {
        console.log('[websocket_service] WebSocket closed:', event.code, event.reason);
        this.isConnected = false;
        this.isConnecting = false;
        
        if (event.code !== 1000) { // Not a normal closure
          this.emit('disconnected');
          this.attemptReconnect();
        } else {
          this.emit('disconnected');
        }
      };

      this.websocket.onerror = (error) => {
        console.error('[websocket_service] WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', new Error('WebSocket connection failed'));
        reject(new Error('WebSocket connection failed'));
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.isConnecting && this.websocket?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  private async sendConnectionRequest(config: WebRTCConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not ready'));
        return;
      }

      console.log('[websocket_service] Sending connection request...');
      
      // Set up response handler
      const responseHandler = (message: any) => {
        if (message.type === 'connected') {
          console.log('[websocket_service] OpenAI connection established via proxy');
          this.isConnected = true;
          this.isConnecting = false;
          this.emit('connected');
          resolve();
        } else if (message.type === 'error') {
          console.error('[websocket_service] Connection error from proxy:', message);
          this.isConnecting = false;
          this.emit('error', new Error(message.message));
          reject(new Error(message.message));
        }
      };

      // Temporarily listen for response
      this.once('_response', responseHandler);

      // Send connection request
      this.websocket.send(JSON.stringify({
        type: 'connect',
        config: {
          voice: config.voice,
          instructions: config.instructions,
          functions: config.functions,
          model: config.model
        }
      }));

      // Timeout after 15 seconds
      setTimeout(() => {
        this.removeListener('_response', responseHandler);
        if (this.isConnecting) {
          reject(new Error('Connection request timeout'));
        }
      }, 15000);
    });
  }

  private handleMessage(message: any): void {
    console.log('[websocket_service] Received message:', message.type);

    switch (message.type) {
      case 'connected':
      case 'error':
        // Handle connection responses
        this.emit('_response', message);
        break;
        
      case 'ai_message':
        // Handle AI messages from OpenAI
        this.emit('message', message.data);
        break;
        
      case 'ai_audio':
        // Handle AI audio from OpenAI
        this.emit('audioTrack', message.data);
        this.emit('audioData', message.data);
        break;
        
      default:
        console.warn('[websocket_service] Unknown message type:', message.type);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[websocket_service] Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    
    console.log(`[websocket_service] Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms...`);
    
    setTimeout(() => {
      if (this.config) {
        this.connect(this.config).catch(error => {
          console.error('[websocket_service] Reconnection failed:', error);
        });
      }
    }, delay);
  }

  async disconnect(): Promise<void> {
    console.log('[websocket_service] Disconnecting...');
    
    if (this.websocket) {
      // Send disconnect message if connected
      if (this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({ type: 'disconnect' }));
      }
      
      this.websocket.close(1000, 'Normal closure');
      this.websocket = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    
    this.emit('disconnected');
  }

  sendMessage(message: any): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[websocket_service] WebSocket not ready for sending');
      return;
    }

    try {
      this.websocket.send(JSON.stringify({
        type: 'message',
        data: message
      }));
      console.log('[websocket_service] Sent message to proxy:', message.type);
    } catch (error) {
      console.error('[websocket_service] Error sending message:', error);
    }
  }

  sendAudioData(audioData: AudioData): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      console.warn('[websocket_service] WebSocket not ready for audio');
      return;
    }

    try {
      this.websocket.send(JSON.stringify({
        type: 'audio',
        data: audioData.audio
      }));
      console.log('[websocket_service] Sent audio data to proxy');
    } catch (error) {
      console.error('[websocket_service] Error sending audio:', error);
    }
  }

  getConnectionState(): string {
    if (this.isConnected && this.websocket?.readyState === WebSocket.OPEN) {
      return 'connected';
    } else if (this.isConnecting) {
      return 'connecting';
    } else {
      return 'disconnected';
    }
  }

  isReady(): boolean {
    return this.isConnected && this.websocket?.readyState === WebSocket.OPEN;
  }
}