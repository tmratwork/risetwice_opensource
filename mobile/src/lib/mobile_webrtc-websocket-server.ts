import { WebSocketServer, WebSocket } from 'ws';

// Note: This requires the main Next.js app's WebRTCConnectionManager
// In a real deployment, this would need to be abstracted or duplicated for mobile-only use

interface MobileConnection {
  ws: WebSocket;
  openAIConnection?: any; // Will be WebRTCConnectionManager from main app
}

export class MobileWebRTCWebSocketServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<WebSocket, MobileConnection> = new Map();

  start(port: number = 8080) {
    if (this.wss) {
      console.log('[mobile_webrtc-websocket-server] Server already running');
      return;
    }

    this.wss = new WebSocketServer({ port });
    console.log(`[mobile_webrtc-websocket-server] WebSocket server started on port ${port}`);
    
    this.wss.on('connection', (ws) => {
      console.log('[mobile_webrtc-websocket-server] Mobile client connected');
      
      const connection: MobileConnection = { ws };
      this.connections.set(ws, connection);
      
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('[mobile_webrtc-websocket-server] Received from mobile:', message.type);
          
          await this.handleMessage(connection, message);
        } catch (error) {
          console.error('[mobile_webrtc-websocket-server] Error parsing message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('[mobile_webrtc-websocket-server] Mobile client disconnected');
        this.handleDisconnect(connection);
        this.connections.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('[mobile_webrtc-websocket-server] WebSocket error:', error);
        this.handleDisconnect(connection);
        this.connections.delete(ws);
      });
    });

    this.wss.on('error', (error) => {
      console.error('[mobile_webrtc-websocket-server] Server error:', error);
    });
  }

  stop() {
    if (this.wss) {
      console.log('[mobile_webrtc-websocket-server] Stopping server...');
      
      // Clean up all connections
      for (const connection of this.connections.values()) {
        this.handleDisconnect(connection);
      }
      this.connections.clear();
      
      this.wss.close();
      this.wss = null;
    }
  }

  private async handleMessage(connection: MobileConnection, message: Record<string, unknown>) {
    const { ws } = connection;
    
    switch (message.type) {
      case 'connect':
        await this.handleConnect(connection, message);
        break;
      case 'audio':
        this.handleAudio(connection, message);
        break;
      case 'disconnect':
        this.handleDisconnect(connection);
        break;
      default:
        console.warn('[mobile_webrtc-websocket-server] Unknown message type:', message.type);
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  private async handleConnect(connection: MobileConnection, message: Record<string, unknown>) {
    const { ws } = connection;
    const { config } = message;
    
    console.log('[mobile_webrtc-websocket-server] Establishing WebRTC connection to OpenAI...');
    
    try {
      // TODO: This needs to be implemented properly for mobile-only deployment
      // Currently requires the main Next.js app's WebRTCConnectionManager
      
      // For now, send an error indicating this needs the main app
      this.sendError(ws, 'WebRTC proxy requires main Next.js application to be running');
      
    } catch (error) {
      console.error('[mobile_webrtc-websocket-server] Failed to connect to OpenAI:', error);
      this.sendError(ws, 'Failed to connect to OpenAI', error);
    }
  }

  private handleAudio(connection: MobileConnection, message: Record<string, unknown>) {
    const { openAIConnection } = connection;
    
    if (openAIConnection) {
      // Forward audio to OpenAI
      openAIConnection.sendAudio(message.data);
    } else {
      console.warn('[mobile_webrtc-websocket-server] No OpenAI connection available for audio');
      this.sendError(connection.ws, 'No active OpenAI connection');
    }
  }

  private handleDisconnect(connection: MobileConnection) {
    const { openAIConnection } = connection;
    
    if (openAIConnection) {
      console.log('[mobile_webrtc-websocket-server] Closing OpenAI connection...');
      openAIConnection.disconnect();
      connection.openAIConnection = undefined;
    }
  }

  private sendError(ws: WebSocket, message: string, error?: unknown) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(JSON.stringify({
        type: 'error',
        message,
        details: error instanceof Error ? error.message : String(error)
      }));
    }
  }
}

// Global server instance for mobile app
let globalMobileServer: MobileWebRTCWebSocketServer | null = null;

export function startMobileWebRTCWebSocketServer(port: number = 8080): MobileWebRTCWebSocketServer {
  if (!globalMobileServer) {
    globalMobileServer = new MobileWebRTCWebSocketServer();
    globalMobileServer.start(port);
  }
  return globalMobileServer;
}

export function stopMobileWebRTCWebSocketServer() {
  if (globalMobileServer) {
    globalMobileServer.stop();
    globalMobileServer = null;
  }
}

export function getMobileWebRTCWebSocketServer(): MobileWebRTCWebSocketServer | null {
  return globalMobileServer;
}