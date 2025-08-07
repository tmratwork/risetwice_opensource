// src/hooksV15/webrtc/use-webrtc-v15.ts

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from 'react';
import { optimizedAudioLogger } from '../audio/optimized-audio-logger';
import { ComprehensiveMessageHandler, type MessageHandlerCallbacks } from './comprehensive-message-handler';
import audioService from '../audio/audio-service';
import { ConnectionManager } from './connection-manager';
import { useBookFunctionsV15 } from '../functions/use-book-functions-v15';
import { useMentalHealthFunctionsV15 } from '../functions/use-mental-health-functions-v15';
import type { WebRTCV15Return, ConnectionConfig } from '../types';

/**
 * AI Volume Monitor Class
 * 
 * Monitors AI audio volume to detect when AI actually stops speaking
 * Used for end session detection with infinite duration WebRTC streams
 */
class AIVolumeMonitor {
  private audioElement: HTMLAudioElement;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private isMonitoring = false;
  private silentTime = 0;
  private readonly checkInterval = 100; // Check every 100ms
  private readonly silenceThreshold = 0.01; // Adjust based on testing
  private readonly silenceDuration = 2000; // 2 seconds of silence
  private monitoringInterval: number | null = null;

  constructor(audioElement: HTMLAudioElement) {
    this.audioElement = audioElement;
  }

  private setupAnalyser(): boolean {

    // TODO: remove code below when ready to go live
    // let creatingTypeScriptError = "not ready to go llive with this version, but want to save to GH";

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();

      // Connect to existing audio element
      const source = this.audioContext.createMediaElementSource(this.audioElement);
      source.connect(this.analyser);
      source.connect(this.audioContext.destination); // Maintain playback

      this.analyser.fftSize = 256;
      console.log('[connection] ✅ AI volume monitoring setup complete');
      return true;
    } catch (error) {
      console.error('❌ Failed to setup volume monitoring:', error);
      return false;
    }
  }

  private measureVolume(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS (Root Mean Square) for volume
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    return rms / 255; // Normalize to 0-1
  }

  public startMonitoring(onComplete: () => void): void {
    console.log('[function] 🎚️ AIVolumeMonitor.startMonitoring() called');

    if (this.isMonitoring) {
      console.log('[function] ⚠️ Already monitoring - returning early');
      return;
    }

    if (!this.analyser && !this.setupAnalyser()) {
      console.error('[function] ❌ Cannot start monitoring - analyser setup failed');
      // Fallback timeout
      setTimeout(onComplete, 3000);
      return;
    }

    this.isMonitoring = true;
    this.silentTime = 0;

    console.log('[END_SESSION_FLOW] 🎯 8. AI volume monitoring starting');
    console.log('[END_SESSION_FLOW] 🎛️ Monitoring config:', {
      checkInterval: this.checkInterval,
      silenceThreshold: this.silenceThreshold,
      silenceDuration: this.silenceDuration,
      audioElement: !!this.audioElement
    });
    
    console.log('[function] 🔊 Starting AI volume monitoring...');
    console.log('[function] 🎛️ Monitoring configuration:', {
      checkInterval: this.checkInterval,
      silenceThreshold: this.silenceThreshold,
      silenceDuration: this.silenceDuration
    });

    this.monitoringInterval = window.setInterval(() => {
      const volume = this.measureVolume();

      if (volume < this.silenceThreshold) {
        this.silentTime += this.checkInterval;
        console.log(`[END_SESSION_FLOW] 🔊 Volume check: ${volume.toFixed(4)} (threshold: ${this.silenceThreshold})`);
        console.log(`[END_SESSION_FLOW] 🕐 Silent time: ${this.silentTime}ms / ${this.silenceDuration}ms`);
        
        console.log(`[function] 🔇 Checking silence - silentTime: ${this.silentTime}ms`);
        console.log(`[function] 📈 Current volume level: ${volume.toFixed(4)}`);

        if (this.silentTime >= this.silenceDuration) {
          console.log('[END_SESSION_FLOW] ✅ 9. Silence threshold reached - AI finished speaking');
          console.log('[END_SESSION_FLOW] 🔄 Triggering final disconnect');
          
          console.log('[function] ✅ Silence detected - triggering disconnect');
          console.log('[connection] ✅ AI finished speaking - safe to disconnect');
          this.stopMonitoring();
          onComplete();
        }
      } else {
        this.silentTime = 0; // Reset timer when audio detected
        console.log(`[function] 🔊 AI speaking (volume: ${volume.toFixed(4)})`);
      }
    }, this.checkInterval);

    // Failsafe timeout
    setTimeout(() => {
      if (this.isMonitoring) {
        console.log('[function] ⏰ Volume monitoring timeout - forcing completion');
        console.log('[connection] ⏰ Volume monitoring timeout - forcing completion');
        this.stopMonitoring();
        onComplete();
      }
    }, 8000); // 8 second maximum wait
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('[connection] 🛑 AI volume monitoring stopped');
  }
}

/**
 * Clean WebRTC Hook for V15
 * 
 * Modern React hook that provides:
 * - Unified message processing (no parallel paths)
 * - Clean state management
 * - Built-in diagnostics
 * - Proper TypeScript typing
 * - Consistent error handling
 */

export function useWebRTCV15(config: ConnectionConfig = {}): WebRTCV15Return {
  console.log('🚨 [connection] RENDER STORM: Hook function called again at', new Date().toISOString());
  console.log('[connection] 🔍 CRITICAL: Parent component is re-rendering constantly!');

  // COMPONENT MOUNT DEBUGGING: Track if component is re-mounting
  const componentMountId = useRef(`mount-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  console.log('[connection] 🔍 Component mount ID:', componentMountId.current);

  // RENDER DEBUGGING: Track hook renders with timing
  const hookRenderCount = useRef(0);
  const renderStartTime = useRef(Date.now());
  hookRenderCount.current += 1;

  const currentTime = Date.now();
  const timeSinceStart = currentTime - renderStartTime.current;
  const avgRenderRate = hookRenderCount.current / (timeSinceStart / 1000);

  console.log(`[connection] 🔄 useWebRTCV15 render #${hookRenderCount.current}`);

  // Log render rate every 10 renders to track improvement
  if (hookRenderCount.current % 10 === 0) {
    console.log(`[connection] 🔄 Render #${hookRenderCount.current}:`, {
      timeSinceStart: `${timeSinceStart}ms`,
      avgRenderRate: `${avgRenderRate.toFixed(2)} renders/sec`,
      timestamp: new Date().toISOString(),
      note: 'FIXED_STABLE_CONFIG_DEPENDENCIES'
    });
  }

  // Core state with React 18+ patterns
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('disconnected');

  // Debug state changes
  const prevIsConnected = useRef<boolean>(false);
  const prevConnectionState = useRef<string>('disconnected');

  // Track state changes to verify fix effectiveness
  useEffect(() => {
    if (prevIsConnected.current !== isConnected) {
      console.log('[connection] 🔄 isConnected changed:', {
        from: prevIsConnected.current,
        to: isConnected,
        renderNumber: hookRenderCount.current
      });
      prevIsConnected.current = isConnected;
    }
  }, [isConnected]);

  useEffect(() => {
    if (prevConnectionState.current !== connectionState) {
      console.log('[connection] 🔄 connectionState changed:', {
        from: prevConnectionState.current,
        to: connectionState,
        renderNumber: hookRenderCount.current
      });
      prevConnectionState.current = connectionState;
    }
  }, [connectionState]);

  // AGGRESSIVE FIX: Move audio monitoring to refs to eliminate re-render storm
  const audioLevelRef = useRef(0);
  const isAudioPlayingRef = useRef(false);
  const audioStatePlayingRef = useRef(false);
  // V15 greenfield end session flow
  const expectingEndSessionGoodbye = useRef(false);
  const waitingForEndSessionRef = useRef(false);
  const endSessionCallId = useRef<string | null>(null);

  // Smart fallback system
  const volumeMonitoringActiveRef = useRef(false);
  const fallbackTimeoutIdRef = useRef<number | null>(null);

  // React 18+ Transition for non-urgent updates (currently unused but may be needed later)
  // const [, startNonUrgentTransition] = useTransition();

  // Function hooks
  const bookFunctions = useBookFunctionsV15();
  const mentalHealthFunctions = useMentalHealthFunctionsV15();

  // Stable references (persistent across renders)
  const connectionManagerRef = useRef<ConnectionManager | null>(null);
  const messageHandlerRef = useRef<ComprehensiveMessageHandler | null>(null);
  const transcriptCallbackRef = useRef<((message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) | null>(null);
  const instanceIdRef = useRef(`webrtc-v15-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Audio event subscription for goodbye completion detection (currently unused)
  // const audioEventUnsubscribeRef = useRef<(() => void) | null>(null);

  // AI Volume Monitor for detecting when AI actually stops speaking
  const volumeMonitorRef = useRef<AIVolumeMonitor | null>(null);

  // AI Volume Monitoring Function with Smart Retry
  const startAIVolumeMonitoring = useCallback(() => {
    console.log('[function] 🎧 Volume monitoring started for end session');
    console.log('[function] ⏱️ Monitoring intervals starting');

    let attempts = 0;
    const maxAttempts = 6; // Try for ~1.8 seconds total
    const retryInterval = 300; // Every 300ms

    const disconnectSafely = () => {
      if (waitingForEndSessionRef.current && connectionManagerRef.current) {
        // STATE-HANDOFF: Log fallback disconnect state
        console.log('[connection] 🔍 [STATE-HANDOFF] Fallback pre-disconnect session state:', {
          waitingForEndSession: waitingForEndSessionRef.current,
          endSessionCallId: endSessionCallId.current,
          expectingGoodbye: expectingEndSessionGoodbye.current,
          sessionPhase: 'fallback_timeout_disconnect',
          connectionState: connectionManagerRef.current?.getState(),
          volumeMonitoringMethod: 'fallback_timeout',
          timestamp: Date.now()
        });

        // STATE-HANDOFF: Log fallback disconnect context
        console.log('[connection] 🔄 [STATE-HANDOFF] Calling connectionManager.disconnect() with fallback context:', {
          reason: 'volume_monitoring_fallback',
          expectedState: 'should_be_ending_session',
          callId: endSessionCallId.current,
          completionMethod: 'fallback_timeout'
        });

        optimizedAudioLogger.info('session', 'ai_volume_monitoring_complete', {
          method: 'fallback_timeout',
          disconnectingNow: true
        });

        // Reset all end session state
        waitingForEndSessionRef.current = false;
        endSessionCallId.current = null;
        expectingEndSessionGoodbye.current = false;

        // Disconnect safely using same method as button
        console.log('[function] 🔄 Fallback disconnect calling disconnect() (same as button)');
        disconnect();

        // Cleanup volume monitor if it exists
        if (volumeMonitorRef.current) {
          volumeMonitorRef.current.stopMonitoring();
          volumeMonitorRef.current = null;
        }
      }
    };

    const startVolumeMonitoringWithElement = (audioElement: HTMLAudioElement) => {
      console.log('[connection] 🎵 Found audio element for volume monitoring:', {
        id: audioElement.id,
        currentTime: audioElement.currentTime,
        duration: audioElement.duration,
        paused: audioElement.paused,
        ended: audioElement.ended
      });

      // Check if audio is actually playing
      if (audioElement.paused || audioElement.ended) {
        console.log('[connection] ✅ Audio element found but not playing - safe to disconnect');

        // STATE-HANDOFF: Log audio not playing scenario
        console.log('[connection] 🔍 [STATE-HANDOFF] Audio not playing pre-disconnect state:', {
          waitingForEndSession: waitingForEndSessionRef.current,
          endSessionCallId: endSessionCallId.current,
          sessionPhase: 'audio_found_but_not_playing',
          audioState: { paused: audioElement.paused, ended: audioElement.ended },
          connectionState: connectionManagerRef.current?.getState(),
          completionMethod: 'audio_already_stopped',
          timestamp: Date.now()
        });

        disconnectSafely();
        return;
      }

      // Set volume monitoring as active and clear fallback timeout
      volumeMonitoringActiveRef.current = true;

      // Clear the fallback timeout since volume monitoring is starting
      if (fallbackTimeoutIdRef.current) {
        clearTimeout(fallbackTimeoutIdRef.current);
        fallbackTimeoutIdRef.current = null;
        console.log('[function] ⏰ Fallback timeout cleared - volume monitoring active');
      }

      // Create volume monitor if it doesn't exist
      if (!volumeMonitorRef.current) {
        volumeMonitorRef.current = new AIVolumeMonitor(audioElement);
      }

      // Start monitoring with completion callback
      volumeMonitorRef.current.startMonitoring(() => {
        console.log('[function] ✅ Volume monitoring completed naturally');
        console.log('[connection] 🔚 AI has finished speaking - proceeding with disconnect');

        // Clear fallback timeout if it still exists (shouldn't, but safety)
        if (fallbackTimeoutIdRef.current) {
          clearTimeout(fallbackTimeoutIdRef.current);
          fallbackTimeoutIdRef.current = null;
          console.log('[function] 🧹 Fallback timeout cleared - natural completion');
        }

        // STATE-HANDOFF: Log complete session state before disconnect
        console.log('[connection] 🔍 [STATE-HANDOFF] Pre-disconnect session state:', {
          waitingForEndSession: waitingForEndSessionRef.current,
          endSessionCallId: endSessionCallId.current,
          expectingGoodbye: expectingEndSessionGoodbye.current,
          sessionPhase: 'ai_volume_monitoring_complete',
          connectionState: connectionManagerRef.current?.getState(),
          volumeMonitoringMethod: 'silence_detection',
          timestamp: Date.now()
        });

        // STATE-HANDOFF: Log what we're telling the connection manager
        console.log('[connection] 🔄 [STATE-HANDOFF] Calling connectionManager.disconnect() with context:', {
          reason: 'ai_volume_monitoring_complete',
          expectedState: 'should_be_ending_session',
          callId: endSessionCallId.current,
          completionMethod: 'silence_detection'
        });

        optimizedAudioLogger.info('session', 'ai_volume_monitoring_complete', {
          method: 'silence_detection',
          disconnectingNow: true
        });

        // Reset all end session state
        waitingForEndSessionRef.current = false;
        endSessionCallId.current = null;
        expectingEndSessionGoodbye.current = false;
        volumeMonitoringActiveRef.current = false;

        // Disconnect when AI is actually done speaking - use SAME method as button
        console.log('[function] 🔄 Calling disconnect() method (same as button click)');
        disconnect();

        // Cleanup volume monitor
        if (volumeMonitorRef.current) {
          volumeMonitorRef.current.stopMonitoring();
          volumeMonitorRef.current = null;
        }
      });
    };

    const findAndMonitorAudio = () => {
      const audioElement = document.querySelector('audio') as HTMLAudioElement;

      console.log('[function] 🔍 Searching for audio element, attempt:', attempts + 1);
      console.log('[function] 🎛️ Audio element found:', !!audioElement);

      if (audioElement) {
        console.log(`[connection] ✅ Audio element found on attempt ${attempts + 1}`);
        console.log('[function] 🎚️ Audio element details:', {
          id: audioElement.id,
          paused: audioElement.paused,
          ended: audioElement.ended,
          currentTime: audioElement.currentTime,
          duration: audioElement.duration
        });

        // STATE-SYNC: Log volume monitoring startup state
        console.log('[connection] 🎯 [STATE-SYNC] Volume monitoring starting:', {
          sessionPhase: 'server_audio_done_received',
          waitingForEndSession: waitingForEndSessionRef.current,
          callId: endSessionCallId.current,
          connectionState: connectionManagerRef.current?.getState(),
          audioElementId: audioElement.id,
          timestamp: Date.now()
        });

        startVolumeMonitoringWithElement(audioElement);
        return;
      }

      attempts++;

      if (attempts >= maxAttempts) {
        console.error(`[function] ❌ No audio element found after ${attempts} attempts over ${attempts * retryInterval}ms`);
        console.log('[function] 🔍 Audio element search failed - checking DOM state');
        console.log('[function] 🎛️ Available audio elements:', document.querySelectorAll('audio').length);
        console.log('[function] 🎛️ Available media elements:', document.querySelectorAll('video, audio').length);

        // Volume monitoring failed - trigger immediate fallback
        console.log('[function] ❌ Volume monitoring failed to start - no audio element found');
        volumeMonitoringActiveRef.current = false;

        // Clear the smart fallback timeout since we're handling this failure immediately
        if (fallbackTimeoutIdRef.current) {
          clearTimeout(fallbackTimeoutIdRef.current);
          fallbackTimeoutIdRef.current = null;
          console.log('[function] 🧹 Smart fallback timeout cleared - handling failure immediately');
        }

        // Intelligent fallback decision
        if (attempts <= 3) {
          // Short attempts = likely no audio at all, disconnect quickly
          console.log('[function] 🚀 Fast fallback - likely no audio playing');
          setTimeout(disconnectSafely, 500);
        } else {
          // Longer attempts = possible timing issue, wait a bit more
          console.log('[function] ⏰ Extended fallback - possible audio through different mechanism');
          setTimeout(disconnectSafely, 2500);
        }
        return;
      }

      console.log(`[function] 🔍 Audio element search attempt ${attempts}/${maxAttempts}`);
      setTimeout(findAndMonitorAudio, retryInterval);
    };

    findAndMonitorAudio();
  }, []);

  // V15 Native Audio Service Event Subscription for End Session
  useEffect(() => {
    // Browser audio completion detection approach implemented
    optimizedAudioLogger.info('debug', 'v15_end_session_approach', {
      method: 'browser_audio_completion_detection',
      reason: 'webrtc_audio_done_fires_too_early'
    });

    // Audio service events not used - browser audio completion detection used instead
    return () => { }; // Empty cleanup function
  }, []); // Empty deps - stable subscription

  // V15 REMOVED: Event dispatch system replaced with direct disconnect

  // End session now uses immediate dispatch (V11 style) - complex completion checking removed

  // Audio level monitoring - REMOVED: requestAnimationFrame loop was causing infinite updates
  // Audio levels should come from actual WebRTC audio data, not synthetic animation loops
  // Real audio levels will be provided by the connection manager via WebRTC audio streams

  // Debug the function hooks before the useEffect to see if they're stable
  console.log('[connection] 🔍 SUBSCRIPTION DEPS: Function hooks state check', {
    bookFunctionsRef: bookFunctions,
    mentalHealthFunctionsRef: mentalHealthFunctions,
    bookFunctionCount: bookFunctions.getAvailableFunctions.length,
    mentalHealthFunctionCount: mentalHealthFunctions.getAvailableFunctions.length,
    renderNumber: hookRenderCount.current
  });

  // Initialize services - FIXED: Single stable effect that only runs once  
  useEffect(() => {
    console.log('[connection] 🔍 SUBSCRIPTION EFFECT: Running due to dependency change');
    console.log('[connection] 🔍 SUBSCRIPTION EFFECT: Empty dependency array - should only run once');
    console.log('[connection] 🔍 Setting up connection subscription at', new Date().toISOString());

    optimizedAudioLogger.debug('webrtc', 'hook_initializing_fixed', {
      instanceId: instanceIdRef.current,
      hookInitializationCause: 'component_mount_ONCE_ONLY'
    });

    // Get function definitions for AI
    const bookFunctionDefinitions = bookFunctions.getAvailableFunctions;
    const mentalHealthFunctionDefinitions = mentalHealthFunctions.getAvailableFunctions;
    const allFunctionDefinitions = [...bookFunctionDefinitions, ...mentalHealthFunctionDefinitions];
    
    // Log function definitions being sent to AI
    console.log('[functionCallDiagnosis] ===== FUNCTION DEFINITIONS SENT TO AI =====');
    console.log('[functionCallDiagnosis] Total functions:', allFunctionDefinitions.length);
    console.log('[functionCallDiagnosis] Book functions:', bookFunctionDefinitions.length);
    console.log('[functionCallDiagnosis] Mental health functions:', mentalHealthFunctionDefinitions.length);
    
    const resourceSearchFunction = allFunctionDefinitions.find(f => f.name === 'search_resources_unified');
    if (resourceSearchFunction) {
      console.log('[functionCallDiagnosis] ✅ search_resources_unified found in definitions');
      console.log('[functionCallDiagnosis] search_resources_unified description:', resourceSearchFunction.description?.substring(0, 200) + '...');
      console.log('[functionCallDiagnosis] search_resources_unified parameters:', Object.keys(resourceSearchFunction.parameters?.properties || {}));
    } else {
      console.log('[functionCallDiagnosis] ❌ search_resources_unified NOT found in function definitions!');
    }

    // Create connection manager with functions for AI
    const connectionConfig: ConnectionConfig = {
      ...config,
      tools: allFunctionDefinitions,
      tool_choice: 'auto' as const
    };
    
    // Log final config being sent to AI
    console.log('[functionCallDiagnosis] Connection config tools count:', connectionConfig.tools?.length || 0);
    console.log('[functionCallDiagnosis] Tool choice:', connectionConfig.tool_choice);

    connectionManagerRef.current = new ConnectionManager(connectionConfig);
    
    // Log connection manager creation
    console.log('[functionCallDiagnosis] Connection manager created with config');
    console.log('[functionCallDiagnosis] Instructions preview:', config.instructions?.substring(0, 300) + '...' || 'no instructions');
    console.log('[functionCallDiagnosis] Greeting instructions preview:', config.greetingInstructions?.substring(0, 300) + '...' || 'no greeting');

    optimizedAudioLogger.debug('webrtc', 'connection_manager_created', {
      note: 'functions_will_be_accessed_in_callbacks_not_pre_computed'
    });

    // Subscribe to connection state changes
    const unsubscribeConnection = connectionManagerRef.current.onStateChange((state) => {
      console.log('[connection] 🔍 onStateChange called with state:', state);

      setConnectionState(state);
      const newIsConnected = state === 'connected';

      console.log('[connection] 🔍 setting isConnected:', newIsConnected, 'from state:', state);

      setIsConnected(newIsConnected);

      optimizedAudioLogger.debug('webrtc', 'state_change', {
        newState: state,
        instanceId: instanceIdRef.current
      });
    });

    // Create comprehensive message handler with inline callbacks
    const messageCallbacks: MessageHandlerCallbacks = {
      onFunctionCall: async (msg: Record<string, unknown>) => {
        const functionName = msg.name as string;
        const callId = msg.call_id as string;
        const argumentsStr = msg.arguments as string;

        try {
          const parsedArgs = JSON.parse(argumentsStr);
          
          // Special logging for resource search function
          if (functionName === 'search_resources_unified') {
            console.log(`[resources] ===== AI CALLING RESOURCE SEARCH FUNCTION =====`);
            console.log(`[resources] Function call received from AI via WebRTC`);
            console.log(`[resources] Function name: ${functionName}`);
            console.log(`[resources] Call ID: ${callId}`);
            console.log(`[resources] Arguments:`, parsedArgs);
            console.log(`[resources] This should trigger resource search with notification`);
          }
          
          optimizedAudioLogger.info('function', 'function_call_received', {
            functionName,
            callId,
            args: parsedArgs
          });

          // Get the function from registered functions
          const bookFunctionRegistry = bookFunctions.functionRegistry;
          const mentalHealthFunctionRegistry = mentalHealthFunctions.functionRegistry;

          // Convert to generic format for consistent access
          const allFunctionRegistry: Record<string, (args: unknown) => Promise<unknown>> = {};
          Object.entries(bookFunctionRegistry).forEach(([name, fn]) => {
            allFunctionRegistry[name] = fn as (args: unknown) => Promise<unknown>;
          });
          Object.entries(mentalHealthFunctionRegistry).forEach(([name, fn]) => {
            allFunctionRegistry[name] = fn as (args: unknown) => Promise<unknown>;
          });

          // Special logging for resource search function
          if (functionName === 'search_resources_unified') {
            console.log(`[resources] Looking up function in combined registry`);
            console.log(`[resources] Total functions available: ${Object.keys(allFunctionRegistry).length}`);
            console.log(`[resources] Resource functions available:`, Object.keys(allFunctionRegistry).filter(name => name.includes('resource')));
            console.log(`[resources] Function found in registry:`, functionName in allFunctionRegistry);
          }

          const fn = allFunctionRegistry[functionName];
          if (fn) {
            if (functionName === 'search_resources_unified') {
              console.log(`[resources] ===== EXECUTING RESOURCE SEARCH FUNCTION =====`);
              console.log(`[resources] About to call resourceSearchFunction with args:`, parsedArgs);
              console.log(`[resources] This should return a message starting with notification`);
            }
            
            const result = await fn(parsedArgs);
            
            if (functionName === 'search_resources_unified') {
              console.log(`[resources] ===== RESOURCE SEARCH FUNCTION COMPLETED =====`);
              console.log(`[resources] Function execution completed`);
              console.log(`[resources] Result type:`, typeof result);
              console.log(`[resources] Result success:`, (result as { success?: boolean }).success);
              console.log(`[resources] Result message preview:`, (result as { message?: string }).message?.substring(0, 200) + '...' || 'no message');
              console.log(`[resources] This result will be sent back to AI via WebRTC`);
            }

            optimizedAudioLogger.info('function', 'function_completed_expectations', {
              functionName,
              callId,
              expectedNextEvents: ['conversation.item.created for function_call_output', 'response.created', 'response.done'],
              shouldDisconnectNow: false,
              shouldWaitFor: 'ai_response_and_audio_completion',
              currentState: 'waiting_for_ai_response_to_function_result'
            });

            // Send function result back using connection manager
            if (connectionManagerRef.current) {
              if (functionName === 'search_resources_unified') {
                console.log(`[resources] ===== SENDING RESULT BACK TO AI =====`);
                console.log(`[resources] About to send function result back to AI via WebRTC`);
                console.log(`[resources] Result message that AI should speak:`, (result as { message?: string }).message?.substring(0, 300) + '...' || 'no message');
                console.log(`[resources] AI should now speak this message which starts with notification`);
              }
              
              // Enhanced AI interaction logging for function result
              console.log('[AI-INTERACTION] ===== FUNCTION RESULT SENT TO AI =====');
              console.log('[AI-INTERACTION] Function executed:', functionName);
              console.log('[AI-INTERACTION] Result sent to AI for:', callId);
              console.log('[AI-INTERACTION] Result preview:', JSON.stringify(result).substring(0, 200) + '...');
              console.log('[AI-INTERACTION] Next: waiting for AI to speak the function result');
              
              const success = connectionManagerRef.current.sendFunctionResult(callId, result);
              if (success) {
                optimizedAudioLogger.info('function', 'function_result_sent', { functionName, callId });
                
                if (functionName === 'search_resources_unified') {
                  console.log(`[resources] ✅ Function result sent successfully to AI`);
                  console.log(`[resources] AI should now process this result and speak the message`);
                  console.log(`[resources] If AI does not speak notification first, the issue is in AI processing`);
                }

                // For end_session, track that we're expecting a goodbye response
                if (functionName === 'end_session' && (result as { success?: boolean }).success) {
                  console.log('[END_SESSION_FLOW] 🎯 3. end_session result detected as successful');
                  console.log('[END_SESSION_FLOW] 📊 Setting expectingEndSessionGoodbye=true');
                  console.log('[END_SESSION_FLOW] 🔗 Call ID:', callId);
                  
                  expectingEndSessionGoodbye.current = true;
                  endSessionCallId.current = callId;

                  console.log('[function] 🎯 end_session result sent → expectingEndSessionGoodbye=true, callId=' + callId);
                  console.log('[function] ⏰ Setting fallback timeout for voice-activated end session');
                  console.log('[END_SESSION_FLOW] ⏰ Starting smart fallback timeout (15s)');

                  optimizedAudioLogger.info('debug', 'end_session_function_acknowledged', {
                    callId,
                    expectingGoodbye: true,
                    nextStep: 'waiting_for_goodbye_response'
                  });

                  // SMART FALLBACK: Only activates if volume monitoring fails to start
                  fallbackTimeoutIdRef.current = window.setTimeout(() => {
                    const isVolumeMonitoringActive = volumeMonitoringActiveRef.current;
                    const needsFallback = expectingEndSessionGoodbye.current || waitingForEndSessionRef.current;

                    console.log('[END_SESSION_FLOW] ⏰ Smart fallback timeout check:', {
                      isVolumeMonitoringActive,
                      needsFallback,
                      expectingGoodbye: expectingEndSessionGoodbye.current,
                      waitingForEndSession: waitingForEndSessionRef.current,
                      timeoutReason: 'volume_monitoring_failed_to_start'
                    });

                    if (!isVolumeMonitoringActive && needsFallback) {
                      console.log('[END_SESSION_FLOW] 🚨 FALLBACK: Volume monitoring never started - forcing disconnect');
                      console.log('[function] 🚨 Smart fallback triggered - volume monitoring never started');
                      console.log('[function] Current state:', {
                        expectingGoodbye: expectingEndSessionGoodbye.current,
                        waitingForEndSession: waitingForEndSessionRef.current,
                        volumeMonitoringActive: isVolumeMonitoringActive,
                        callId: endSessionCallId.current
                      });

                      optimizedAudioLogger.warn('session', 'smart_fallback_timeout', {
                        reason: 'volume_monitoring_failed_to_start',
                        volumeMonitoringActive: isVolumeMonitoringActive,
                        forcingDisconnect: true
                      });

                      // Reset all end session state
                      expectingEndSessionGoodbye.current = false;
                      waitingForEndSessionRef.current = false;
                      endSessionCallId.current = null;
                      volumeMonitoringActiveRef.current = false;

                      // Force disconnect using same method as button
                      console.log('[function] 🔌 Smart fallback calling disconnect() (same as button)');
                      disconnect();
                    } else if (isVolumeMonitoringActive) {
                      console.log('[function] 🎯 Smart fallback skipped - volume monitoring is active');
                    } else {
                      console.log('[function] ✅ Smart fallback skipped - graceful flow completed');
                    }

                    // Clear the timeout reference
                    fallbackTimeoutIdRef.current = null;
                  }, 15000); // 15 second timeout since it's only for failure cases
                }
              } else {
                optimizedAudioLogger.error('function', 'function_result_send_failed', new Error('Failed to send function result'));
              }
            } else {
              optimizedAudioLogger.error('function', 'function_result_send_failed', new Error('Connection manager not available'));
            }
          } else {
            optimizedAudioLogger.error('function', 'function_not_found', new Error(`Function ${functionName} not registered`));
          }

        } catch (error) {
          optimizedAudioLogger.error('function', 'function_call_failed', error as Error, { functionName, callId });
        }
      },
      onAudioTranscriptDelta: (msg: Record<string, unknown>) => {
        const delta = msg.delta as string;
        const responseId = msg.response_id as string || 'unknown';

        if (delta && transcriptCallbackRef.current) {
          transcriptCallbackRef.current({
            id: responseId,
            data: delta,
            metadata: { isTranscriptComplete: false }
          });
        }
      },
      onAudioTranscriptDone: (msg: Record<string, unknown>) => {
        const transcript = msg.transcript as string;
        const responseId = msg.response_id as string || 'unknown';

        if (transcript && transcriptCallbackRef.current) {
          transcriptCallbackRef.current({
            id: responseId,
            data: transcript,
            metadata: { isTranscriptComplete: true }
          });
        }
      },
      onAudioDelta: (msg: Record<string, unknown>) => {
        // Handle audio chunks for playback
        const delta = msg.delta as string;
        const responseId = msg.response_id as string;

        if (delta && responseId) {
          // Convert base64 to audio buffer and play like V11 does
          // This is where audio playback happens
        }
      },
      onAudioDone: (msg: Record<string, unknown>) => {
        optimizedAudioLogger.info('webrtc', 'response_audio_done', msg);

        console.log('[function] 🔊 Audio generation complete, checking state');
        console.log('[function] 🔍 onAudioDone called:', {
          responseId: msg.response_id,
          waitingForEndSession: waitingForEndSessionRef.current,
          expectingGoodbye: expectingEndSessionGoodbye.current,
          endSessionCallId: endSessionCallId.current,
          fullMessage: msg
        });
        console.log('[function] 📊 waitingForEndSession:', waitingForEndSessionRef.current);

        // Trust the server signal - if waiting for end session, start AI volume monitoring
        if (waitingForEndSessionRef.current) {
          console.log('[END_SESSION_FLOW] 🎯 6. Server audio generation complete for goodbye');
          console.log('[END_SESSION_FLOW] 📊 Audio done details:', {
            responseId: msg.response_id,
            callId: endSessionCallId.current,
            serverSignal: 'ai_audio_generation_complete'
          });
          
          console.log('[END_SESSION_FLOW] 🎧 7. Starting AI volume monitoring');
          console.log('[END_SESSION_FLOW] 📋 Transition: server_audio_done → volume_monitoring');
          
          console.log('[function] 🎚️ Starting volume monitoring for end session');
          console.log('[function] ✅ Starting volume monitoring for goodbye audio completion');
          console.log('[function] 🎯 Server says: AI audio generation complete for goodbye');

          // STATE-SYNC: Log state transition before volume monitoring
          console.log('[function] 🎯 Server audio done, handing off to volume monitoring:', {
            fromPhase: 'waiting_for_server_audio_done',
            toPhase: 'waiting_for_ai_volume_completion',
            callId: endSessionCallId.current,
            responseId: msg.response_id,
            connectionState: connectionManagerRef.current?.getState(),
            timestamp: Date.now()
          });

          optimizedAudioLogger.info('session', 'server_audio_generation_complete', {
            responseId: msg.response_id,
            action: 'starting_ai_volume_monitoring',
            method: 'server_signal_plus_volume_detection'
          });

          // Start AI volume monitoring to detect when AI actually stops speaking
          console.log('[function] 🎧 About to call startAIVolumeMonitoring()');
          startAIVolumeMonitoring();
          console.log('[function] 🎧 startAIVolumeMonitoring() call completed');
        } else {
          console.log('[function] ⏭️ Not starting volume monitoring - not waiting for end session');
          console.log('[function] 📝 Normal audio done (not waiting for end session)');
        }
      },
      onResponseDone: (msg: Record<string, unknown>) => {
        optimizedAudioLogger.info('webrtc', 'response_completed', { responseId: msg.response_id });

        // DEBUG: Always log response done events when expecting goodbye
        if (expectingEndSessionGoodbye.current) {
          console.log('[END_SESSION_FLOW] 🎯 4. onResponseDone while expecting goodbye');
          console.log('[END_SESSION_FLOW] 📊 Response analysis:', {
            responseId: msg.response_id,
            expectedCallId: endSessionCallId.current,
            fullResponse: msg
          });
          
          console.log('[function] 🔍 onResponseDone called while expecting goodbye:', {
            responseId: msg.response_id,
            expectingGoodbye: expectingEndSessionGoodbye.current,
            endSessionCallId: endSessionCallId.current,
            fullMessage: msg
          });

          const response = msg.response as Record<string, unknown> | undefined;
          const hasContent = response && response.status === 'completed';
          
          console.log('[END_SESSION_FLOW] 📊 Response status check:', {
            responseStatus: response?.status,
            hasContent
          });

          console.log('[function] 🔍 Response content analysis:', {
            response,
            hasContent,
            responseStatus: response?.status,
            responseKeys: response ? Object.keys(response) : 'no response object'
          });

          if (hasContent) {
            console.log('[END_SESSION_FLOW] ✅ 5. Goodbye response confirmed');
            console.log('[END_SESSION_FLOW] 🔄 Setting waitingForEndSession=true');
            console.log('[END_SESSION_FLOW] 📝 Now waiting for server audio done signal');
            
            console.log('[function] ✅ onResponseDone → waitingForEndSession=true (goodbye detected)');

            optimizedAudioLogger.info('session', 'goodbye_response_detected', {
              responseId: msg.response_id,
              callId: endSessionCallId.current,
              nextStep: 'waiting_for_server_audio_done_signal'
            });

            // Mark that goodbye was received, now wait for server audio done signal
            expectingEndSessionGoodbye.current = false;
            waitingForEndSessionRef.current = true;

            console.log('[function] 🎯 State transition complete:', {
              expectingEndSessionGoodbye: expectingEndSessionGoodbye.current,
              waitingForEndSession: waitingForEndSessionRef.current
            });

            optimizedAudioLogger.info('debug', 'end_session_flow_ready', {
              waitingForServerAudioDone: true,
              flow: 'server_signal_plus_volume_monitoring'
            });
          } else {
            console.log('[function] ❌ Response did not meet goodbye criteria');

            optimizedAudioLogger.warn('debug', 'unexpected_response_after_end_session', {
              responseId: msg.response_id,
              hasContent,
              expectedGoodbye: true,
              responseStatus: response?.status,
              fullResponse: response
            });
          }
        } else {
          console.log('[function] 📝 Normal response done (not expecting goodbye):', {
            responseId: msg.response_id
          });
        }
      },
      onError: (error: Error) => {
        optimizedAudioLogger.error('webrtc', 'comprehensive_handler_error', error);
      }
    };

    messageHandlerRef.current = new ComprehensiveMessageHandler(messageCallbacks);

    // Subscribe to connection messages using comprehensive message handler
    const unsubscribeMessages = connectionManagerRef.current.onMessage(async (event) => {
      if (messageHandlerRef.current) {
        await messageHandlerRef.current.handleMessage(event);
      }
    });

    // Subscribe to connection errors
    const unsubscribeErrors = connectionManagerRef.current.onError((error) => {
      optimizedAudioLogger.error('webrtc', 'connection_error', error);
    });

    // Subscribe to incoming audio streams
    const unsubscribeAudioStream = connectionManagerRef.current.onAudioStream((stream) => {
      optimizedAudioLogger.info('webrtc', 'audio_stream_connected', {
        streamId: stream.id,
        trackCount: stream.getTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      // AGGRESSIVE FIX: Remove state-based audio monitoring entirely
      // Audio levels stored in refs - no React re-renders triggered
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Store in refs only - NO setState calls = NO re-renders
      const updateAudioLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const roundedAverage = Math.floor(average / 10) * 10; // Even more aggressive rounding
        const threshold = 15;
        const newIsPlaying = roundedAverage > threshold;

        // Update refs ONLY - no state changes = no re-renders
        audioLevelRef.current = roundedAverage;
        isAudioPlayingRef.current = newIsPlaying;
        audioStatePlayingRef.current = newIsPlaying;

        // Continue monitoring without triggering React updates
        if (!audioElement.paused) {
          setTimeout(updateAudioLevel, 200); // Reduce frequency to 5fps
        }
      };

      // Create audio element with STABLE event handlers
      const audioElement = document.createElement('audio');
      audioElement.srcObject = stream;
      audioElement.autoplay = true;
      audioElement.volume = 1.0;

      // Start audio level monitoring when audio starts playing
      // Audio event handlers use refs for current state (stable)
      audioElement.onplay = () => {
        updateAudioLevel(); // Start monitoring in refs only
        optimizedAudioLogger.audioPlayback('started', stream.id);
        optimizedAudioLogger.debug('audio', 'event_detected', {
          event: 'play',
          expectingGoodbye: expectingEndSessionGoodbye.current,
          waitingForEndSession: waitingForEndSessionRef.current,
          streamId: stream.id
        });
      };

      audioElement.onended = () => {
        optimizedAudioLogger.audioPlayback('ended', stream.id);
        optimizedAudioLogger.debug('audio', 'event_detected', {
          event: 'ended',
          streamId: stream.id,
          note: 'audio_ended_but_session_already_ending'
        });
      };

      // Additional safety mechanism: detect when audio stops playing
      audioElement.onpause = () => {
        optimizedAudioLogger.debug('audio', 'event_detected', {
          event: 'pause',
          streamId: stream.id,
          note: 'audio_paused_but_session_already_ending'
        });
      };

      audioElement.onerror = (error) => {
        optimizedAudioLogger.error('webrtc', 'audio_element_error', new Error(`Audio element error: ${error}`));
      };

      // Append and setup cleanup
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      stream.getTracks().forEach(track => {
        track.onended = () => {
          optimizedAudioLogger.info('webrtc', 'audio_track_ended', { trackId: track.id });
          if (audioElement.parentNode) {
            document.body.removeChild(audioElement);
          }
        };
      });
    });

    // Subscribe to audio service state changes
    const unsubscribeAudioService = audioService.subscribe(() => {
      // Audio state changes are handled by React 18+ animation frame loop
      // No need to set state here to prevent re-renders
    });

    // Audio monitoring is now handled by React 18+ animation frame loop above

    optimizedAudioLogger.info('webrtc', 'hook_initialized_fixed', {
      instanceId: instanceIdRef.current
    });

    // STABLE cleanup - only runs on unmount
    return () => {
      console.log('[connection] 🔍 Cleaning up connection subscription at', new Date().toISOString());
      console.log('[connection] 🔍 Component mount ID during cleanup:', componentMountId.current);
      console.log('[connection] 🔍 Cleanup reason - effect re-running due to dependency change');

      optimizedAudioLogger.info('webrtc', 'hook_cleanup_fixed', {
        instanceId: instanceIdRef.current,
        reason: 'component_unmount_only',
        note: 'end_session_now_immediate_dispatch'
      });

      unsubscribeConnection();
      unsubscribeMessages();
      unsubscribeErrors();
      unsubscribeAudioStream();
      unsubscribeAudioService();

      // Cleanup volume monitor
      if (volumeMonitorRef.current) {
        volumeMonitorRef.current.stopMonitoring();
        volumeMonitorRef.current = null;
      }

      // Disconnect connection if still connected on unmount
      if (connectionManagerRef.current?.getState() === 'connected') {
        optimizedAudioLogger.info('webrtc', 'connection_disconnect_on_unmount', {
          instanceId: instanceIdRef.current,
          note: 'end_session_now_immediate_disconnect'
        });
        connectionManagerRef.current.disconnect();
      }
    };
  }, []); // EMERGENCY REVERT: Back to empty to stop the infinite loop catastrophe

  // Connect function
  const connect = useCallback(async (): Promise<void> => {
    if (!connectionManagerRef.current) {
      throw new Error('Connection manager not initialized');
    }

    optimizedAudioLogger.logUserAction('connect_requested', {
      instanceId: instanceIdRef.current,
      currentState: connectionState
    });

    try {
      await connectionManagerRef.current.connect();
      optimizedAudioLogger.logUserAction('connect_succeeded', {
        instanceId: instanceIdRef.current
      });
    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'connect_failed', error as Error, {
        instanceId: instanceIdRef.current
      });
      throw error;
    }
  }, [connectionState]);

  // State guard to prevent duplicate disconnections
  const disconnectInProgressRef = useRef(false);

  // Disconnect function - FIXED: Remove connectionState dependency
  const disconnect = useCallback(async (): Promise<void> => {
    console.log('[END_SESSION_FLOW] 🎯 10. disconnect() function called');
    console.log('[END_SESSION_FLOW] 📊 Disconnect context:', {
      triggeredBy: 'volume_monitoring_complete',
      currentState: connectionManagerRef.current?.getState(),
      endSessionFlow: waitingForEndSessionRef.current,
      timestamp: Date.now()
    });
    
    if (!connectionManagerRef.current) {
      return;
    }

    // Prevent duplicate disconnections
    if (disconnectInProgressRef.current) {
      optimizedAudioLogger.warn('disconnect', 'disconnect_already_in_progress', {
        instanceId: instanceIdRef.current,
        currentState: connectionManagerRef.current.getState(),
        ignoring: true
      });
      return;
    }

    disconnectInProgressRef.current = true;

    try {
      // COMPREHENSIVE DISCONNECT TRACKING: Log disconnect trigger source
      optimizedAudioLogger.error('disconnect', 'disconnect_triggered', new Error('Manual disconnect call'), {
        triggeredBy: 'manual_disconnect_call',
        currentState: connectionManagerRef.current.getState(),
        timestamp: Date.now(),
        instanceId: instanceIdRef.current,
        note: 'end_session_now_immediate_dispatch'
      });

      optimizedAudioLogger.logUserAction('disconnect_requested', {
        instanceId: instanceIdRef.current,
        currentState: connectionManagerRef.current.getState(),
        note: 'end_session_now_immediate_dispatch'
      });

      console.log('[END_SESSION_FLOW] 🔄 13. Notifying connection manager to disconnect');
      await connectionManagerRef.current.disconnect();
      console.log('[END_SESSION_FLOW] ✅ 11. Disconnect completed successfully');

      // Clear audio state
      console.log('[END_SESSION_FLOW] 🧹 Audio service cleared');
      audioService.clearAll();

      optimizedAudioLogger.logUserAction('disconnect_succeeded', {
        instanceId: instanceIdRef.current
      });
    } catch (error) {
      optimizedAudioLogger.error('webrtc', 'disconnect_failed', error as Error, {
        instanceId: instanceIdRef.current
      });
      throw error;
    } finally {
      disconnectInProgressRef.current = false;
    }
  }, []); // FIXED: Empty dependencies to prevent re-creation

  // Send message function
  const sendMessage = useCallback((message: string): boolean => {
    if (!connectionManagerRef.current) {
      optimizedAudioLogger.error('webrtc', 'send_message_failed', new Error('Connection manager not initialized'), {
        messageLength: message.length,
        instanceId: instanceIdRef.current
      });
      return false;
    }

    // Enhanced AI interaction logging for text input
    console.log('[AI-INTERACTION] ===== USER INPUT RECEIVED =====');
    console.log('[AI-INTERACTION] User said:', message);
    console.log('[AI-INTERACTION] Input method: text message');
    console.log('[AI-INTERACTION] Next: waiting for AI response (direct or function call)');

    optimizedAudioLogger.debug('webrtc', 'send_message', {
      messageLength: message.length,
      instanceId: instanceIdRef.current
    });

    const success = connectionManagerRef.current.sendMessage(message);

    if (!success) {
      optimizedAudioLogger.error('webrtc', 'send_message_failed', new Error('Send failed'), {
        messageLength: message.length,
        instanceId: instanceIdRef.current
      });
    }

    return success;
  }, []);

  // Diagnostics functions
  const getDiagnostics = useCallback(() => {
    const connectionDiagnostics = connectionManagerRef.current?.getDiagnostics() || {};
    const audioDiagnostics = audioService.getDiagnostics();

    return {
      instanceId: instanceIdRef.current,
      timestamp: Date.now(),
      connection: connectionDiagnostics,
      audio: audioDiagnostics,
      optimizedAudioLogger: {
        sessionId: optimizedAudioLogger.getSessionId(),
        diagnosticCount: optimizedAudioLogger.getDiagnosticData().length
      }
    };
  }, []);

  const getEventHistory = useCallback(() => {
    return [];
  }, []);

  const getPerformanceMetrics = useCallback(() => {
    const diagnostics = getDiagnostics();

    return {
      connectionTime: (diagnostics.connection as Record<string, unknown>).connectionDuration as number || 0,
      audioLatency: 0, // TODO: Implement actual audio latency measurement
      messageProcessingTime: 0, // TODO: Implement message processing time tracking
      memoryUsage: performance && 'memory' in performance ?
        (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize : 0
    };
  }, [getDiagnostics]);

  const exportDiagnostics = useCallback((): string => {
    const fullDiagnostics = {
      hookDiagnostics: getDiagnostics(),
      optimizedAudioLoggerData: optimizedAudioLogger.exportDiagnostics?.() || {},
      exportTime: Date.now(),
      exportTimeISO: new Date().toISOString(),
      version: 'v15'
    };

    return JSON.stringify(fullDiagnostics, null, 2);
  }, [getDiagnostics]);

  // Register function method (allows external registration)
  const registerFunction = useCallback((name: string): void => {
    optimizedAudioLogger.info('webrtc', 'function_registered', { functionName: name });
    // Functions are now handled directly in handleFunctionCall
  }, []);

  // Subscribe to transcript events
  const onTranscript = useCallback((callback: (message: { id: string; data: string; metadata?: Record<string, unknown> }) => void) => {
    // Store callback for use in transcript handlers
    transcriptCallbackRef.current = callback;

    return () => {
      transcriptCallbackRef.current = null;
    };
  }, []);

  // Subscribe to error events
  const onError = useCallback(() => {
    // Store callback for use in error handlers
    return () => { }; // Return empty unsubscribe function for now
  }, []);

  // AGGRESSIVE FIX: Create stable getters for audio data from refs
  const getAudioLevel = useCallback(() => audioLevelRef.current, []);
  const getIsAudioPlaying = useCallback(() => isAudioPlayingRef.current, []);
  const getAudioStateIsPlaying = useCallback(() => audioStatePlayingRef.current, []);

  // Memoized return object - STABILITY FIX: Only essential state dependencies  
  return useMemo(() => {
    console.log(`[connection] 🚨 RENDER STORM: Hook return object recreated - render #${hookRenderCount.current}`);
    console.log('[connection] 🔍 CRITICAL - This should be RARE but is happening constantly!');
    console.log('[connection] 🔍 Return object recreation cause - dependency changed:', {
      isConnected,
      connectionState,
      note: 'removed_audio_state_from_deps'
    });

    return {
      // Connection state
      isConnected,
      connectionState,

      // REMOVED: audioState completely - use getters only to prevent re-renders
      // audioState: audioState, // Removed to prevent constant re-renders

      // Audio getters (stable - no re-renders)
      getAudioLevel,
      getIsAudioPlaying,
      getAudioStateIsPlaying,

      // Actions
      connect,
      disconnect,
      sendMessage,
      registerFunction,

      // Event subscriptions
      onTranscript,
      onError,

      // Diagnostics
      diagnostics: {
        getEventHistory,
        getPerformanceMetrics,
        exportDiagnostics
      }
    };
  }, [
    isConnected,
    connectionState
    // REMOVED: deferredAudioState - was causing constant re-renders from audioService.subscribe
    // REMOVED: All function dependencies - useCallback should make them stable
  ]);
}