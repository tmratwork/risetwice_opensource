import { startMobileWebRTCWebSocketServer } from './mobile_webrtc-websocket-server';

// Start the mobile WebSocket server when needed
let isMobileServerStarted = false;

export function initializeMobileWebRTCServer() {
  if (!isMobileServerStarted) {
    try {
      console.log('[mobile_server-startup] Initializing Mobile WebRTC WebSocket server...');
      startMobileWebRTCWebSocketServer(8080);
      isMobileServerStarted = true;
      console.log('[mobile_server-startup] Mobile WebRTC WebSocket server initialized successfully');
    } catch (error) {
      console.error('[mobile_server-startup] Failed to start Mobile WebRTC WebSocket server:', error);
    }
  }
}

// Note: This server should be started manually when needed for mobile app development
// It should NOT be auto-started like the main NextJS app server