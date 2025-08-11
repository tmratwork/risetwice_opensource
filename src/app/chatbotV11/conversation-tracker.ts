// src/app/chatbotV11/conversation-tracker.ts

/**
 * Intercepts fetch responses to detect message save operations
 * and dispatches custom events for conversation tracking
 */

// Create a fetch interceptor to watch for conversation ID headers
let originalFetch: typeof fetch;

// Only run in browser context
if (typeof window !== 'undefined') {
  originalFetch = window.fetch;

  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    // Get the request URL to check if it's a message save request
    const url = input?.toString() || '';
    const isSaveMessageRequest = url.includes('/api/v11/save-message');
    
    if (isSaveMessageRequest) {
      console.log('%c [CONVERSATION-TRACKER] 🔍 Intercepted save-message request', 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
    }
    
    // Call the original fetch
    const response = await originalFetch(input, init);
    
    // Only process save-message responses
    if (isSaveMessageRequest) {
      try {
        // Clone the response to be able to read it multiple times
        const clonedResponse = response.clone();
        
        // Check for conversation ID header
        const conversationId = clonedResponse.headers.get('X-Conversation-ID');
        
        // Also try to get the conversation ID from the response body
        let bodyConversationId: string | null = null;
        
        try {
          const responseData = await clonedResponse.json();
          bodyConversationId = responseData.conversationId || null;
          
          console.log('%c [CONVERSATION-TRACKER] 📄 Response data contains conversationId:', 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;', bodyConversationId);
        } catch (jsonError) {
          console.error('%c [CONVERSATION-TRACKER] ❌ Error parsing response JSON:', 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', jsonError);
        }
        
        // Use conversation ID from header or body
        const finalConversationId = conversationId || bodyConversationId;
        
        if (finalConversationId) {
          console.log(`%c [CONVERSATION-TRACKER] ✅ Detected message save with conversation ID: ${finalConversationId}`, 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
          
          // Store the conversation ID in session storage
          sessionStorage.setItem('current_conversation_id', finalConversationId);
          
          // Dispatch a custom event with the conversation ID
          window.dispatchEvent(new CustomEvent('message_saved', { 
            detail: { conversationId: finalConversationId } 
          }));
        } else {
          console.error('%c [CONVERSATION-TRACKER] ⚠️ No conversation ID found in response header or body', 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;');
        }
      } catch (error) {
        console.error('%c [CONVERSATION-TRACKER] ❌ Error processing fetch response:', 'background: #1e3a5f; color: #ff6347; font-weight: bold; padding: 4px; border-radius: 4px;', error);
      }
    }
    
    // Return the original response
    return response;
  };

  console.log('%c [CONVERSATION-TRACKER] 🚀 Fetch interceptor initialized for conversation tracking', 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
}

// Initialize function that can be called from component
export function initConversationTracker() {
  if (typeof window === 'undefined') {
    console.warn('Conversation tracker cannot be initialized on the server side');
    return {
      clearConversationId: () => {
        // No-op for server side
      }
    };
  }
  
  console.log('%c [CONVERSATION-TRACKER] 🔄 Conversation tracker initialized', 'background: #1e3a5f; color: #32CD32; font-weight: bold; padding: 4px; border-radius: 4px;');
  
  // Try to retrieve any existing conversation ID from session storage
  const existingConversationId = sessionStorage.getItem('current_conversation_id');
  if (existingConversationId) {
    console.log(`%c [CONVERSATION-TRACKER] 📝 Retrieved existing conversation ID from session storage: ${existingConversationId}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
  }
  
  return {
    clearConversationId: () => {
      const removed = sessionStorage.getItem('current_conversation_id');
      sessionStorage.removeItem('current_conversation_id');
      console.log(`%c [CONVERSATION-TRACKER] 🗑️ Conversation ID cleared from session storage: ${removed || 'none'}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
    },
    
    getConversationId: () => {
      return sessionStorage.getItem('current_conversation_id');
    },
    
    setConversationId: (id: string) => {
      sessionStorage.setItem('current_conversation_id', id);
      console.log(`%c [CONVERSATION-TRACKER] ✏️ Manually set conversation ID: ${id}`, 'background: #1e3a5f; color: #ffcc00; font-weight: bold; padding: 4px; border-radius: 4px;');
    }
  };
}

export default initConversationTracker;