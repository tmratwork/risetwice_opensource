// src/hooksV15/webrtc/comprehensive-message-handler.ts

import { optimizedAudioLogger as audioLogger } from '../audio/optimized-audio-logger';

/**
 * Comprehensive OpenAI Realtime API Message Handler
 * 
 * Handles ALL standard OpenAI Realtime API message types based on 2025 documentation.
 * Eliminates "unknown_message_type" errors by properly handling all expected message types.
 */

export interface MessageHandlerCallbacks {
  onFunctionCall?: (msg: Record<string, unknown>) => Promise<void>;
  onAudioTranscriptDelta?: (msg: Record<string, unknown>) => void;
  onAudioTranscriptDone?: (msg: Record<string, unknown>) => void;
  onAudioDelta?: (msg: Record<string, unknown>) => void;
  onAudioDone?: (msg: Record<string, unknown>) => void;
  onResponseDone?: (msg: Record<string, unknown>) => void;
  onOutputAudioBufferStopped?: (msg: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  
  // V11-style visual feedback callbacks
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;
  onAudioBufferCommitted?: () => void;
}

export class ComprehensiveMessageHandler {
  private callbacks: MessageHandlerCallbacks;

  constructor(callbacks: MessageHandlerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  private getCurrentSpecialistType(): string {
    // Try to get current specialist type from the store or localStorage
    try {
      // Check if we can access the store state
      if (typeof window !== 'undefined' && (window as { useWebRTCStore?: { getState: () => { currentSpecialist?: string } } }).useWebRTCStore) {
        const state = (window as unknown as { useWebRTCStore: { getState: () => { currentSpecialist?: string } } }).useWebRTCStore.getState();
        if (state?.currentSpecialist) {
          return state.currentSpecialist;
        }
      }
      
      // Fallback to localStorage check
      if (typeof localStorage !== 'undefined') {
        const triageSession = localStorage.getItem('triageSession');
        if (triageSession) {
          const parsed = JSON.parse(triageSession);
          if (parsed?.currentSpecialist && parsed.currentSpecialist !== 'triage') {
            return parsed.currentSpecialist;
          }
        }
      }
    } catch {
      // Fallback to default if anything fails
    }
    
    return 'triageAI';
  }

  /**
   * Handle incoming WebRTC data channel message
   */
  public async handleMessage(event: MessageEvent): Promise<void> {
    if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
      console.log('[MSG-HANDLER] 🔄 handleMessage called');
      console.log('[MSG-HANDLER] 📊 Raw event data:', {
        hasData: !!event.data,
        dataType: typeof event.data,
        dataLength: event.data?.length || 0,
        rawData: event.data
      });
    }

    try {
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.log('[MSG-HANDLER] 🔧 Attempting to parse JSON...');
      }
      const message = JSON.parse(event.data);
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.log('[MSG-HANDLER] ✅ JSON parsed successfully');
      }
      
      const messageId = message.id || message.event_id || Date.now().toString().slice(-6);
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.log('[MSG-HANDLER] 📋 Message details:', {
          type: message.type,
          messageId: messageId,
          hasType: !!message.type,
          keys: Object.keys(message || {}),
          fullMessage: message
        });
      }

      audioLogger.debug('webrtc', 'message_received', {
        type: message.type,
        messageId: messageId,
        messageLength: event.data.length
      });

      // Handle all standard OpenAI Realtime API message types
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.log('[MSG-HANDLER] 🔍 Entering message type switch for:', message.type);
      }
      switch (message.type) {
        // Session Management Messages
        case 'session.created':
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] 🎯 Handling session.created');
          }
          this.handleSessionCreated(message);
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] ✅ session.created handled');
          }
          break;
        case 'session.updated':
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] 🎯 Handling session.updated');
          }
          this.handleSessionUpdated(message);
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] ✅ session.updated handled');
          }
          break;

        // Conversation Management Messages
        case 'conversation.created':
          this.handleConversationCreated(message);
          break;
        case 'conversation.item.created':
          this.handleConversationItemCreated(message);
          break;
        case 'conversation.item.truncated':
          this.handleConversationItemTruncated(message);
          break;
        case 'conversation.item.deleted':
          this.handleConversationItemDeleted(message);
          break;
        case 'conversation.item.input_audio_transcription.delta':
          this.handleInputAudioTranscriptionDelta(message);
          break;
        case 'conversation.item.input_audio_transcription.completed':
          this.handleInputAudioTranscriptionCompleted(message);
          break;
        case 'conversation.item.input_audio_transcription.failed':
          this.handleInputAudioTranscriptionFailed(message);
          break;

        // Input Audio Buffer Messages
        case 'input_audio_buffer.committed':
          this.handleInputAudioBufferCommitted(message);
          break;
        case 'input_audio_buffer.cleared':
          this.handleInputAudioBufferCleared(message);
          break;
        case 'input_audio_buffer.speech_started':
          this.handleInputAudioBufferSpeechStarted(message);
          break;
        case 'input_audio_buffer.speech_stopped':
          this.handleInputAudioBufferSpeechStopped(message);
          break;

        // Response Generation Messages
        case 'response.created':
          this.handleResponseCreated(message);
          break;
        case 'response.done':
          this.handleResponseDone(message);
          break;
        case 'response.cancelled':
          this.handleResponseCancelled(message);
          break;

        // Response Output Messages
        case 'response.output_item.added':
          this.handleResponseOutputItemAdded(message);
          break;
        case 'response.output_item.done':
          this.handleResponseOutputItemDone(message);
          break;

        // Response Content Messages
        case 'response.content_part.added':
          this.handleResponseContentPartAdded(message);
          break;
        case 'response.content_part.done':
          this.handleResponseContentPartDone(message);
          break;

        // Response Text Messages
        case 'response.text.delta':
          this.handleResponseTextDelta(message);
          break;
        case 'response.text.done':
          this.handleResponseTextDone(message);
          break;

        // Response Audio Messages
        case 'response.audio.delta':
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] 🎯 Handling response.audio.delta');
          }
          this.handleResponseAudioDelta(message);
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] ✅ response.audio.delta handled');
          }
          break;
        case 'response.audio.done':
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] 🎯 Handling response.audio.done');
          }
          this.handleResponseAudioDone(message);
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] ✅ response.audio.done handled');
          }
          break;

        // Response Audio Transcript Messages
        case 'response.audio_transcript.delta':
          this.handleResponseAudioTranscriptDelta(message);
          break;
        case 'response.audio_transcript.done':
          this.handleResponseAudioTranscriptDone(message);
          break;

        // Function Calling Messages
        case 'response.function_call_arguments.delta':
          this.handleResponseFunctionCallArgumentsDelta(message);
          break;
        case 'response.function_call_arguments.done':
          this.handleResponseFunctionCallArgumentsDone(message);
          break;

        // Output Audio Buffer Messages (WebRTC)
        case 'output_audio_buffer.started':
          this.handleOutputAudioBufferStarted(message);
          break;
        case 'output_audio_buffer.stopped':
          this.handleOutputAudioBufferStopped(message);
          break;

        // Rate Limiting Messages
        case 'rate_limits.updated':
          this.handleRateLimitsUpdated(message);
          break;

        // Error Messages
        case 'error':
          this.handleError(message);
          break;

        // Catch any truly unknown types (should be very rare now)
        default:
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] ❌ Unknown message type encountered:', message.type);
            console.log('[MSG-HANDLER] 📄 Full unknown message:', message);
          }
          audioLogger.warn('webrtc', 'unknown_message_type', { 
            type: message.type,
            messageId: messageId,
            fullMessage: message
          });
          break;
      }
      
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.log('[MSG-HANDLER] ✅ Message processing completed successfully for type:', message.type);
      }

    } catch (error) {
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.error('[MSG-HANDLER] ❌ Error in handleMessage:');
        console.error('[MSG-HANDLER] 🚨 Error details:', {
          errorName: (error as Error).name,
          errorMessage: (error as Error).message,
          errorStack: (error as Error).stack,
          eventDataLength: event.data?.length || 0,
          eventDataType: typeof event.data,
          eventDataSample: event.data?.substring ? event.data.substring(0, 200) : event.data
        });
      }
      
      audioLogger.error('webrtc', 'message_parsing_failed', error as Error, {
        eventDataLength: event.data?.length || 0
      });
      
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.log('[MSG-HANDLER] 🔄 Calling onError callback if available:', !!this.callbacks.onError);
      }
      if (this.callbacks.onError) {
        try {
          this.callbacks.onError(error as Error);
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.log('[MSG-HANDLER] ✅ onError callback completed');
          }
        } catch (callbackError) {
          if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
            console.error('[MSG-HANDLER] ❌ Error in onError callback:', callbackError);
          }
        }
      }
    }
  }

  // Session Management Handlers

  private handleSessionCreated(message: Record<string, unknown>): void {
    const session = message.session as Record<string, unknown> | undefined;
    audioLogger.info('webrtc', 'session_created', {
      sessionId: (session as { id?: string })?.id,
      model: (session as { model?: string })?.model,
      voice: (session as { voice?: string })?.voice
    });
  }

  private handleSessionUpdated(message: Record<string, unknown>): void {
    const session = message.session as Record<string, unknown> | undefined;
    const tools = (session as { tools?: unknown[] })?.tools;
    audioLogger.info('webrtc', 'session_updated', {
      sessionId: (session as { id?: string })?.id,
      hasTools: !!(tools && Array.isArray(tools) && tools.length > 0)
    });
  }

  // Conversation Management Handlers

  private handleConversationCreated(message: Record<string, unknown>): void {
    const conversation = message.conversation as Record<string, unknown> | undefined;
    audioLogger.info('webrtc', 'conversation_created', {
      conversationId: (conversation as { id?: string })?.id
    });
  }

  private handleConversationItemCreated(message: Record<string, unknown>): void {
    const item = message.item as Record<string, unknown> | undefined;
    audioLogger.debug('webrtc', 'conversation_item_created', {
      itemId: (item as { id?: string })?.id,
      itemType: (item as { type?: string })?.type,
      role: (item as { role?: string })?.role
    });
  }

  private handleConversationItemTruncated(message: Record<string, unknown>): void {
    const item = message.item as Record<string, unknown> | undefined;
    audioLogger.debug('webrtc', 'conversation_item_truncated', {
      itemId: (item as { id?: string })?.id,
      contentIndex: message.content_index
    });
  }

  private handleConversationItemDeleted(message: Record<string, unknown>): void {
    const item = message.item as Record<string, unknown> | undefined;
    audioLogger.debug('webrtc', 'conversation_item_deleted', {
      itemId: (item as { id?: string })?.id
    });
  }

  private handleInputAudioTranscriptionDelta(message: Record<string, unknown>): void {
    const delta = message.delta as string;
    const itemId = message.item_id as string; // Use item_id directly, not item?.id
    
    if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
      console.log('[V15-TRANSCRIPT-DEBUG] User audio transcription delta:', { delta, itemId });
    }
    
    // Enhanced triage logging for user message streaming (conditional to reduce verbosity)
    if (process.env.NEXT_PUBLIC_ENABLE_STREAMING_LOGS === 'true') {
      console.log('[triageAI] ===== USER MESSAGE STREAMING =====');
      console.log('[triageAI] User message delta:', delta);
      console.log('[triageAI] Item ID:', itemId);
      console.log('[triageAI] Delta length:', delta?.length || 0);
      console.log('[triageAI] Message type: streaming user input');
    }
    
    audioLogger.debug('webrtc', 'input_audio_transcription_delta', {
      itemId: itemId,
      deltaLength: delta?.length || 0
    });
    
    // Call the transcript callback for streaming user messages
    if (delta && this.callbacks.onAudioTranscriptDelta) {
      if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
        console.log('[V15-TRANSCRIPT-DEBUG] Calling transcript callback for user streaming message');
      }
      console.log('[triageAI] Forwarding user message delta to transcript handler');
      // Create a message-like object with user role
      const userTranscriptDelta = {
        delta: delta,
        response_id: `user-${itemId}`,
        role: 'user',
        metadata: { role: 'user' }
      };
      this.callbacks.onAudioTranscriptDelta(userTranscriptDelta);
    }
  }

  private handleInputAudioTranscriptionCompleted(message: Record<string, unknown>): void {
    const transcript = message.transcript as string;
    const itemId = message.item_id as string; // Use item_id directly, not item?.id
    
    if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
      console.log('[V15-TRANSCRIPT-DEBUG] User audio transcription completed:', { transcript, itemId });
    }
    
    // Enhanced AI interaction logging
    console.log('[triageAI] ===== USER INPUT RECEIVED =====');
    console.log('[triageAI] User said:', transcript);
    console.log('[triageAI] Input method: voice transcription');
    console.log('[triageAI] Message ID:', itemId);
    console.log('[triageAI] Transcript length:', transcript.length);
    console.log('[triageAI] Next: waiting for AI response (direct or function call)');
    
    // HANDOFF DETECTION: Enhanced logging to identify user inputs that might trigger handoffs
    console.log('[HANDOFF-DETECTION] ===== ANALYZING USER INPUT FOR HANDOFF TRIGGERS =====');
    console.log('[HANDOFF-DETECTION] User transcript:', transcript);
    console.log('[HANDOFF-DETECTION] Transcript length:', transcript?.length || 0);
    console.log('[HANDOFF-DETECTION] Message ID:', itemId);
    console.log('[HANDOFF-DETECTION] Timestamp:', new Date().toISOString());
    
    // Check for potential handoff trigger words/phrases
    const handoffTriggerWords = [
      'mental health', 'depression', 'anxiety', 'suicidal', 'crisis', 'emergency',
      'therapist', 'counselor', 'therapy', 'psychiatric', 'medication',
      'help me', 'resources', 'support', 'assistance', 'services',
      'feeling sad', 'feeling down', 'stressed', 'overwhelmed', 'panic',
      'substance abuse', 'addiction', 'alcohol', 'drugs', 'rehab',
      'shelter', 'housing', 'homeless', 'food bank', 'benefits',
      'specialist', 'expert', 'professional', 'referral'
    ];
    
    const lowerTranscript = transcript?.toLowerCase() || '';
    const triggeredWords = handoffTriggerWords.filter(word => lowerTranscript.includes(word));
    
    if (triggeredWords.length > 0) {
      console.log('[HANDOFF-DETECTION] 🚨 POTENTIAL HANDOFF TRIGGER DETECTED!');
      console.log('[HANDOFF-DETECTION] Triggered words:', triggeredWords);
      console.log('[HANDOFF-DETECTION] This user input may lead to a handoff function call');
      console.log('[HANDOFF-DETECTION] Watch for trigger_specialist_handoff function in upcoming messages');
    } else {
      console.log('[HANDOFF-DETECTION] No obvious handoff triggers detected in user input');
    }
    
    // Store the user input in a global variable for correlation with handoff events
    if (typeof window !== 'undefined') {
      if (!(window as unknown as { __handoffDebugData?: unknown }).__handoffDebugData) {
        (window as unknown as { __handoffDebugData: unknown }).__handoffDebugData = {};
      }
      (window as unknown as { __handoffDebugData: { lastUserInput: unknown } }).__handoffDebugData.lastUserInput = {
        transcript: transcript,
        itemId: itemId,
        timestamp: new Date().toISOString(),
        triggeredWords: triggeredWords,
        hasHandoffTriggers: triggeredWords.length > 0
      };
      console.log('[HANDOFF-DETECTION] Stored user input in window.__handoffDebugData.lastUserInput');
    }
    
    audioLogger.debug('webrtc', 'input_audio_transcription_completed', {
      itemId: itemId,
      transcript: transcript,
      handoffTriggerWords: triggeredWords,
      hasHandoffTriggers: triggeredWords.length > 0
    });
    
    // Call the transcript callback for user messages
    if (transcript && this.callbacks.onAudioTranscriptDone) {
      if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
        console.log('[V15-TRANSCRIPT-DEBUG] Calling transcript callback for user message');
      }
      // Create a message-like object with user role
      const userTranscriptMessage = {
        transcript: transcript,
        response_id: `user-${itemId}`,
        role: 'user',
        metadata: { role: 'user' }
      };
      this.callbacks.onAudioTranscriptDone(userTranscriptMessage);
    }
  }


  private handleInputAudioTranscriptionFailed(message: Record<string, unknown>): void {
    const item = message.item as { id?: string } | undefined;
    audioLogger.warn('webrtc', 'input_audio_transcription_failed', {
      itemId: item?.id,
      error: message.error
    });
  }

  // Input Audio Buffer Handlers

  private handleInputAudioBufferCommitted(message: Record<string, unknown>): void {
    console.log('[V15-VISUAL-FEEDBACK] Audio buffer committed - starting "Thinking..." state');
    
    audioLogger.debug('webrtc', 'input_audio_buffer_committed', {
      previousItemId: message.previous_item_id,
      itemId: message.item_id
    });
    
    // Call the visual feedback callback for "Thinking..." state
    if (this.callbacks.onAudioBufferCommitted) {
      this.callbacks.onAudioBufferCommitted();
    }
  }

  private handleInputAudioBufferCleared(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'input_audio_buffer_cleared', {
      eventId: message.event_id
    });
  }

  private handleInputAudioBufferSpeechStarted(message: Record<string, unknown>): void {
    console.log('[V15-VISUAL-FEEDBACK] User speech started - showing empty bubble');
    
    audioLogger.debug('webrtc', 'input_audio_buffer_speech_started', {
      audioStartMs: message.audio_start_ms,
      itemId: message.item_id
    });
    
    // Call the visual feedback callback for empty bubble
    if (this.callbacks.onSpeechStarted) {
      this.callbacks.onSpeechStarted();
    }
  }

  private handleInputAudioBufferSpeechStopped(message: Record<string, unknown>): void {
    console.log('[V15-VISUAL-FEEDBACK] User speech stopped');
    
    audioLogger.debug('webrtc', 'input_audio_buffer_speech_stopped', {
      audioEndMs: message.audio_end_ms,
      itemId: message.item_id
    });
    
    // Call the visual feedback callback
    if (this.callbacks.onSpeechStopped) {
      this.callbacks.onSpeechStopped();
    }
  }

  // Response Generation Handlers

  private handleResponseCreated(message: Record<string, unknown>): void {
    audioLogger.info('webrtc', 'response_created', {
      responseId: (message.response as { id?: string })?.id,
      status: (message.response as { status?: string })?.status
    });
  }

  private handleResponseDone(message: Record<string, unknown>): void {
    audioLogger.info('webrtc', 'response_completed', {
      responseId: (message.response as { id?: string })?.id,
      status: (message.response as { status?: string })?.status,
      statusDetails: (message.response as { status_details?: unknown })?.status_details
    });

    // Call the response done callback
    if (this.callbacks.onResponseDone) {
      this.callbacks.onResponseDone(message);
    }
  }

  private handleResponseCancelled(message: Record<string, unknown>): void {
    audioLogger.warn('webrtc', 'response_cancelled', {
      responseId: (message.response as { id?: string })?.id
    });
  }

  // Response Output Handlers

  private handleResponseOutputItemAdded(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_output_item_added', {
      responseId: (message.response as { id?: string })?.id,
      outputIndex: message.output_index,
      itemType: (message.item as { type?: string })?.type
    });
  }

  private handleResponseOutputItemDone(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_output_item_done', {
      responseId: (message.response as { id?: string })?.id,
      outputIndex: message.output_index,
      itemId: (message.item as { id?: string })?.id
    });
  }

  // Response Content Handlers

  private handleResponseContentPartAdded(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_content_part_added', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index,
      partType: (message.part as { type?: string })?.type
    });
  }

  private handleResponseContentPartDone(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_content_part_done', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index
    });
  }

  // Response Text Handlers

  private handleResponseTextDelta(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_text_delta', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index,
      deltaLength: typeof message.delta === 'string' ? message.delta.length : 0
    });
  }

  private handleResponseTextDone(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_text_done', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index,
      textLength: typeof message.text === 'string' ? message.text.length : 0
    });
  }

  // Response Audio Handlers

  private handleResponseAudioDelta(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_audio_delta', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index,
      deltaLength: typeof message.delta === 'string' ? message.delta.length : 0
    });

    // Call the audio delta callback
    if (this.callbacks.onAudioDelta) {
      this.callbacks.onAudioDelta(message);
    }
  }

  private handleResponseAudioDone(message: Record<string, unknown>): void {
    if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
      console.log('[MSG-HANDLER] 🎵 handleResponseAudioDone called');
      console.log('[MSG-HANDLER] 📊 Audio done message details:', {
        responseId: (message.response as { id?: string })?.id,
        itemId: (message.item as { id?: string })?.id,
        outputIndex: message.output_index,
        contentIndex: message.content_index,
        hasCallback: !!this.callbacks.onAudioDone
      });
    }

    audioLogger.info('webrtc', 'response_audio_done', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index
    });

    // Call the audio done callback
    if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
      console.log('[MSG-HANDLER] 🔄 Calling onAudioDone callback...');
    }
    if (this.callbacks.onAudioDone) {
      try {
        this.callbacks.onAudioDone(message);
        if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
          console.log('[MSG-HANDLER] ✅ onAudioDone callback completed successfully');
        }
      } catch (callbackError) {
        if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
          console.error('[MSG-HANDLER] ❌ Error in onAudioDone callback:', callbackError);
        }
        throw callbackError;
      }
    } else {
      if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
        console.log('[MSG-HANDLER] ⚠️ No onAudioDone callback registered');
      }
    }
  }

  // Response Audio Transcript Handlers

  private handleResponseAudioTranscriptDelta(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_audio_transcript_delta', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index,
      deltaLength: typeof message.delta === 'string' ? message.delta.length : 0
    });

    // Call the audio transcript delta callback
    if (this.callbacks.onAudioTranscriptDelta) {
      this.callbacks.onAudioTranscriptDelta(message);
    }
  }

  private handleResponseAudioTranscriptDone(message: Record<string, unknown>): void {
    const transcript = message.transcript as string;
    const responseId = (message.response as { id?: string })?.id;
    
    // Enhanced AI interaction logging with dynamic specialist detection
    const currentSpecialist = this.getCurrentSpecialistType();
    console.log(`[triageAI][${currentSpecialist}] ===== AI RESPONDED DIRECTLY =====`);
    console.log(`[triageAI][${currentSpecialist}] AI said:`, transcript);
    console.log(`[triageAI][${currentSpecialist}] Response type: direct text/audio response`);
    console.log(`[triageAI][${currentSpecialist}] Response ID:`, responseId);
    console.log(`[triageAI][${currentSpecialist}] Transcript length:`, transcript.length);
    console.log(`[triageAI][${currentSpecialist}] Item ID:`, (message.item as { id?: string })?.id);
    
    // Check if this response contains handoff-related content
    if (transcript && (transcript.toLowerCase().includes('handoff') || 
                      transcript.toLowerCase().includes('specialist') || 
                      transcript.toLowerCase().includes('connect you'))) {
      console.log('[triageAI] 🚨 POTENTIAL HANDOFF RESPONSE DETECTED! AI mentioned handoff/specialist');
    }
    
    
    audioLogger.info('webrtc', 'response_audio_transcript_done', {
      responseId: responseId,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      contentIndex: message.content_index,
      transcriptLength: typeof transcript === 'string' ? transcript.length : 0
    });

    // Call the audio transcript done callback
    if (this.callbacks.onAudioTranscriptDone) {
      this.callbacks.onAudioTranscriptDone(message);
    }
  }

  // Helper to detect if AI response suggests a missed resource request
  private isLikelyResourceRequest(transcript: string): boolean {
    const resourceKeywords = [
      'let me help you find',
      'I can help you locate',
      'resources in your area',
      'find services',
      'assistance programs',
      'shelter',
      'food bank',
      'housing',
      'mental health services',
      'crisis hotline',
      'find help'
    ];
    
    const lowerTranscript = transcript.toLowerCase();
    return resourceKeywords.some(keyword => lowerTranscript.includes(keyword));
  }

  // Function Calling Handlers

  private handleResponseFunctionCallArgumentsDelta(message: Record<string, unknown>): void {
    audioLogger.debug('webrtc', 'response_function_call_arguments_delta', {
      responseId: (message.response as { id?: string })?.id,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      callId: message.call_id,
      deltaLength: typeof message.delta === 'string' ? message.delta.length : 0
    });
  }

  private async handleResponseFunctionCallArgumentsDone(message: Record<string, unknown>): Promise<void> {
    const messageTime = performance.now();
    const messageSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    const functionName = message.name as string;
    const callId = message.call_id as string;
    const argumentsStr = message.arguments as string;
    const responseId = (message.response as { id?: string })?.id;
    
    // Enhanced AI interaction logging
    console.log('[HANDOFF-DEBUG] ===== MESSAGE HANDLER: AI FUNCTION CALL COMPLETED =====');
    console.log('[HANDOFF-DEBUG] Message Session ID:', messageSessionId);
    console.log('[HANDOFF-DEBUG] Message processing time:', messageTime.toFixed(3) + 'ms since page load');
    console.log('[HANDOFF-DEBUG] Function called:', functionName);
    console.log('[HANDOFF-DEBUG] Response type: function call');
    console.log('[HANDOFF-DEBUG] Call ID:', callId);
    console.log('[HANDOFF-DEBUG] Full message object:', message);
    
    // Check if this is the critical handoff function
    if (functionName === 'trigger_specialist_handoff') {
      console.log('[HANDOFF-DEBUG] 🚨 CRITICAL: trigger_specialist_handoff FUNCTION DETECTED IN MESSAGE HANDLER!');
      console.log('[HANDOFF-DEBUG] Message Session ID:', messageSessionId);
      console.log('[HANDOFF-DEBUG] This function call should trigger handoff storage in WebRTC store');
      console.log('[HANDOFF-DEBUG] Next step: function execution will call storePendingHandoff()');
      console.log('[HANDOFF-DEBUG] Then onResponseDone will dispatch the handoff event');
    }
    console.log('[HANDOFF-DEBUG] Response ID:', responseId);
    console.log('[HANDOFF-DEBUG] Arguments:', argumentsStr);
    console.log('[HANDOFF-DEBUG] Arguments length:', argumentsStr?.length || 0);
    console.log('[HANDOFF-DEBUG] Item ID:', (message.item as { id?: string })?.id);
    console.log('[HANDOFF-DEBUG] Next: executing function and waiting for AI to complete response');
    
    audioLogger.info('webrtc', 'response_function_call_arguments_done', {
      responseId: responseId,
      itemId: (message.item as { id?: string })?.id,
      outputIndex: message.output_index,
      callId: callId,
      name: functionName,
      argumentsLength: typeof argumentsStr === 'string' ? argumentsStr.length : 0
    });

    // Call the function call callback
    if (this.callbacks.onFunctionCall) {
      await this.callbacks.onFunctionCall(message);
    }
  }

  // Output Audio Buffer Handlers (WebRTC)

  private handleOutputAudioBufferStarted(message: Record<string, unknown>): void {
    if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
      console.log('[MSG-HANDLER] 🎵 Output audio buffer started:', {
        responseId: message.response_id,
        eventId: message.event_id
      });
    }

    audioLogger.info('webrtc', 'output_audio_buffer_started', {
      responseId: message.response_id,
      eventId: message.event_id
    });

    // This indicates the server has started streaming audio
    // You can use this to update UI state to show audio generation is active
  }

  private handleOutputAudioBufferStopped(message: Record<string, unknown>): void {
    if (process.env.ENABLE_MSG_HANDLER_LOGS === 'true') {
      console.log('[MSG-HANDLER] 🎵 Output audio buffer stopped:', {
        responseId: message.response_id,
        eventId: message.event_id
      });
    }

    audioLogger.info('webrtc', 'output_audio_buffer_stopped', {
      responseId: message.response_id,
      eventId: message.event_id
    });

    // This indicates the server has finished streaming audio
    // The audio buffer has been completely drained on the server side
    // Call the callback to handle handoff dispatch
    if (this.callbacks.onOutputAudioBufferStopped) {
      this.callbacks.onOutputAudioBufferStopped(message);
    }
  }

  // Rate Limiting Handlers

  private handleRateLimitsUpdated(message: Record<string, unknown>): void {
    audioLogger.info('webrtc', 'rate_limits_updated', {
      rateLimits: message.rate_limits
    });
  }

  // Error Handlers

  private handleError(message: Record<string, unknown>): void {
    const error = new Error((message.error as { message?: string })?.message || 'Unknown WebRTC error');
    
    audioLogger.error('webrtc', 'server_error', error, {
      errorType: (message.error as { type?: string })?.type,
      errorCode: (message.error as { code?: string })?.code,
      eventId: message.event_id
    });

    // Call the error callback
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  /**
   * Update callbacks
   */
  public updateCallbacks(newCallbacks: Partial<MessageHandlerCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }
}