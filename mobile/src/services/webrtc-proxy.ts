// mobile/src/services/webrtc-proxy.ts
// WebRTC Proxy Service for React Native Mobile App
// Handles OpenAI Realtime API connections that React Native WebSocket cannot handle directly

interface WebRTCProxyMessage {
  type: string;
  apiKey?: string;
  session?: {
    instructions?: string;
    voice?: string;
    input_audio_format?: string;
    output_audio_format?: string;
    turn_detection?: Record<string, unknown>;
    tools?: Array<Record<string, unknown>>;
    modalities?: string[];
    temperature?: number;
  };
  [key: string]: unknown;
}

interface ProxyConnection {
  mobileClient: WebSocket | null;
  openaiConnection: WebSocket | null;
  isConnected: boolean;
}

class WebRTCProxyService {
  private connections: Map<string, ProxyConnection> = new Map();
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  // Setup proxy configuration via HTTP POST
  async setupProxy(config: { apiKey: string; session?: any }): Promise<{ success: boolean; message: string; proxyEndpoint?: string }> {
    try {
      console.log('[webrtc-proxy] Setting up proxy configuration...');

      const response = await fetch(`${this.baseUrl}/api/v16/webrtc-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setup-proxy',
          apiKey: config.apiKey,
          session: config.session
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      console.log('[webrtc-proxy] Proxy setup successful:', data);

      return data;

    } catch (error) {
      console.error('[webrtc-proxy] Proxy setup failed:', error);
      throw error;
    }
  }

  // Configure session via HTTP POST (fallback for WebSocket issues)
  async configureSession(config: { apiKey: string; session: any }): Promise<{ success: boolean; message: string; session?: any }> {
    try {
      console.log('[webrtc-proxy] Configuring session via HTTP...');

      const response = await fetch(`${this.baseUrl}/api/v16/webrtc-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'session.update',
          apiKey: config.apiKey,
          session: config.session
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      console.log('[webrtc-proxy] Session configuration successful:', data);

      return data;

    } catch (error) {
      console.error('[webrtc-proxy] Session configuration failed:', error);
      throw error;
    }
  }

  // Create connection to OpenAI Realtime API (for future WebSocket implementation)
  createOpenAIConnection(apiKey: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';

      try {
        // Note: In React Native, you would use the built-in WebSocket
        // This is a placeholder for the actual implementation
        const openaiWs = new WebSocket(wsUrl);

        // In a real implementation, you would set headers here
        // React Native WebSocket doesn't support headers in constructor
        // That's why we need the proxy service

        openaiWs.onopen = () => {
          console.log('[webrtc-proxy] Connected to OpenAI');
          resolve(openaiWs);
        };

        openaiWs.onerror = (error) => {
          console.error('[webrtc-proxy] OpenAI connection error:', error);
          reject(error);
        };

        openaiWs.onclose = () => {
          console.log('[webrtc-proxy] OpenAI connection closed');
        };

      } catch (error) {
        console.error('[webrtc-proxy] Failed to create OpenAI connection:', error);
        reject(error);
      }
    });
  }

  // Handle proxy messages (for future WebSocket implementation)
  handleProxyMessage(message: WebRTCProxyMessage, connectionId: string): void {
    console.log('[webrtc-proxy] Handling proxy message:', message.type);

    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.error('[webrtc-proxy] Connection not found:', connectionId);
      return;
    }

    switch (message.type) {
      case 'session.update':
        this.handleSessionUpdate(message, connection);
        break;

      case 'input_audio_buffer.append':
        if (connection.openaiConnection && connection.openaiConnection.readyState === WebSocket.OPEN) {
          connection.openaiConnection.send(JSON.stringify(message));
        }
        break;

      case 'response.create':
        if (connection.openaiConnection && connection.openaiConnection.readyState === WebSocket.OPEN) {
          connection.openaiConnection.send(JSON.stringify(message));
        }
        break;

      case 'conversation.item.create':
        if (connection.openaiConnection && connection.openaiConnection.readyState === WebSocket.OPEN) {
          connection.openaiConnection.send(JSON.stringify(message));
        }
        break;

      default:
        console.log('[webrtc-proxy] Unknown message type:', message.type);
    }
  }

  // Handle session updates (for future WebSocket implementation)
  private async handleSessionUpdate(message: WebRTCProxyMessage, connection: ProxyConnection): Promise<void> {
    const { apiKey, session } = message;

    if (!apiKey) {
      console.error('[webrtc-proxy] No API key provided for session update');
      return;
    }

    try {
      console.log('[webrtc-proxy] Creating OpenAI connection...');

      // Create authenticated connection to OpenAI
      const openaiConnection = await this.createOpenAIConnection(apiKey);
      connection.openaiConnection = openaiConnection;

      // Set up message forwarding from OpenAI to mobile
      openaiConnection.onmessage = (event) => {
        const message = event.data;
        console.log('[webrtc-proxy] Forwarding OpenAI message to mobile');

        if (connection.mobileClient && connection.mobileClient.readyState === WebSocket.OPEN) {
          connection.mobileClient.send(message);
        }
      };

      openaiConnection.onclose = () => {
        console.log('[webrtc-proxy] OpenAI connection closed');
        connection.openaiConnection = null;
        connection.isConnected = false;
      };

      // Send session configuration to OpenAI
      const sessionConfig = {
        type: 'session.update',
        session: session
      };

      openaiConnection.send(JSON.stringify(sessionConfig));
      console.log('[webrtc-proxy] Session configuration sent to OpenAI');

      connection.isConnected = true;

    } catch (error) {
      console.error('[webrtc-proxy] Error setting up OpenAI connection:', error);

      // Send error back to mobile client
      if (connection.mobileClient && connection.mobileClient.readyState === WebSocket.OPEN) {
        connection.mobileClient.send(JSON.stringify({
          type: 'error',
          error: {
            message: 'Failed to connect to OpenAI',
            code: 'connection_failed'
          }
        }));
      }
    }
  }

  // Create new connection tracking
  createConnection(connectionId: string): ProxyConnection {
    const connection: ProxyConnection = {
      mobileClient: null,
      openaiConnection: null,
      isConnected: false
    };

    this.connections.set(connectionId, connection);
    return connection;
  }

  // Clean up connection
  closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (connection.openaiConnection) {
        connection.openaiConnection.close();
      }
      if (connection.mobileClient) {
        connection.mobileClient.close();
      }
      this.connections.delete(connectionId);
    }
  }

  // Get connection status
  getConnectionStatus(connectionId: string): { connected: boolean; hasOpenAI: boolean; hasMobile: boolean } {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { connected: false, hasOpenAI: false, hasMobile: false };
    }

    return {
      connected: connection.isConnected,
      hasOpenAI: connection.openaiConnection !== null,
      hasMobile: connection.mobileClient !== null
    };
  }
}

// Export singleton instance
export const webRTCProxyService = new WebRTCProxyService();

// Export types for use in mobile components
export type { WebRTCProxyMessage, ProxyConnection };

// Export class for custom instantiation if needed
export { WebRTCProxyService };