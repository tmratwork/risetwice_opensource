// src/hooksV15/webrtc/connection-manager.ts

import { optimizedAudioLogger } from '../audio/optimized-audio-logger';
import type { ConnectionConfig } from '../types';
import { AI_DEFAULTS } from '@/config/ai-defaults';
import { getOpenAIRealtimeModel } from '@/config/models';

/**
 * Connection Manager for V15
 * 
 * Manages WebRTC connection lifecycle with:
 * - Clean connection state management
 * - Proper error handling and recovery
 * - Built-in diagnostics and logging
 * - Connection health monitoring
 */

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

interface ConnectionMetrics {
  connectionStartTime?: number;
  connectionEndTime?: number;
  connectionDuration?: number;
  reconnectionAttempts: number;
  lastError?: Error;
  messagesSent: number;
  messagesReceived: number;
}

export class ConnectionManager {
  private state: ConnectionState = 'disconnected';
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: ConnectionConfig;
  private metrics: ConnectionMetrics;
  private audioInputStream: MediaStream | null = null;
  private microphonePermissionDenied: boolean = false;

  // Event listeners
  private stateChangeListeners: Set<(state: ConnectionState) => void> = new Set();
  private messageListeners: Set<(event: MessageEvent) => void> = new Set();
  private errorListeners: Set<(error: Error) => void> = new Set();
  private audioStreamListeners: Set<(stream: MediaStream) => void> = new Set();

  constructor(config: ConnectionConfig = {}) {
    this.config = {
      timeout: 120000, // Increased default from 30s to 120s for long-running operations like resource searches
      retryAttempts: 3,
      enableDiagnostics: true,
      ...config
    };

    this.metrics = {
      reconnectionAttempts: 0,
      messagesSent: 0,
      messagesReceived: 0
    };

    optimizedAudioLogger.info('webrtc', 'connection_manager_initialized', {
      config: this.config,
      version: 'v15'
    });
  }

  /**
   * Connect to WebRTC session with React 18+ performance measurement
   */
  public async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      optimizedAudioLogger.warn('webrtc', 'connection_already_active', { state: this.state });
      return;
    }

    // Start performance measurement
    const performanceMark = optimizedAudioLogger.startTiming('webrtc_connection');

    this.setState('connecting');
    this.metrics.connectionStartTime = Date.now();

    try {
      await this.establishConnection();
      this.setState('connected');
      this.metrics.connectionEndTime = Date.now();
      this.metrics.connectionDuration = this.metrics.connectionEndTime - this.metrics.connectionStartTime!;

      // End performance measurement
      const connectionTime = optimizedAudioLogger.endTiming(performanceMark);

      optimizedAudioLogger.info('webrtc', 'connection_succeeded', {
        connectionDuration: this.metrics.connectionDuration,
        reconnectionAttempts: this.metrics.reconnectionAttempts,
        performanceTime: connectionTime
      });

    } catch (error) {
      this.metrics.lastError = error as Error;
      this.setState('failed');

      // End performance measurement even on failure
      const connectionTime = optimizedAudioLogger.endTiming(performanceMark);

      optimizedAudioLogger.error('webrtc', 'connection_failed', error as Error, {
        reconnectionAttempts: this.metrics.reconnectionAttempts,
        connectionDuration: this.metrics.connectionStartTime ?
          Date.now() - this.metrics.connectionStartTime : 0,
        performanceTime: connectionTime
      });

      throw error;
    }
  }

  /**
   * Disconnect from WebRTC session
   */
  public async disconnect(): Promise<void> {
    console.log('[END_SESSION_FLOW] 🎯 12. ConnectionManager.disconnect() called');
    console.log('[END_SESSION_FLOW] 📊 Connection state transition:', {
      fromState: this.state,
      toState: 'disconnected',
      connectionDuration: this.getConnectionDuration(),
      messagesSent: this.metrics.messagesSent,
      messagesReceived: this.metrics.messagesReceived
    });

    console.log('[connection] 🔍 disconnect() called');

    if (this.state === 'disconnected') {
      return;
    }

    // COMPREHENSIVE DISCONNECT TRACKING: Log disconnect source in connection manager
    console.log('[connection] 🔍 [CONNECTION-MANAGER] Full disconnect context with expanded error:', {
      triggeredBy: 'connection_manager_disconnect',
      currentState: this.state,
      waitingForEndSessionResponse: 'not_tracked_in_connection_manager',
      functionInProgress: 'not_tracked_in_connection_manager',

      // EXPAND THE ERROR OBJECT - Full details
      lastError: this.metrics.lastError ? {
        message: this.metrics.lastError.message,
        name: this.metrics.lastError.name,
        stack: this.metrics.lastError.stack,
        code: (this.metrics.lastError as unknown as { code?: string }).code,
        type: typeof this.metrics.lastError,
        constructorName: this.metrics.lastError.constructor.name,
        stringified: JSON.stringify(this.metrics.lastError, null, 2)
      } : null,

      // Connection context
      peerConnectionState: this.peerConnection?.connectionState || 'none',
      dataChannelState: this.dataChannel?.readyState || 'none',
      iceConnectionState: this.peerConnection?.iceConnectionState || 'none',

      // Metrics context
      connectionDuration: this.getConnectionDuration(),
      messagesSent: this.metrics.messagesSent,
      messagesReceived: this.metrics.messagesReceived,
      reconnectionAttempts: this.metrics.reconnectionAttempts,

      timestamp: Date.now()
    });

    // FIXED: Use appropriate logging method based on whether there's an actual error
    if (this.metrics.lastError) {
      // There's a real error - use error logging
      optimizedAudioLogger.error('disconnect', 'disconnect_triggered', this.metrics.lastError, {
        triggeredBy: 'connection_manager_disconnect',
        currentState: this.state,
        waitingForEndSessionResponse: 'not_tracked_in_connection_manager',
        functionInProgress: 'not_tracked_in_connection_manager',
        timestamp: Date.now()
      });
    } else {
      // No actual error - use event logging with stack trace for debugging
      optimizedAudioLogger.logEvent('disconnect', 'disconnect_triggered', {
        triggeredBy: 'connection_manager_disconnect',
        currentState: this.state,
        waitingForEndSessionResponse: 'not_tracked_in_connection_manager',
        functionInProgress: 'not_tracked_in_connection_manager',
        timestamp: Date.now(),
        note: 'Normal disconnect - no error occurred'
      });
    }

    optimizedAudioLogger.info('webrtc', 'connection_disconnected', {
      voluntaryDisconnect: true,
      connectionDuration: this.getConnectionDuration(),
      messagesSent: this.metrics.messagesSent,
      messagesReceived: this.metrics.messagesReceived
    });

    this.cleanup();

    console.log('[END_SESSION_FLOW] 🔄 13. Notifying state change to disconnected');
    console.log('[END_SESSION_FLOW] 👥 Subscribers count:', this.stateChangeListeners.size);

    console.log('[connection] 🔍 About to notify state change to disconnected');
    console.log('[connection] 🔍 Subscribers count:', this.stateChangeListeners.size);

    this.setState('disconnected');

    console.log('[connection] 🔍 State change notification sent');
  }

  /**
   * Send message through data channel
   */
  public sendMessage(message: string): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      optimizedAudioLogger.error('webrtc', 'send_message_failed', new Error('Data channel not available'), {
        dataChannelState: this.dataChannel?.readyState || 'null',
        connectionState: this.state
      });

      // Update connection state if data channel is not available
      if (this.state === 'connected') {
        this.handleConnectionFailure();
      }

      return false;
    }

    try {
      // Log user message for function calling diagnosis
      console.log('[functionCallDiagnosis] ===== USER MESSAGE SENT TO AI =====');
      console.log('[functionCallDiagnosis] User message:', message);
      console.log('[functionCallDiagnosis] Message length:', message.length);

      // Check if message contains location-related keywords
      const locationKeywords = ['whittier', 'california', 'los angeles', 'shelter', 'location', 'city', 'address', 'near me', 'nearby'];
      const containsLocation = locationKeywords.some(keyword => message.toLowerCase().includes(keyword));
      console.log('[functionCallDiagnosis] Contains location keywords:', containsLocation);
      if (containsLocation) {
        console.log('[functionCallDiagnosis] ✅ Message contains location context - AI should call search_resources_unified');
      } else {
        console.log('[functionCallDiagnosis] ⚠️ Message does not contain obvious location keywords');
      }

      // Format message for OpenAI Realtime API like V11 does
      const formattedMessage = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: message,
            },
          ],
        },
      };

      const response = {
        type: "response.create"
      };

      console.log('[functionCallDiagnosis] Sending formatted message to AI:', formattedMessage);
      console.log('[functionCallDiagnosis] Will trigger response creation in 1000ms');

      // Send the message first
      this.dataChannel.send(JSON.stringify(formattedMessage));

      // Then trigger response creation with delay to prevent race conditions (like V11)
      setTimeout(() => {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          console.log('[functionCallDiagnosis] Sending response.create to trigger AI response');
          this.dataChannel.send(JSON.stringify(response));
        }
      }, 1000); // Use same 1000ms delay as V11

      this.metrics.messagesSent++;

      optimizedAudioLogger.debug('webrtc', 'message_sent', {
        messageLength: message.length,
        totalMessagesSent: this.metrics.messagesSent,
        formattedMessage
      });

      return true;

    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'send_message_error', error as Error, {
        messageLength: message.length
      });

      // Handle send error by marking connection as failed
      this.handleConnectionFailure();
      return false;
    }
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if data channel is ready for sending messages
   */
  public isDataChannelReady(): boolean {
    return this.dataChannel?.readyState === 'open';
  }


  /**
   * Check if connection manager has been cleaned up and needs recreation
   */
  public isCleanedUp(): boolean {
    return this.peerConnection === null && this.dataChannel === null;
  }

  /**
   * Get the audio input stream for mute functionality
   */
  public getAudioInputStream(): MediaStream | null {
    return this.audioInputStream;
  }

  /**
   * Toggle mute on the audio input stream
   */
  public toggleMute(): boolean {
    // Check if microphone permission was denied
    if (this.microphonePermissionDenied) {
      // Show user message about microphone access denial
      this.showMicrophoneDeniedMessage();
      // Return true to indicate muted state (since no real mic input is available)
      return true;
    }

    if (!this.audioInputStream) {
      optimizedAudioLogger.warn('webrtc', 'toggle_mute_no_stream', {
        hasStream: false
      });
      return false; // Return false to indicate mute status (not muted if no stream)
    }

    const audioTracks = this.audioInputStream.getAudioTracks();
    if (audioTracks.length === 0) {
      optimizedAudioLogger.warn('webrtc', 'toggle_mute_no_tracks', {
        trackCount: audioTracks.length
      });
      return false; // Return false to indicate not muted (no tracks to mute)
    }

    const currentlyMuted = !audioTracks[0].enabled;
    const newMutedState = !currentlyMuted;

    // Enable/disable audio track (V11 style)
    audioTracks[0].enabled = !newMutedState;

    optimizedAudioLogger.info('webrtc', 'mute_toggled', {
      previousState: currentlyMuted,
      newState: newMutedState,
      trackEnabled: audioTracks[0].enabled,
      trackId: audioTracks[0].id
    });

    return newMutedState;
  }

  /**
   * Check if microphone permission was denied
   */
  public isMicrophonePermissionDenied(): boolean {
    return this.microphonePermissionDenied;
  }

  /**
   * Show message to user when microphone access is denied and orb is tapped
   */
  private showMicrophoneDeniedMessage(): void {
    const message = 'You denied me permission to access the mic.';

    // Log the message attempt
    optimizedAudioLogger.info('webrtc', 'microphone_denied_message_shown', {
      message
    });

    // Log to console for debugging
    console.log('[V15-MIC-PERMISSION]', message);

    // Dispatch custom event that UI components can listen to for displaying the message
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('microphonePermissionDenied', {
        detail: { message }
      }));
    }

    // Show alert to user immediately when orb is tapped
    alert(message);
  }

  /**
   * Subscribe to state changes
   */
  public onStateChange(callback: (state: ConnectionState) => void): () => void {
    console.log('[connection] 🔍 Adding subscriber, count before:', this.stateChangeListeners.size);

    this.stateChangeListeners.add(callback);

    console.log('[connection] 🔍 Added subscriber, count after:', this.stateChangeListeners.size);

    return () => {
      console.log('[connection] 🔍 Removing subscriber, count before:', this.stateChangeListeners.size);

      this.stateChangeListeners.delete(callback);

      console.log('[connection] 🔍 Removed subscriber, count after:', this.stateChangeListeners.size);
    };
  }

  /**
   * Subscribe to messages
   */
  public onMessage(callback: (event: MessageEvent) => void): () => void {
    this.messageListeners.add(callback);

    return () => {
      this.messageListeners.delete(callback);
    };
  }

  /**
   * Subscribe to errors
   */
  public onError(callback: (error: Error) => void): () => void {
    this.errorListeners.add(callback);

    return () => {
      this.errorListeners.delete(callback);
    };
  }

  /**
   * Subscribe to incoming audio streams
   */
  public onAudioStream(callback: (stream: MediaStream) => void): () => void {
    this.audioStreamListeners.add(callback);

    return () => {
      this.audioStreamListeners.delete(callback);
    };
  }

  /**
   * Replace AI configuration without disconnecting WebRTC
   * Used for seamless handoffs between triage and specialist AIs
   */
  public async replaceAIConfiguration(newConfig: {
    instructions: string;
    tools: unknown[];
  }): Promise<boolean> {
    // Detect if this is an inter-specialist handoff
    let currentSpecialist = 'unknown';
    let isInterSpecialistHandoff = false;

    // Try to get current specialist from WebRTC store if available
    if (typeof window !== 'undefined' && (window as unknown as { useWebRTCStore?: { getState: () => { triageSession?: { currentSpecialist?: string } } } }).useWebRTCStore) {
      const state = (window as unknown as { useWebRTCStore: { getState: () => { triageSession?: { currentSpecialist?: string } } } }).useWebRTCStore.getState();
      currentSpecialist = state.triageSession?.currentSpecialist || 'unknown';
      isInterSpecialistHandoff = currentSpecialist !== 'triage' && currentSpecialist !== 'unknown';
    }

    // Define logging variables at method scope
    const logPrefix = isInterSpecialistHandoff ? '[specialist_handoff]' : '[triage_handoff]';
    const enableLogs = isInterSpecialistHandoff
      ? process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true'
      : process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true';

    // Use appropriate logging based on handoff type
    if (isInterSpecialistHandoff && process.env.NEXT_PUBLIC_ENABLE_SPECIALIST_HANDOFF_LOGS === 'true') {
      console.log(`[specialist_handoff] [CONNECTION_MANAGER] Starting AI configuration replacement for inter-specialist handoff`);
      console.log(`[specialist_handoff] [CONNECTION_MANAGER] Current specialist: ${currentSpecialist}`);
      console.log(`[specialist_handoff] [CONNECTION_MANAGER] Instructions length: ${newConfig.instructions.length}`);
      console.log(`[specialist_handoff] [CONNECTION_MANAGER] Tools count: ${newConfig.tools.length}`);
      console.log(`[specialist_handoff] ⚠️ Using OpenAI session.update API`);
    } else if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS === 'true') {
      console.log(`[triage_handoff] [CONNECTION_MANAGER] Starting AI configuration replacement`);
      console.log(`[triage_handoff] [CONNECTION_MANAGER] Instructions length: ${newConfig.instructions.length}`);
      console.log(`[triage_handoff] [CONNECTION_MANAGER] Tools count: ${newConfig.tools.length}`);
    }

    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      if (enableLogs) {
        console.error(`${logPrefix} [CONNECTION_MANAGER] Data channel not available`, {
          dataChannelState: this.dataChannel?.readyState || 'null',
          connectionState: this.state
        });
      }
      optimizedAudioLogger.error('webrtc', 'replace_config_failed', new Error('Data channel not available'), {
        dataChannelState: this.dataChannel?.readyState || 'null',
        connectionState: this.state
      });
      return false;
    }

    try {
      // V18: Use config.turnDetection if provided (preserves manual push-to-talk mode during handoffs)
      const turnDetection = this.config.turnDetection !== undefined
        ? this.config.turnDetection
        : AI_DEFAULTS.turnDetection;

      // Create session update with complete AI replacement
      const sessionUpdate = {
        type: "session.update",
        session: {
          modalities: AI_DEFAULTS.modalities,
          instructions: newConfig.instructions,
          voice: AI_DEFAULTS.voice,
          input_audio_format: AI_DEFAULTS.inputAudioFormat,
          output_audio_format: AI_DEFAULTS.outputAudioFormat,
          input_audio_transcription: AI_DEFAULTS.inputAudioTranscription,
          turn_detection: turnDetection,
          tools: newConfig.tools,
          tool_choice: AI_DEFAULTS.toolChoice
        }
      };

      // Send session update
      if (enableLogs) {
        console.log(`${logPrefix} [CONNECTION_MANAGER] Sending session.update to OpenAI`);
        if (isInterSpecialistHandoff) {
          console.log(`[specialist_handoff] ⚠️ CRITICAL: Updating AI config for inter-specialist handoff`);
          console.log(`[specialist_handoff] ⚠️ This maintains unified persona`);
        }
      }
      this.dataChannel.send(JSON.stringify(sessionUpdate));

      // Wait for session.updated confirmation
      if (enableLogs) {
        console.log(`${logPrefix} [CONNECTION_MANAGER] Waiting for session.updated confirmation...`);
      }
      const confirmed = await this.waitForSessionUpdateConfirmation();

      if (confirmed) {
        if (enableLogs) {
          console.log(`${logPrefix} [CONNECTION_MANAGER] ✅ AI configuration replacement confirmed`);
          if (isInterSpecialistHandoff) {
            console.log(`[specialist_handoff] ✅ Inter-specialist handoff AI update successful`);
          }
        }
        optimizedAudioLogger.info('webrtc', 'ai_configuration_replaced', {
          instructionsLength: newConfig.instructions.length,
          toolsCount: newConfig.tools.length,
          voice: AI_DEFAULTS.voice
        });
      } else {
        if (enableLogs) {
          console.error(`${logPrefix} [CONNECTION_MANAGER] ❌ AI configuration replacement failed - no confirmation received`);
          if (isInterSpecialistHandoff) {
            console.error(`[specialist_handoff] ❌ CRITICAL: Inter-specialist handoff failed at session.update`);
          }
        }
      }

      return confirmed;

    } catch (error) {
      if (enableLogs) {
        console.error(`${logPrefix} [CONNECTION_MANAGER] ❌ Error during AI configuration replacement:`, error);
      }
      optimizedAudioLogger.error('webrtc', 'replace_config_error', error as Error);
      return false;
    }
  }

  /**
   * V18: Manually commit the input audio buffer
   * Used for push-to-talk mode when turn_detection is disabled
   */
  public commitInputAudioBuffer(): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      optimizedAudioLogger.error('webrtc', 'commit_audio_buffer_failed', new Error('Data channel not available'), {
        dataChannelState: this.dataChannel?.readyState || 'null',
        connectionState: this.state
      });
      return false;
    }

    try {
      const commitMessage = {
        type: "input_audio_buffer.commit"
      };

      this.dataChannel.send(JSON.stringify(commitMessage));
      optimizedAudioLogger.info('webrtc', 'audio_buffer_committed', {
        manualCommit: true
      });
      return true;
    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'commit_audio_buffer_error', error as Error);
      return false;
    }
  }

  /**
   * V18: Manually trigger AI response creation
   * Used for push-to-talk mode after committing audio buffer
   */
  public createResponse(): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      optimizedAudioLogger.error('webrtc', 'create_response_failed', new Error('Data channel not available'), {
        dataChannelState: this.dataChannel?.readyState || 'null',
        connectionState: this.state
      });
      return false;
    }

    try {
      const responseMessage = {
        type: "response.create"
      };

      this.dataChannel.send(JSON.stringify(responseMessage));
      optimizedAudioLogger.info('webrtc', 'response_creation_triggered', {
        manualTrigger: true
      });
      return true;
    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'create_response_error', error as Error);
      return false;
    }
  }

  /**
   * Wait for session.updated confirmation from OpenAI
   */
  private async waitForSessionUpdateConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
        console.warn('[CONNECTION-MANAGER] Session update confirmation timeout');
        resolve(false);
      }, 10000);

      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'session.updated') {
            clearTimeout(timeoutId);
            this.messageListeners.delete(messageHandler);
            resolve(true);
          }
        } catch {
          // Ignore parse errors
        }
      };

      // Add temporary message listener
      this.messageListeners.add(messageHandler);

    });
  }

  /**
   * Send function result back to the server
   */
  public sendFunctionResult(callId: string, result: unknown): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      optimizedAudioLogger.error('webrtc', 'send_function_result_failed', new Error('Data channel not available'), {
        dataChannelState: this.dataChannel?.readyState || 'null',
        connectionState: this.state,
        callId
      });
      return false;
    }

    try {
      // 1. Send function result
      const functionResult = {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(result)
        }
      };

      this.dataChannel.send(JSON.stringify(functionResult));

      // 2. CRITICAL: Trigger response generation after function result
      const responseCreate = {
        type: "response.create"
      };

      this.dataChannel.send(JSON.stringify(responseCreate));

      optimizedAudioLogger.info('webrtc', 'function_result_sent', {
        callId,
        resultType: typeof result,
        triggeredResponse: true
      });

      return true;

    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'send_function_result_error', error as Error, {
        callId
      });
      return false;
    }
  }

  /**
   * Update the connection manager's configuration
   * Used when the WebRTC store updates the config after the connection manager is created
   */
  public updateConfig(newConfig: ConnectionConfig): void {
    const oldGreetingLength = this.config.greetingInstructions?.length || 0;
    const newGreetingLength = newConfig.greetingInstructions?.length || 0;

    if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
      console.log('[resource_greeting] Connection manager: updateConfig called', {
        oldGreetingLength,
        newGreetingLength,
        isGreetingUpdate: oldGreetingLength !== newGreetingLength
      });
    }

    // Update the config with new values
    this.config = {
      ...this.config,
      ...newConfig
    };

    if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
      console.log('[resource_greeting] Connection manager: config updated successfully', {
        newGreetingLength: this.config.greetingInstructions?.length || 0,
        greetingPreview: this.config.greetingInstructions?.substring(0, 200) + '...' || 'null'
      });
    }
  }

  /**
   * Get connection diagnostics
   */
  public getDiagnostics(): Record<string, unknown> {
    return {
      state: this.state,
      metrics: this.metrics,
      connectionDuration: this.getConnectionDuration(),
      peerConnectionState: this.peerConnection?.connectionState || 'none',
      dataChannelState: this.dataChannel?.readyState || 'none',
      rtcStats: this.getRTCStats()
    };
  }

  // Private Methods

  private async establishConnection(): Promise<void> {
    optimizedAudioLogger.info('webrtc', 'establishing_real_connection', { version: 'v15' });

    // Get ephemeral token from session API
    const ephemeralToken = await this.getEphemeralToken();

    // Get user media for audio with microphone permission handling
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      optimizedAudioLogger.info('webrtc', 'microphone_permission_granted', { trackCount: stream.getAudioTracks().length });
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        optimizedAudioLogger.warn('webrtc', 'microphone_permission_denied', { error: error.message });

        // Mark that microphone permission was denied
        this.microphonePermissionDenied = true;

        // Create minimal silent audio track for WebRTC connection
        stream = await this.createSilentAudioStream();
        optimizedAudioLogger.info('webrtc', 'silent_audio_stream_created', { trackCount: stream.getAudioTracks().length });
      } else {
        // Re-throw other getUserMedia errors
        throw error;
      }
    }

    // Store audio input stream for mute functionality
    this.audioInputStream = stream;

    // V15: Apply initial mute state from store to match visual state
    // V18: Can start unmuted for manual push-to-talk mode
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      // Check if config specifies to start unmuted (V18 manual mode)
      const shouldStartUnmuted = this.config.startUnmuted === true;
      audioTracks[0].enabled = shouldStartUnmuted;

      optimizedAudioLogger.info('webrtc', shouldStartUnmuted ? 'initial_unmute_applied' : 'initial_mute_applied', {
        trackId: audioTracks[0].id,
        trackEnabled: audioTracks[0].enabled,
        reason: shouldStartUnmuted ? 'v18_manual_vad_mode' : 'matching_store_default_muted_state'
      });

      if (shouldStartUnmuted) {
        console.log('[V18-MANUAL-VAD] Starting with microphone UNMUTED for push-to-talk mode');
      }
    }

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Set up event handlers
    this.setupPeerConnectionEventHandlers();

    // Add audio track to peer connection
    stream.getTracks().forEach(track => {
      this.peerConnection!.addTrack(track, stream);
    });

    // Create data channel
    this.dataChannel = this.peerConnection.createDataChannel('messages', {
      ordered: true
    });

    this.setupDataChannelEventHandlers();

    // Create offer & set local description
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Send SDP offer to OpenAI Realtime API
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = getOpenAIRealtimeModel();
    const voice = this.config.voice || "alloy";

    optimizedAudioLogger.debug('webrtc', 'sending_offer_to_openai', {
      baseUrl,
      model,
      voice,
      offerType: offer.type
    });

    const response = await fetch(`${baseUrl}?model=${model}&voice=${voice}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralToken}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch SDP answer: ${errorText}`);
    }

    // Set remote description
    const answerSdp = await response.text();
    await this.peerConnection.setRemoteDescription({ type: "answer", sdp: answerSdp });

    optimizedAudioLogger.info('webrtc', 'connection_established', {
      connectionState: this.peerConnection.connectionState,
      iceConnectionState: this.peerConnection.iceConnectionState
    });

    // Configure session for audio input transcription
    await this.configureSession();
  }

  private setupPeerConnectionEventHandlers(): void {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection!.connectionState;

      optimizedAudioLogger.debug('webrtc', 'peer_connection_state_change', { state });

      if (state === 'failed' || state === 'disconnected') {
        this.handleConnectionFailure();
      }
    };

    this.peerConnection.onicecandidateerror = (event) => {
      optimizedAudioLogger.error('webrtc', 'ice_candidate_error',
        new Error(`ICE candidate error: ${event.errorText}`), {
        errorCode: event.errorCode,
        errorText: event.errorText
      }
      );
    };

    // Handle incoming audio stream from OpenAI
    this.peerConnection.ontrack = (event) => {
      console.log('[V15-ORB-DEBUG] ConnectionManager ontrack event received:', {
        kind: event.track.kind,
        streamId: event.streams[0]?.id,
        trackId: event.track.id,
        trackState: event.track.readyState,
        listenerCount: this.audioStreamListeners.size
      });

      optimizedAudioLogger.info('webrtc', 'audio_stream_received', {
        kind: event.track.kind,
        streamId: event.streams[0]?.id,
        trackId: event.track.id,
        trackState: event.track.readyState
      });

      if (event.track.kind === 'audio' && event.streams[0]) {
        console.log('[V15-ORB-DEBUG] ConnectionManager notifying audio stream listeners:', {
          streamId: event.streams[0].id,
          listenerCount: this.audioStreamListeners.size,
          stream: event.streams[0]
        });

        // Notify audio stream listeners
        let listenerIndex = 0;
        this.audioStreamListeners.forEach((listener) => {
          try {
            listenerIndex++;
            console.log(`[V15-ORB-DEBUG] Calling audio stream listener ${listenerIndex}/${this.audioStreamListeners.size}`);
            listener(event.streams[0]);
          } catch (error) {
            console.log(`[V15-ORB-DEBUG] Audio stream listener ${listenerIndex} error:`, error);
            optimizedAudioLogger.error('webrtc', 'audio_stream_listener_error', error as Error);
          }
        });
      }
    };
  }

  private setupDataChannelEventHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      optimizedAudioLogger.debug('webrtc', 'data_channel_opened');
    };

    this.dataChannel.onclose = () => {
      optimizedAudioLogger.debug('webrtc', 'data_channel_closed');

      // If data channel closes unexpectedly, update connection state
      if (this.state === 'connected') {
        optimizedAudioLogger.warn('webrtc', 'data_channel_closed_unexpectedly');
        this.handleConnectionFailure();
      }
    };

    this.dataChannel.onmessage = (event) => {
      this.metrics.messagesReceived++;

      optimizedAudioLogger.debug('webrtc', 'message_received', {
        messageLength: event.data.length,
        totalMessagesReceived: this.metrics.messagesReceived
      });

      // Enhanced logging for critical events - using comprehensive message types
      try {
        const message = JSON.parse(event.data);

        // Log critical events for debugging function calling flow
        const criticalTypes = [
          'response.output_item.done',
          'response.done',
          'conversation.item.created',
          'error',
          'response.function_call_arguments.done',
          'response.created',
          'session.created',
          'session.updated'
        ];

        if (criticalTypes.includes(message.type)) {
          optimizedAudioLogger.info('webrtc', 'critical_event_received', {
            type: message.type,
            eventId: message.event_id,
            responseId: message.response?.id,
            error: message.error?.message,
            itemType: message.item?.type,
            callId: message.call_id || message.item?.call_id
          });
        }

        // Special logging for function calling diagnosis
        if (message.type === 'response.created') {
          console.log('[functionCallDiagnosis] ===== AI RESPONSE CREATED =====');
          console.log('[functionCallDiagnosis] Response ID:', message.response?.id);
          console.log('[functionCallDiagnosis] Response status:', message.response?.status);
          console.log('[functionCallDiagnosis] Response has output:', !!message.response?.output);
          console.log('[functionCallDiagnosis] This means AI is generating a response to user input');
        }

        if (message.type === 'response.function_call_arguments.done') {
          console.log('[functionCallDiagnosis] ===== AI CALLING FUNCTION =====');
          console.log('[functionCallDiagnosis] Function name:', message.name);
          console.log('[functionCallDiagnosis] Function arguments:', message.arguments);
          console.log('[functionCallDiagnosis] Call ID:', message.call_id);
          console.log('[functionCallDiagnosis] AI decided to call a function instead of just responding');
        }

        if (message.type === 'response.done' && message.response?.status === 'completed' && !message.response?.output?.some((item: { type: string }) => item.type === 'function_call')) {
          console.log('[functionCallDiagnosis] ===== AI RESPONSE WITHOUT FUNCTION CALL =====');
          console.log('[functionCallDiagnosis] Response ID:', message.response?.id);
          console.log('[functionCallDiagnosis] Output items:', message.response?.output?.length || 0);
          console.log('[functionCallDiagnosis] Output types:', message.response?.output?.map((item: { type: string }) => item.type) || []);
          console.log('[functionCallDiagnosis] AI chose to respond directly without calling functions');
        }
      } catch {
        // Continue with normal processing if message parsing fails
      }

      // Notify message listeners (comprehensive message handler will process these)
      this.messageListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          optimizedAudioLogger.error('webrtc', 'message_listener_error', error as Error);
        }
      });
    };

    this.dataChannel.onerror = () => {
      const error = new Error('Data channel error');
      optimizedAudioLogger.error('webrtc', 'data_channel_error', error);

      this.errorListeners.forEach(listener => {
        try {
          listener(error);
        } catch (listenerError) {
          optimizedAudioLogger.error('webrtc', 'error_listener_error', listenerError as Error);
        }
      });
    };
  }


  private handleConnectionFailure(): void {
    const error = new Error('WebRTC connection failed');
    this.metrics.lastError = error;

    if (this.metrics.reconnectionAttempts < this.config.retryAttempts!) {
      this.metrics.reconnectionAttempts++;

      optimizedAudioLogger.warn('webrtc', 'connection_failed_retrying', {
        attempt: this.metrics.reconnectionAttempts,
        maxAttempts: this.config.retryAttempts
      });

      // Retry connection after delay
      setTimeout(() => {
        this.connect().catch(retryError => {
          optimizedAudioLogger.error('webrtc', 'reconnection_failed', retryError as Error);
        });
      }, 1000 * this.metrics.reconnectionAttempts);

    } else {
      this.setState('failed');

      this.errorListeners.forEach(listener => {
        try {
          listener(error);
        } catch (listenerError) {
          optimizedAudioLogger.error('webrtc', 'error_listener_error', listenerError as Error);
        }
      });
    }
  }

  private setState(newState: ConnectionState): void {
    if (this.state === newState) return;

    const previousState = this.state;
    this.state = newState;

    console.log('[END_SESSION_FLOW] 🔄 Connection state change:', {
      from: previousState,
      to: newState,
      timestamp: Date.now(),
      listenerCount: this.stateChangeListeners.size
    });

    if (newState === 'disconnected') {
      console.log('[END_SESSION_FLOW] ✅ 16. Final state: DISCONNECTED');
      console.log('[END_SESSION_FLOW] 🎉 End session flow completed successfully');
    }

    optimizedAudioLogger.debug('webrtc', 'state_change', {
      from: previousState,
      to: newState
    });

    // Notify listeners
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        optimizedAudioLogger.error('webrtc', 'state_listener_error', error as Error);
      }
    });
  }

  private cleanup(): void {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Clean up audio input stream
    if (this.audioInputStream) {
      this.audioInputStream.getTracks().forEach(track => track.stop());
      this.audioInputStream = null;
    }

    // Clear listeners
    this.stateChangeListeners.clear();
    this.messageListeners.clear();
    this.errorListeners.clear();
    this.audioStreamListeners.clear();
  }

  private getConnectionDuration(): number | null {
    if (!this.metrics.connectionStartTime) return null;

    const endTime = this.metrics.connectionEndTime || Date.now();
    return endTime - this.metrics.connectionStartTime;
  }

  private async getEphemeralToken(): Promise<string> {
    try {
      optimizedAudioLogger.debug('webrtc', 'fetching_ephemeral_token');

      const sessionPayload = {
        voice: this.config.voice || "alloy",
        instructions: this.config.instructions || "You are a helpful AI companion for mental health support and educational assistance.",
        tools: this.config.tools,
        tool_choice: this.config.tool_choice,
        greetingInstructions: this.config.greetingInstructions
      };

      // Log greeting instructions right after sessionPayload construction
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
        console.log('[resource_greeting] Connection manager: session payload constructed', {
          greetingInstructions: sessionPayload.greetingInstructions || null,
          configGreetingInstructions: this.config.greetingInstructions || null,
          hasGreetingInstructions: !!sessionPayload.greetingInstructions,
          greetingInstructionsLength: sessionPayload.greetingInstructions?.length || 0,
          greetingPreview: sessionPayload.greetingInstructions?.substring(0, 200) + '...' || 'null'
        });
      }

      // Log what we're sending to the session API
      console.log('[functionCallDiagnosis] ===== SESSION API PAYLOAD =====');
      console.log('[functionCallDiagnosis] Voice:', sessionPayload.voice);
      console.log('[functionCallDiagnosis] Instructions preview:', sessionPayload.instructions?.substring(0, 300) + '...' || 'no instructions');
      console.log('[functionCallDiagnosis] Tools count:', sessionPayload.tools?.length || 0);
      console.log('[functionCallDiagnosis] Tool choice:', sessionPayload.tool_choice);

      if (sessionPayload.tools && sessionPayload.tools.length > 0) {
        const resourceFunction = sessionPayload.tools.find((tool: { name: string }) => tool.name === 'search_resources_unified');
        if (resourceFunction) {
          console.log('[functionCallDiagnosis] ✅ search_resources_unified found in session payload');
          console.log('[functionCallDiagnosis] search_resources_unified description in session:', (resourceFunction as { description?: string }).description?.substring(0, 200) + '...');
        } else {
          console.log('[functionCallDiagnosis] ❌ search_resources_unified NOT found in session payload!');
          console.log('[functionCallDiagnosis] Available functions in session:', sessionPayload.tools.map((tool: { name: string }) => tool.name));
        }
      }

      // Log greeting instructions before sending to session API
      if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
        console.log('[resource_greeting] Connection manager: before session API call', {
          greetingInstructions: sessionPayload.greetingInstructions || null,
          hasGreetingInstructions: !!sessionPayload.greetingInstructions,
          greetingInstructionsLength: sessionPayload.greetingInstructions?.length || 0,
          greetingPreview: sessionPayload.greetingInstructions?.substring(0, 200) + '...' || 'null',
          sessionPayloadKeys: Object.keys(sessionPayload).join(', ')
        });
      }

      const response = await fetch("/api/v15/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionPayload),
      });

      if (!response.ok) {
        throw new Error(`Failed to get ephemeral token: ${response.status}`);
      }

      const data = await response.json();

      optimizedAudioLogger.info('webrtc', 'ephemeral_token_received', {
        sessionId: data.id,
        hasToken: !!data.client_secret?.value
      });

      return data.client_secret.value;
    } catch (error) {
      const errorMessage = (error as Error).message;
      const isVoiceConfigError = errorMessage.includes('400') || errorMessage.includes('voice');

      if (isVoiceConfigError) {
        optimizedAudioLogger.error('webrtc', 'voice_configuration_error', error as Error, {
          voiceConfig: this.config.voice,
          suggestion: 'Check voice_settings in database - should be {"voice": "alloy"} format, not just the voice string'
        });
        throw new Error(`Voice configuration error: ${errorMessage}. Check that voice_settings in database contains a valid voice name (alloy, echo, shimmer, ash, ballad, coral, sage, verse).`);
      } else {
        optimizedAudioLogger.error('webrtc', 'ephemeral_token_error', error as Error);
        throw error;
      }
    }
  }

  private async configureSession(): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      // Wait for data channel to open
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            clearInterval(checkInterval);
            this.sendSessionConfig();
            resolve();
          }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          optimizedAudioLogger.warn('webrtc', 'session_config_timeout');
          resolve();
        }, 5000);
      });
    } else {
      this.sendSessionConfig();
    }
  }

  private sendSessionConfig(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      optimizedAudioLogger.error('webrtc', 'session_config_failed', new Error('Data channel not ready'));
      return;
    }

    // Format conversation history for session instructions
    console.log('[systemInstructions] CONNECTION MANAGER: Received config:', {
      hasInstructions: !!this.config.instructions,
      instructionsLength: this.config.instructions?.length || 0,
      instructionsPreview: this.config.instructions?.substring(0, 100) || 'EMPTY',
      hasConversationHistory: !!this.config.conversationHistory,
      conversationHistoryLength: this.config.conversationHistory?.length || 0
    });

    // Instructions now include conversation history from resume flow (if applicable)
    if (!this.config.instructions) {
      const error = new Error('CONFIGURATION ERROR: AI system instructions not provided. This indicates a failure to load the triage prompt from Supabase. Please report this error to developers immediately.');
      optimizedAudioLogger.error('webrtc', 'missing_instructions', error);
      throw error;
    }
    const instructionsWithHistory = this.config.instructions;

    console.log('[systemInstructions] CONNECTION MANAGER: Using instructions (conversation history already included in resume flow):', {
      instructionsLength: instructionsWithHistory.length,
      instructionsPreview: instructionsWithHistory.substring(0, 100)
    });

    // DEBUGGING: Log the complete system instructions being sent to AI
    console.log('[systemInstructions] FINAL: Complete instructions prepared for AI:', {
      originalInstructionsLength: this.config.instructions?.length || 0,
      finalInstructionsLength: instructionsWithHistory?.length || 0,
      hasContent: !!instructionsWithHistory,
      instructionsPreview: instructionsWithHistory?.substring(0, 200) || 'EMPTY',
      instructionsLastPart: instructionsWithHistory?.substring(-200) || 'EMPTY'
    });

    // TODO: if in future user base are people other than at-risk youth, change gpt-4o-transcribe so it is the mental health prompt for r2, but a more general prompt for living books
    // V18: Use config.turnDetection if provided (allows manual push-to-talk mode)
    // When config.turnDetection === null, disables automatic VAD
    // When config.turnDetection === undefined, uses AI_DEFAULTS.turnDetection (automatic VAD)
    const turnDetection = this.config.turnDetection !== undefined
      ? this.config.turnDetection
      : AI_DEFAULTS.turnDetection;

    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: AI_DEFAULTS.modalities,
        instructions: instructionsWithHistory,
        voice: this.config.voice || AI_DEFAULTS.voice,
        input_audio_format: AI_DEFAULTS.inputAudioFormat,
        output_audio_format: AI_DEFAULTS.outputAudioFormat,
        input_audio_transcription: AI_DEFAULTS.inputAudioTranscription,
        turn_detection: turnDetection,
        tools: this.config.tools || [],
        tool_choice: this.config.tool_choice || AI_DEFAULTS.toolChoice
      },
    };

    // Log what we're sending in the session update to OpenAI
    console.log('[functionCallDiagnosis] ===== SESSION UPDATE TO OPENAI =====');
    console.log('[functionCallDiagnosis] Session instructions preview:', sessionUpdate.session.instructions?.substring(0, 300) + '...');
    console.log('[functionCallDiagnosis] Session tools count:', sessionUpdate.session.tools?.length || 0);
    console.log('[functionCallDiagnosis] Session tool_choice:', sessionUpdate.session.tool_choice);
    console.log('[systemInstructions] OPENAI SESSION UPDATE: Instructions length being sent:', sessionUpdate.session.instructions?.length || 0);

    if (sessionUpdate.session.tools && sessionUpdate.session.tools.length > 0) {
      const resourceFunction = sessionUpdate.session.tools.find((tool: { name: string }) => tool.name === 'search_resources_unified');
      if (resourceFunction) {
        console.log('[functionCallDiagnosis] ✅ search_resources_unified found in session update');
        console.log('[functionCallDiagnosis] Final function description sent to OpenAI:', (resourceFunction as { description?: string }).description?.substring(0, 200) + '...');
      } else {
        console.log('[functionCallDiagnosis] ❌ search_resources_unified NOT found in session update!');
        console.log('[functionCallDiagnosis] Functions sent to OpenAI:', sessionUpdate.session.tools.map((tool: { name: string }) => tool.name));
      }
    } else {
      console.log('[functionCallDiagnosis] ❌ NO TOOLS sent to OpenAI in session update!');
    }

    try {
      this.dataChannel.send(JSON.stringify(sessionUpdate));

      if (process.env.ENABLE_V15_TRANSCRIPT_DEBUG_LOGS === 'true') {
        console.log('[V15-TRANSCRIPT-DEBUG] Session configured with optimized transcription settings:', {
          transcriptionModel: sessionUpdate.session.input_audio_transcription.model,
          language: sessionUpdate.session.input_audio_transcription.language,
          silenceDuration: turnDetection?.silence_duration_ms || 'manual_mode',
          turnDetectionMode: turnDetection ? 'automatic' : 'manual'
        });
      }

      optimizedAudioLogger.info('webrtc', 'session_configured', {
        hasTools: !!(this.config.tools && this.config.tools.length > 0),
        toolCount: this.config.tools?.length || 0,
        voice: this.config.voice,
        tool_choice: this.config.tool_choice,
        transcriptionModel: sessionUpdate.session.input_audio_transcription.model,
        silenceDuration: turnDetection?.silence_duration_ms || 'manual_mode',
        turnDetectionMode: turnDetection ? (turnDetection.create_response === false ? 'vad_manual_response' : 'automatic') : 'fully_manual',
        createResponse: turnDetection?.create_response ?? 'default',
        optimizedForStreaming: true
      });

      // V18: Check if using server VAD with manual response (create_response: false)
      const isManualResponseMode = turnDetection && turnDetection.create_response === false;

      if (isManualResponseMode) {
        console.log('[V18-MANUAL-VAD] Server VAD with manual response control - waiting for session.updated...');
        this.waitForSessionUpdateConfirmation().then((confirmed) => {
          if (confirmed) {
            console.log('[V18-MANUAL-VAD] Session confirmed, sending initial greeting');
            this.sendInitialGreeting();
          } else {
            console.warn('[V18-MANUAL-VAD] Session update timeout, sending greeting anyway');
            this.sendInitialGreeting();
          }
        });
      } else {
        // Standard automatic VAD mode (V16) or fully manual mode
        setTimeout(() => {
          this.sendInitialGreeting();
        }, 500); // Small delay to ensure session update is processed
      }

    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'session_config_send_failed', error as Error);
    }
  }

  private sendInitialGreeting(): void {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      optimizedAudioLogger.warn('webrtc', 'greeting_data_channel_not_ready', {
        dataChannelExists: !!this.dataChannel,
        readyState: this.dataChannel?.readyState || 'null'
      });
      return;
    }

    try {
      optimizedAudioLogger.info('webrtc', 'sending_initial_greeting', {
        greetingInstructions: this.config.greetingInstructions,
        hasInstructions: !!this.config.greetingInstructions,
        isResume: this.config.isResume
      });

      if (this.config.isResume) {
        // For resume: inject conversation item that prompts AI to welcome back
        const greetingInjection = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{
              type: "input_text",
              text: "Please welcome me back and acknowledge our previous conversation history, then ask how you can continue to help me today."
            }]
          }
        };

        this.dataChannel.send(JSON.stringify(greetingInjection));

        // Then create response without custom instructions
        setTimeout(() => {
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const response = {
              type: "response.create",
              response: {
                modalities: ["text", "audio"],
                max_output_tokens: 2000
              }
            };

            this.dataChannel.send(JSON.stringify(response));

            optimizedAudioLogger.info('webrtc', 'resume_greeting_injection_sent', {
              approach: 'conversation_item_injection'
            });
          }
        }, 1000);

      } else {
        // For new conversations: use original approach
        // Send empty message first like V11 does
        const message = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: " ", // Use a space instead of empty string like V11
              },
            ],
          },
        };

        this.dataChannel.send(JSON.stringify(message));

        // Then send response.create with greeting instructions after delay
        setTimeout(() => {
          if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const greetingInstructions = this.config.greetingInstructions;

            if (!greetingInstructions) {
              // For new conversations without specific greeting instructions, use basic response creation
              console.log('[functionCallDiagnosis] No greeting instructions provided, using basic response creation');
              const response = {
                type: "response.create",
                response: {
                  modalities: ["text", "audio"],
                  max_output_tokens: 2000
                }
              };

              this.dataChannel.send(JSON.stringify(response));

              optimizedAudioLogger.info('webrtc', 'basic_initial_response_sent', {
                hasCustomGreeting: false
              });
            } else {
              // Log greeting instructions being sent to AI
              if (process.env.NEXT_PUBLIC_ENABLE_RESOURCE_GREETING_LOGS === 'true') {
                console.log('[resource_greeting] Connection manager: sending greeting to AI', {
                  greetingInstructions: greetingInstructions,
                  hasGreetingInstructions: !!greetingInstructions,
                  greetingInstructionsLength: greetingInstructions.length,
                  greetingPreview: greetingInstructions.substring(0, 200) + '...',
                  source: 'connection_manager_sendInitialGreeting'
                });
              }

              const response = {
                type: "response.create",
                response: {
                  modalities: ["text", "audio"],
                  instructions: greetingInstructions,
                  max_output_tokens: 2000
                }
              };

              this.dataChannel.send(JSON.stringify(response));

              optimizedAudioLogger.info('webrtc', 'initial_greeting_sent', {
                instructionsLength: greetingInstructions.length
              });
            }
          }
        }, 1000); // Use same 1000ms delay as V11
      }

    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'initial_greeting_failed', error as Error);
    }
  }

  private getRTCStats(): Record<string, unknown> {
    // TODO: Implement actual RTC stats collection
    return {
      placeholder: 'RTC stats collection not yet implemented'
    };
  }

  /**
   * Create a minimal silent audio stream for WebRTC when microphone permission is denied
   * This allows the connection to proceed with text input and audio output
   */
  private async createSilentAudioStream(): Promise<MediaStream> {
    try {
      // Create an AudioContext to generate a silent audio track
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // Create a silent oscillator (frequency set to 0)
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      // Set gain to 0 for complete silence
      gainNode.gain.value = 0;

      // Connect oscillator to gain node
      oscillator.connect(gainNode);

      // Create media stream destination
      const destination = audioContext.createMediaStreamDestination();
      gainNode.connect(destination);

      // Start the oscillator
      oscillator.start();

      optimizedAudioLogger.info('webrtc', 'silent_audio_context_created', {
        contextState: audioContext.state,
        sampleRate: audioContext.sampleRate,
        destinationChannels: destination.channelCount
      });

      return destination.stream;
    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'silent_stream_creation_failed', error as Error);
      throw new Error('Failed to create silent audio stream');
    }
  }
}