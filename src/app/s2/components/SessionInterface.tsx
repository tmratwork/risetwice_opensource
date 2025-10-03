// src/app/s2/components/SessionInterface.tsx
// S2 Case Simulation Session Interface - WebRTC with cleaner styling

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useS1WebRTCStore } from '@/stores/s1-webrtc-store';
import { useAuth } from '@/contexts/auth-context';
import type { ConnectionConfig } from '@/hooksV15/types';
import BlueOrbVoiceUI from '@/components/BlueOrbVoiceUI';
import { useOrbVisualizationS2 } from '@/hooksV15/use-orb-visualization-s2';

interface SessionData {
  therapistProfile: {
    fullName: string;
    title: string;
    degrees: string[];
    primaryLocation: string;
    offersOnline: boolean;
    phoneNumber?: string;
    emailAddress?: string;
  };
  patientDescription: {
    description: string;
  };
  aiStyle: {
    therapeuticModalities: {
      cognitive_behavioral: number;
      person_centered: number;
      psychodynamic: number;
      solution_focused: number;
    };
    communicationStyle: {
      friction: number;
      tone: number;
      energyLevel: number;
    };
  };
  generatedScenario?: string;
}

interface SessionInterfaceProps {
  sessionData: SessionData & {
    scenarioId?: string;
    sessionId?: string;
    adminPreview?: boolean;
  };
  onEndSession: () => void;
}

const SessionInterface: React.FC<SessionInterfaceProps> = ({
  sessionData,
  onEndSession
}) => {
  const [sessionTimer, setSessionTimer] = useState(0);
  const [connecting, setConnecting] = useState(false);
  // Use conversation from S1 store (it handles both S1 and S2)
  const [s2SessionId, setS2SessionId] = useState<string>('');

  // Debug: Track s2SessionId changes
  useEffect(() => {
    console.log('[DEBUG] s2SessionId changed to:', s2SessionId);
  }, [s2SessionId]);
  const [sessionAutoEnded, setSessionAutoEnded] = useState(false);
  const capturedSessionIdRef = useRef<string>(''); // Capture sessionId when overlay shows
  const userSpeakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Voice recording state (copied from S1)
  const [isRecordingSession, setIsRecordingSession] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>('Recording ready - unmute mic to start');

  const conversationHistoryRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializingRef = useRef<boolean>(false);

  // Voice recording refs (copied from S1)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Chunk upload tracking
  const chunkUploadQueue = useRef<Map<number, { blob: Blob, uploading: boolean, uploaded: boolean, failed: boolean }>>(new Map());
  const [uploadingChunks, setUploadingChunks] = useState(0);
  const [uploadedChunks, setUploadedChunks] = useState(0);

  // Auth context
  const { user } = useAuth();

  // S1 WebRTC Store (works for both S1 and S2)
  const isConnected = useS1WebRTCStore(state => state.isConnected);
  const isThinking = useS1WebRTCStore(state => state.isThinking);
  const isUserSpeaking = useS1WebRTCStore(state => state.isUserSpeaking);
  const isMuted = useS1WebRTCStore(state => state.isMuted);
  const connect = useS1WebRTCStore(state => state.connect);
  const disconnect = useS1WebRTCStore(state => state.disconnect);
  const preInitialize = useS1WebRTCStore(state => state.preInitialize);
  const setTranscriptCallback = useS1WebRTCStore(state => state.setTranscriptCallback);
  const toggleMute = useS1WebRTCStore(state => state.toggleMute);
  const addConversationMessage = useS1WebRTCStore(state => state.addConversationMessage);
  const setS1Session = useS1WebRTCStore(state => state.setS1Session);
  const isAudioOutputMuted = useS1WebRTCStore(state => state.isAudioOutputMuted);
  const toggleAudioOutputMute = useS1WebRTCStore(state => state.toggleAudioOutputMute);
  const conversation = useS1WebRTCStore(state => state.conversation);

  // Enhanced orb visualization (matching v16 implementation)
  const orbState = useOrbVisualizationS2();

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setSessionTimer(prev => {
        const newTime = prev + 1;
        // Auto-end session after 20 minutes (1200 seconds)
        if (newTime >= 1200) {
          console.log('[S2] ⏰ 20-minute session limit reached - showing end session overlay');
          // Capture sessionId NOW while it's still valid
          capturedSessionIdRef.current = s2SessionId;
          console.log('[DEBUG] Captured sessionId for later use:', capturedSessionIdRef.current);
          setSessionAutoEnded(true);

          // Start 5-minute timeout for auto-cleanup if user abandons session
          overlayTimeoutRef.current = setTimeout(async () => {
            console.log('[S2] ⏰ 5 minutes of inactivity after overlay - auto-continuing to next step');
            // Programmatically trigger the exact same function as manual "Continue" button
            await handleContinueToNextStep();
          }, 5 * 60 * 1000); // 5 minutes in milliseconds

          // Don't call endSession() automatically - wait for user to click "Continue" or timeout
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return newTime; // Return the final time
        }
        return newTime;
      });
    }, 1000);
  };

  // Use S1 store's message handling - it now auto-detects S1/S2 context

  const setupMessageHandling = useCallback(() => {
    // Use original S1 message handling - works perfectly and now saves to correct table
    setTranscriptCallback(({ id, data, metadata }) => {
      const isFinal = metadata?.isFinal === true;
      const metadataRole = (metadata as { role?: string })?.role || "assistant";
      const isUserMessage = metadataRole === 'user' || id.includes('user-');
      const role = isUserMessage ? 'therapist' : 'ai_patient'; // S1 store expects 'ai_patient'

      console.log('[S2] Transcript callback:', {
        id,
        data: data?.slice(0, 20) + '...',
        isFinal,
        metadataRole,
        isUserMessage,
        role
      });

      // Handle AI thinking state
      if (!isUserMessage && isFinal && data && data.trim().length > 0) {
        console.log('[S2] 🔵 AI response complete - stopping thinking dots');
        useS1WebRTCStore.setState({ isThinking: false });
      }

      if (isFinal && data) {
        const newMessage = {
          id: `${role}_${id}`,
          role: role as 'therapist' | 'ai_patient',
          text: data,
          timestamp: new Date().toISOString(),
          isFinal: true,
          status: 'final' as const
        };

        // S1 store will auto-detect S2 context and save to s2_session_messages
        addConversationMessage(newMessage);
      }
    });
  }, [setTranscriptCallback, addConversationMessage]);

  const generateAIPersonalityPrompt = useCallback(() => {
    const { therapeuticModalities, communicationStyle } = sessionData.aiStyle;
    const { description } = sessionData.patientDescription;

    // Convert numbers to descriptive terms
    const getModalityLevel = (value: number) => {
      if (value >= 70) return 'heavily emphasize';
      if (value >= 40) return 'moderately incorporate';
      if (value >= 20) return 'lightly incorporate';
      return 'minimally use';
    };

    const getStyleDescription = (value: number, lowLabel: string, highLabel: string) => {
      if (value >= 80) return `very ${highLabel.toLowerCase()}`;
      if (value >= 60) return `moderately ${highLabel.toLowerCase()}`;
      if (value >= 40) return 'balanced';
      if (value >= 20) return `moderately ${lowLabel.toLowerCase()}`;
      return `very ${lowLabel.toLowerCase()}`;
    };

    return `You are an AI patient in a therapy simulation. The therapist has described their ideal patient scenario as: "${description}"

Based on this scenario, embody a patient who fits this description. Your therapeutic responses should align with how a patient would respond based on these modality preferences:

THERAPEUTIC MODALITIES:
- Cognitive & Behavioral: ${getModalityLevel(therapeuticModalities.cognitive_behavioral)} CBT approaches
- Person-Centered & Humanistic: ${getModalityLevel(therapeuticModalities.person_centered)} humanistic approaches  
- Psychodynamic & Insight-Oriented: ${getModalityLevel(therapeuticModalities.psychodynamic)} psychodynamic approaches
- Solution-Focused & Strategic: ${getModalityLevel(therapeuticModalities.solution_focused)} solution-focused approaches

COMMUNICATION STYLE:
- Friction: ${getStyleDescription(communicationStyle.friction, 'responsive to encouragement', 'responsive to challenges and pushback')}
- Tone: ${getStyleDescription(communicationStyle.tone, 'casual and conversational', 'formal and clinical')}
- Energy Level: ${getStyleDescription(communicationStyle.energyLevel, 'expressive and animated', 'calm and measured')}

Stay in character as the patient throughout the session. Respond naturally to the therapist's interventions while maintaining consistency with the scenario and the therapist's preferred style. Be authentic to the patient's struggles while being appropriately responsive to therapeutic techniques that match the therapist's approach.`;
  }, [sessionData]);

  const createS2Session = useCallback(async (aiPersonalityPrompt: string) => {
    if (!user?.uid) {
      console.error('[S2] Cannot create session - user not authenticated');
      return null;
    }

    if (!sessionData.scenarioId && !sessionData.adminPreview) {
      console.error('[S2] Cannot create session - scenarioId missing');
      return null;
    }

    try {
      console.log('[S2] Creating S2 session in database...');

      const response = await fetch('/api/s2/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          generatedScenarioId: sessionData.scenarioId, // Match API expectation
          aiPersonalityPrompt: aiPersonalityPrompt // Match API expectation
        })
      });

      const data = await response.json();

      if (data.success && data.session) {
        console.log('[S2] ✅ S2 session created successfully:', data.session.id);
        console.log('[DEBUG] Setting s2SessionId to:', data.session.id);
        setS2SessionId(data.session.id);
        return data.session.id;
      } else {
        throw new Error(data.error || 'Failed to create session');
      }

    } catch (error) {
      console.error('[S2] Error creating S2 session:', error);
      return null;
    }
  }, [user?.uid, sessionData.scenarioId]);

  const initializeSession = useCallback(async () => {
    console.log('[DEBUG] initializeSession called, initializing:', initializingRef.current);
    // Prevent double initialization in React Strict Mode (exactly like S1)
    if (initializingRef.current) {
      console.log('[S2] Session already initializing, skipping...');
      return;
    }

    try {
      initializingRef.current = true;
      setConnecting(true);
      console.log('[S2] Initializing case simulation session...');
      console.log('[DEBUG] About to generate AI personality prompt...');

      // Generate AI personality prompt based on user selections
      console.log('[S2] [DEBUG] sessionData before generating prompt:', {
        hasPatientDescription: !!sessionData.patientDescription?.description,
        patientDescriptionLength: sessionData.patientDescription?.description?.length || 0,
        hasAiStyle: !!sessionData.aiStyle,
        aiStyleKeys: Object.keys(sessionData.aiStyle || {})
      });

      const aiPersonalityPrompt = generateAIPersonalityPrompt();
      console.log('[S2] [DEBUG] Generated AI personality prompt (length, first 200 chars):', aiPersonalityPrompt?.length || 0, aiPersonalityPrompt?.slice(0, 200) || 'EMPTY');

      if (!aiPersonalityPrompt || aiPersonalityPrompt.trim().length === 0) {
        throw new Error('Generated AI personality prompt is empty - check sessionData');
      }

      // Create or use existing S2 session
      let createdSessionId: string;

      if (sessionData.adminPreview && sessionData.sessionId) {
        // For admin preview, use the existing session
        console.log('[DEBUG] Using existing admin preview session:', sessionData.sessionId);
        createdSessionId = sessionData.sessionId;
      } else {
        // For normal sessions, create a new session
        console.log('[DEBUG] About to call createS2Session...');
        createdSessionId = await createS2Session(aiPersonalityPrompt);
        console.log('[DEBUG] createS2Session returned:', createdSessionId);
        if (!createdSessionId) {
          throw new Error('Failed to create S2 session in database');
        }
      }

      // Set S2 session in store - exactly like S1 pattern
      // Set S1 session (works for S2 too)
      setS1Session({
        sessionId: createdSessionId,
        aiPatientId: 's2_ai_patient',
        aiPatientName: 'AI Patient (S2)',
        primaryConcern: 'custom_scenario',
        sessionStatus: 'active'
      });

      // Store S2 session ID for message saving context
      localStorage.setItem('s2SessionId', createdSessionId);
      localStorage.setItem('s2Context', 'true'); // Flag to indicate S2 context

      // Create WebRTC configuration for AI patient (identical to S1)
      console.log('[S2] [DEBUG] Creating ConnectionConfig with prompt length:', aiPersonalityPrompt.length);
      console.log('[S2] [DEBUG] Prompt starts with:', aiPersonalityPrompt.substring(0, 100));

      const connectionConfig: ConnectionConfig = {
        instructions: aiPersonalityPrompt,
        voice: 'alloy', // Same voice as S1 for consistency
        tools: [], // No tools needed for AI patients
        tool_choice: 'none',
        greetingInstructions: 'Speak in English. Remember: You are the PATIENT, not the therapist. Speak first, greet the user, who is a therapist, express uncertainty, nervousness, or your presenting concern. Do not act like a therapist asking questions.'
      };

      console.log('[S2] [DEBUG] ConnectionConfig created with instructions length:', connectionConfig.instructions?.length || 0);

      // Pre-initialize WebRTC with AI patient configuration
      await preInitialize(connectionConfig);

      // Set up message handling
      setupMessageHandling();

      // Connect to WebRTC - let OpenAI Realtime API handle microphone access automatically (exactly like S1)
      console.log('[S2] Connecting to WebRTC with microphone input enabled...');
      await connect();

      console.log('[S2] ✅ Case simulation session initialized successfully');

    } catch (error) {
      console.error('[S2] Error initializing session:', error);
    } finally {
      setConnecting(false);
      initializingRef.current = false;
    }
  }, [generateAIPersonalityPrompt, preInitialize, connect, setupMessageHandling, setS1Session, createS2Session]);

  // Upload individual audio chunk
  const uploadAudioChunk = useCallback(async (chunk: Blob, chunkIndex: number) => {
    const chunkInfo = chunkUploadQueue.current.get(chunkIndex);
    if (!chunkInfo || chunkInfo.uploading || chunkInfo.uploaded) {
      return; // Skip if already uploading or uploaded
    }

    try {
      // Mark as uploading
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: true, failed: false });
      setUploadingChunks(prev => prev + 1);

      const sessionIdToUse = s2SessionId || capturedSessionIdRef.current || localStorage.getItem('s2SessionId');
      if (!sessionIdToUse) {
        throw new Error('No session ID available for chunk upload');
      }

      // Create FormData for chunk upload
      const formData = new FormData();
      formData.append('audio', chunk, `s2-chunk-${chunkIndex}-${Date.now()}.webm`);
      formData.append('session_id', sessionIdToUse);
      formData.append('chunk_index', chunkIndex.toString());
      formData.append('purpose', 'voice_chunk');

      console.log(`[S2] Uploading audio chunk ${chunkIndex}:`, {
        chunkSize: chunk.size,
        sessionId: sessionIdToUse,
        chunkIndex: chunkIndex
      });

      // Upload to new chunk endpoint
      const response = await fetch('/api/s2/voice-upload-chunk', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[S2] ✅ Chunk ${chunkIndex} uploaded successfully:`, result);

      // Mark as uploaded
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: true, failed: false });
      setUploadedChunks(prev => prev + 1);

    } catch (error) {
      console.error(`[S2] ❌ Chunk ${chunkIndex} upload failed:`, error);

      // Mark as failed for potential retry
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: false, failed: true });

      // Don't break the session for individual chunk failures
    } finally {
      setUploadingChunks(prev => prev - 1);
    }
  }, [s2SessionId]);

  // Retry failed chunk uploads
  const retryFailedChunks = useCallback(async () => {
    const failedChunks = Array.from(chunkUploadQueue.current.entries())
      .filter(([, info]) => info.failed && !info.uploading)
      .map(([index, info]) => ({ index, info }));

    console.log(`[S2] Retrying ${failedChunks.length} failed chunks`);

    for (const { index, info } of failedChunks) {
      await uploadAudioChunk(info.blob, index);
      // Small delay between retries to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }, [uploadAudioChunk]);

  useEffect(() => {
    console.log('[S2] Case simulation interface mounted');
    startTimer();
    initializeSession();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
      }
      if (userSpeakingTimeoutRef.current) {
        clearTimeout(userSpeakingTimeoutRef.current);
      }
      disconnect();
    };
  }, [disconnect, initializeSession]);

  // Auto-start recording session when WebRTC connects (copied from S1)
  useEffect(() => {
    const startRecordingSession = async () => {
      if (isConnected && !isRecordingSession) {
        console.log('[S2] WebRTC connected - initializing recording session');

        try {
          // Wait a moment to ensure WebRTC connection is established
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Get the SAME stream that WebRTC is using from connection manager
          const connectionManager = useS1WebRTCStore.getState().connectionManager;
          if (!connectionManager) {
            console.log('[S2] ConnectionManager not available - session may have ended');
            return; // Exit gracefully instead of throwing error
          }

          const stream = connectionManager.getAudioInputStream();
          if (!stream) {
            throw new Error('WebRTC audio stream not available');
          }

          console.log('[S2] Using WebRTC audio stream for recording:', {
            streamId: stream.id,
            active: stream.active,
            audioTracks: stream.getAudioTracks().length
          });

          micStreamRef.current = stream;
          audioChunksRef.current = []; // Clear previous chunks

          // Create MediaRecorder using the SAME stream as WebRTC
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

          const mediaRecorder = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = mediaRecorder;

          // Collect ALL audio chunks - this captures the exact same audio WebRTC uses
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              const chunkIndex = audioChunksRef.current.length;
              audioChunksRef.current.push(event.data);

              console.log('[S2] Audio chunk collected:', event.data.size, 'bytes (from WebRTC stream), index:', chunkIndex);

              // NEW: Add chunk to upload queue and upload immediately
              chunkUploadQueue.current.set(chunkIndex, {
                blob: event.data,
                uploading: false,
                uploaded: false,
                failed: false
              });

              // Upload chunk immediately in background
              uploadAudioChunk(event.data, chunkIndex).catch(error => {
                console.error(`[S2] Failed to initiate chunk ${chunkIndex} upload:`, error);
              });
            }
          };

          mediaRecorder.onstop = () => {
            console.log('[S2] Recording session ended. Total chunks:', audioChunksRef.current.length);
            setIsRecordingSession(false);
          };

          // Start recording session (captures same audio as WebRTC conversation)
          mediaRecorder.start(5000); // 5-second chunks for better debugging
          setIsRecordingSession(true);
          setRecordingStatus(isMuted ? 'Recording Muted' : 'Recording');

          console.log('[S2] ✅ Recording session started using WebRTC stream:', {
            mimeType,
            streamId: stream.id,
            streamActive: stream.active,
            audioTracks: stream.getAudioTracks().length,
            chunkInterval: 5000
          });

        } catch (error) {
          console.error('[S2] Failed to initialize recording session:', error);
          setRecordingStatus('Recording failed to initialize: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    };

    startRecordingSession();
  }, [isConnected, isRecordingSession, isMuted]);

  // Update recording status when mic mute state changes (copied from S1)
  useEffect(() => {
    if (isRecordingSession) {
      const failedChunks = Array.from(chunkUploadQueue.current.values()).filter(info => info.failed).length;

      if (uploadingChunks > 0) {
        setRecordingStatus(`Recording - Uploading chunks (${uploadingChunks} active)`);
      } else if (failedChunks > 0) {
        setRecordingStatus(`Recording - ${failedChunks} chunks failed upload`);
      } else if (uploadedChunks > 0) {
        setRecordingStatus(isMuted ? `Recording Muted - ${uploadedChunks} chunks saved` : `Recording - ${uploadedChunks} chunks saved`);
      } else {
        setRecordingStatus(isMuted ? 'Recording Muted' : 'Recording');
      }
    }
  }, [isMuted, isRecordingSession, uploadingChunks, uploadedChunks]);

  // Auto-scroll to bottom when conversation changes (copied from V16)
  useEffect(() => {
    if (conversationHistoryRef.current && conversation.length > 0) {
      const scrollContainer = conversationHistoryRef.current;

      // Use requestAnimationFrame to ensure DOM has updated before scrolling
      requestAnimationFrame(() => {
        // Triple RAF to ensure all rendering and layout is complete
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Always scroll to bottom on new messages - no proximity check needed
            if (process.env.NEXT_PUBLIC_ENABLE_V16_AUTO_SCROLL_LOGS === 'true') {
              const currentScrollTop = scrollContainer.scrollTop;
              const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
              const distanceFromBottom = maxScrollTop - currentScrollTop;

              console.log('[s2_auto_scroll] Auto-scroll triggered', {
                currentScrollTop,
                scrollHeight: scrollContainer.scrollHeight,
                clientHeight: scrollContainer.clientHeight,
                maxScrollTop,
                distanceFromBottom,
                conversationLength: conversation.length
              });
            }

            // Always scroll to bottom for new messages
            scrollContainer.scrollTop = scrollContainer.scrollHeight;

            if (process.env.NEXT_PUBLIC_ENABLE_V16_AUTO_SCROLL_LOGS === 'true') {
              console.log('[s2_auto_scroll] ✅ SCROLLED to bottom');
            }
          });
        });
      });
    }
  }, [conversation]);



  // Voice recording functions - now chunk-based with immediate uploads
  const endRecordingSession = useCallback(async () => {
    if (mediaRecorderRef.current && (isRecordingSession || audioChunksRef.current.length > 0)) {
      console.log('[S2] Ending recording session');
      mediaRecorderRef.current.stop();

      // Don't stop the microphone stream - it belongs to WebRTC
      // Just clear our reference to it
      micStreamRef.current = null;

      const totalChunks = audioChunksRef.current.length;
      const uploadedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.uploaded).length;
      const failedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.failed).length;
      const stillUploadingCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.uploading).length;

      console.log('[S2] 🎤 Recording session ended - Chunk status:', {
        totalChunks,
        uploadedCount,
        failedCount,
        stillUploadingCount
      });

      if (totalChunks === 0) {
        console.log('[S2] ❌ No audio chunks captured during session');
        setRecordingStatus('No voice recorded during session.');
        return;
      }

      setRecordingStatus(`Finalizing audio upload... (${uploadedCount}/${totalChunks} chunks saved)`);

      try {
        setIsUploading(true);

        // Wait a moment for any final chunks to upload
        await new Promise(resolve => setTimeout(resolve, 2000));

        const finalUploadedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.uploaded).length;
        const finalFailedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.failed).length;

        console.log('[S2] Final chunk upload status:', {
          totalChunks,
          finalUploadedCount,
          finalFailedCount,
          successRate: `${Math.round((finalUploadedCount / totalChunks) * 100)}%`
        });

        if (finalUploadedCount > 0) {
          setRecordingStatus(`✅ Audio chunks saved! (${finalUploadedCount}/${totalChunks} uploaded)`);
        } else {
          setRecordingStatus('❌ Upload failed. Session ended but voice not saved.');
        }

        // Clear chunks from memory after successful upload
        audioChunksRef.current = [];
        chunkUploadQueue.current.clear();
        setUploadedChunks(0);
        setUploadingChunks(0);

        // Hide status after 5 seconds
        setTimeout(() => setRecordingStatus(''), 5000);

      } catch (error) {
        console.error('[S2] Voice recording finalization failed:', error);
        setRecordingStatus('❌ Upload failed. Session ended but voice may be incomplete.');
        setTimeout(() => setRecordingStatus(''), 8000);
      } finally {
        setIsUploading(false);
      }
    }
  }, [isRecordingSession, s2SessionId, retryFailedChunks]);

  const endSession = async () => {
    console.log('[S2] Ending case simulation session');

    // ADD DEBUG LOG:
    console.log('[DEBUG] endSession state check:', {
      isRecordingSession,
      hasMediaRecorder: !!mediaRecorderRef.current,
      audioChunks: audioChunksRef.current.length,
      s2SessionId: s2SessionId
    });

    // End recording session if active OR if we have audio chunks to upload
    if (isRecordingSession || (audioChunksRef.current.length > 0 && mediaRecorderRef.current)) {
      await endRecordingSession();
    }

    // Update session status in database - use captured sessionId if current one is empty
    const sessionIdForDb = s2SessionId || capturedSessionIdRef.current;
    console.log('[DEBUG] SessionId for database update - current:', s2SessionId, 'captured:', capturedSessionIdRef.current, 'using:', sessionIdForDb);

    if (sessionIdForDb && user?.uid) {
      try {
        console.log('[S2] Updating session status to completed...');

        const response = await fetch('/api/s2/session', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'end_session',
            sessionId: sessionIdForDb,
            userId: user.uid,
            duration: sessionTimer
          })
        });

        const data = await response.json();
        if (data.success) {
          console.log('[S2] ✅ Session ended successfully in database');
        } else {
          console.error('[S2] Failed to end session in database:', data.error);
        }
      } catch (error) {
        console.error('[S2] Error ending session in database:', error);
      }
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    disconnect();
    onEndSession();
  };

  // Shared function for continuing to next step (used by both manual button and auto-timeout)
  const handleContinueToNextStep = async () => {
    console.log('[S2] Continue to next step triggered');

    // Clear the 5-minute auto-cleanup timeout if it's active
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
      console.log('[S2] ✅ Cleared 5-minute auto-cleanup timeout');
    }

    // First end the session properly (cleanup WebRTC, save to database, etc.)
    await endSession();
    // Then hide overlay and proceed to next step
    setSessionAutoEnded(false);
  };

  // Loading state
  if (connecting || !isConnected) {
    return (
      <div className="flex flex-col h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>
            {connecting ? 'Connecting to AI Patient...' : 'Preparing your case simulation...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="chatbot-v16-wrapper" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="main-container" style={{ paddingTop: '40px' }}>
          {/* Session status bar - minimal design integrated with layout */}
          <div className="flex items-center justify-between py-3 px-4 mb-4 text-sm text-gray-600 bg-white/50 rounded-lg">
            <div className="flex items-center space-x-4">
              <span>Step 7 of 8 - AI Patient Session</span>
              <div className={`px-2 py-1 text-xs rounded-full ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </div>
              {/* Voice Recording Status */}
              {recordingStatus && (isRecordingSession || isUploading || recordingStatus.includes('✅') || recordingStatus.includes('❌')) && (
                <div className="flex items-center space-x-2">
                  {isRecordingSession && (
                    <div className={`w-2 h-2 rounded-full ${isMuted ? 'bg-gray-400' : 'bg-red-600 animate-pulse'
                      }`} />
                  )}
                  <span className="text-xs text-gray-600">
                    {recordingStatus}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center text-gray-700">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(sessionTimer)}
              </div>

              <button
                onClick={endSession}
                className="control-button px-3 py-1 text-sm"
                style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
              >
                End Session
              </button>
            </div>
          </div>

          {/* Conversation container - matching V16 styling */}
          <div className="conversation-container">
            <div
              className="conversation-history"
              ref={conversationHistoryRef}
              role="log"
              aria-live="polite"
            >
              {conversation.length === 0 && isConnected && (
                <div className="text-center py-8">
                  <div className="message system">
                    <h3 className="text-lg font-medium mb-2">Preparing Session...</h3>
                    <p className="text-sm">
                      Your AI patient is getting ready.
                    </p>
                  </div>
                </div>
              )}

              {conversation.map((message) => (
                <div
                  key={message.id}
                  className={`message ${message.role === 'therapist' ? 'user' : 'assistant'}`}
                >
                  {message.text}
                </div>
              ))}

              {/* User speaking indicator with dancing dots - FORCED VISIBILITY */}
              {isUserSpeaking && (
                <div className="message user" style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid #22c55e',
                  minHeight: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px'
                }}>
                  <div className="flex space-x-2 items-center">
                    <span style={{ fontSize: '12px', marginRight: '10px', color: '#22c55e' }}>Speaking...</span>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDuration: '0.6s' }}></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }}></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}></div>
                  </div>
                </div>
              )}

              {/* AI thinking indicator with dancing dots - FORCED VISIBILITY */}
              {isThinking && (
                <div className="message assistant" style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid #3b82f6',
                  minHeight: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px'
                }}>
                  <div className="flex space-x-2 items-center">
                    <span style={{ fontSize: '12px', marginRight: '10px', color: '#3b82f6' }}>Thinking...</span>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDuration: '0.6s' }}></div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }}></div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '0.6s' }}></div>
                  </div>
                </div>
              )}


            </div>

            {/* Audio controls container - voice-only mode */}
            {isConnected && (
              <div className="audio-controls-container flex justify-center py-4">
                <button
                  type="button"
                  onClick={toggleAudioOutputMute}
                  className={`mute-button ${isAudioOutputMuted ? 'muted' : ''}`}
                  aria-label={isAudioOutputMuted ? "Unmute speakers" : "Mute speakers"}
                >
                  {isAudioOutputMuted ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
                      <path d="M11 5L6 9H2v6h4l3 3V16" stroke="currentColor" strokeWidth="2" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" stroke="currentColor" strokeWidth="2"
                        fill="none" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Audio visualizer - matching V16 */}
          {isConnected && (
            <div className="visualization-container" role="button" aria-label="Microphone control - click to mute or unmute your microphone" aria-describedby="mic-description">
              <BlueOrbVoiceUI
                isSpeaking={orbState.isActuallyPlaying}
                isThinking={orbState.isAiThinking}
                isMuted={orbState.isMuted}
                isFunctionExecuting={false}
                currentVolume={orbState.effectiveVolume}
                onClick={toggleMute}
                particleSizeMin={15}
                particleSizeMax={35}
                particleSpeedMin={0.1}
                particleSpeedMax={0.4}
                transitionSpeed={0.25}
                size={125}
                className="blue-orb-v15"
                draggable={false}
              />
              <div id="mic-description" className="sr-only">
                Microphone control button located in the center of the screen. Click to toggle your microphone on or off. Visual indicator shows blue animation when AI is speaking.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Session Auto-End Overlay */}
      {sessionAutoEnded && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
            <div className="mb-4">
              <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Session has ended
              </h3>
              <p className="text-gray-600 mb-6">
                Next step is to refine your Personalized AI Preview
              </p>
              <button
                onClick={async () => {
                  console.log('[S2] User clicked Continue - ending session and proceeding to next step');
                  // Use the same shared function as auto-timeout
                  await handleContinueToNextStep();
                }}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Continue to Next Step
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SessionInterface;