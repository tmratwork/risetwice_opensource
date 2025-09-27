// utils/chat-events.ts
// Custom Events Pattern for Header Communication
// Avoids React hooks violations and infinite loop issues

export class ChatEvents {
  private static instance: ChatEvents;
  private eventTarget = new EventTarget();

  static getInstance() {
    if (!ChatEvents.instance) {
      ChatEvents.instance = new ChatEvents();
    }
    return ChatEvents.instance;
  }

  // Register end chat handler
  setEndChatHandler(handler: (() => void) | null) {
    this.eventTarget.dispatchEvent(new CustomEvent('endChatHandlerChanged', {
      detail: { handler }
    }));
  }

  // Subscribe to handler changes
  onEndChatHandlerChange(callback: (handler: (() => void) | null) => void) {
    const listener = (event: any) => callback(event.detail.handler);
    this.eventTarget.addEventListener('endChatHandlerChanged', listener);
    return () => this.eventTarget.removeEventListener('endChatHandlerChanged', listener);
  }

  // Set connection state
  setConnectionState(connected: boolean) {
    this.eventTarget.dispatchEvent(new CustomEvent('connectionStateChanged', {
      detail: { connected }
    }));
  }

  // Subscribe to connection changes
  onConnectionStateChange(callback: (connected: boolean) => void) {
    const listener = (event: any) => callback(event.detail.connected);
    this.eventTarget.addEventListener('connectionStateChanged', listener);
    return () => this.eventTarget.removeEventListener('connectionStateChanged', listener);
  }
}