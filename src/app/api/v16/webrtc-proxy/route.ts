// src/app/api/v16/webrtc-proxy/route.ts
// WebRTC Proxy API for Mobile Apps
// Handles OpenAI authentication that React Native WebSocket cannot handle directly

import { WebSocket } from 'ws';
import { NextRequest, NextResponse } from 'next/server';

interface WebRTCProxyMessage {
  type: string;
  apiKey?: string;
  session?: any;
  [key: string]: any;
}

interface ProxyConnection {
  mobileClient: WebSocket;
  openaiConnection: WebSocket | null;
  isConnected: boolean;
}

const activeConnections = new Map<string, ProxyConnection>();

export async function GET(request: NextRequest) {
  const upgrade = request.headers.get('upgrade');
  
  if (upgrade !== 'websocket') {
    return new NextResponse('Expected Upgrade: websocket', { status: 426 });
  }

  // This endpoint should handle WebSocket upgrade in a full production setup
  // For development/testing, we'll return connection info
  return NextResponse.json({
    message: 'WebRTC Proxy endpoint active',
    endpoint: 'ws://localhost:3000/api/v16/webrtc-proxy',
    status: 'ready'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[webrtc-proxy] Received proxy setup request:', body);

    // Handle mobile app setup for WebRTC proxy
    if (body.action === 'setup-proxy') {
      return NextResponse.json({
        success: true,
        message: 'WebRTC proxy configured',
        proxyEndpoint: 'ws://localhost:3000/api/v16/webrtc-proxy',
      });
    }

    // Handle session configuration
    if (body.type === 'session.update') {
      const { apiKey, session } = body;
      
      if (!apiKey) {
        return NextResponse.json(
          { error: 'API key required for proxy authentication' },
          { status: 400 }
        );
      }

      // In a full implementation, this would:
      // 1. Validate the API key
      // 2. Create WebSocket connection to OpenAI
      // 3. Forward messages between mobile and OpenAI
      // 4. Handle authentication headers properly

      console.log('[webrtc-proxy] Session configuration received for proxy');
      
      return NextResponse.json({
        success: true,
        message: 'Session configured through proxy',
        session: session,
      });
    }

    return NextResponse.json(
      { error: 'Unknown proxy action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[webrtc-proxy] Error handling proxy request:', error);
    return NextResponse.json(
      { error: 'Proxy request failed' },
      { status: 500 }
    );
  }
}

// WebSocket message handling for proxy
function createOpenAIConnection(apiKey: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const wsUrl = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
    
    const openaiWs = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    });

    openaiWs.on('open', () => {
      console.log('[webrtc-proxy] Connected to OpenAI');
      resolve(openaiWs);
    });

    openaiWs.on('error', (error) => {
      console.error('[webrtc-proxy] OpenAI connection error:', error);
      reject(error);
    });

    openaiWs.on('close', () => {
      console.log('[webrtc-proxy] OpenAI connection closed');
    });
  });
}

function handleProxyMessage(
  message: WebRTCProxyMessage, 
  connection: ProxyConnection
): void {
  console.log('[webrtc-proxy] Handling proxy message:', message.type);

  switch (message.type) {
    case 'session.update':
      handleSessionUpdate(message, connection);
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

async function handleSessionUpdate(
  message: WebRTCProxyMessage, 
  connection: ProxyConnection
): Promise<void> {
  const { apiKey, session } = message;
  
  if (!apiKey) {
    console.error('[webrtc-proxy] No API key provided for session update');
    return;
  }

  try {
    console.log('[webrtc-proxy] Creating OpenAI connection...');
    
    // Create authenticated connection to OpenAI
    const openaiConnection = await createOpenAIConnection(apiKey);
    connection.openaiConnection = openaiConnection;

    // Set up message forwarding from OpenAI to mobile
    openaiConnection.on('message', (data) => {
      const message = data.toString();
      console.log('[webrtc-proxy] Forwarding OpenAI message to mobile');
      
      if (connection.mobileClient.readyState === WebSocket.OPEN) {
        connection.mobileClient.send(message);
      }
    });

    openaiConnection.on('close', () => {
      console.log('[webrtc-proxy] OpenAI connection closed');
      connection.openaiConnection = null;
      connection.isConnected = false;
    });

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
    if (connection.mobileClient.readyState === WebSocket.OPEN) {
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

// Export functions for WebSocket server setup (if needed in production)
export {
  createOpenAIConnection,
  handleProxyMessage,
  handleSessionUpdate
};