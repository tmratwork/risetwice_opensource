// src/hooksV18/use-voice-recording.ts
// Background voice recording for V18 chatbot sessions
// Records BOTH patient audio (microphone) AND AI audio (OpenAI voice output)
// Uploads both streams as separate chunks to cloud storage silently

import { useEffect, useRef, useCallback } from 'react';
import { useWebRTCStore } from '@/stores/webrtc-store';

interface ChunkInfo {
  blob: Blob;
  uploading: boolean;
  uploaded: boolean;
  failed: boolean;
}

export function useVoiceRecording() {
  // WebRTC connection state
  const isConnected = useWebRTCStore(state => state.isConnected);
  const connectionManager = useWebRTCStore(state => state.connectionManager);

  // Patient audio recording state refs (not React state - background operation)
  const patientMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const patientAudioChunksRef = useRef<Blob[]>([]);
  const patientChunkUploadQueue = useRef<Map<number, ChunkInfo>>(new Map());
  const isRecordingPatientRef = useRef(false);

  // AI audio recording state refs
  const aiMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const aiAudioChunksRef = useRef<Blob[]>([]);
  const aiChunkUploadQueue = useRef<Map<number, ChunkInfo>>(new Map());
  const isRecordingAiRef = useRef(false);

  // Shared conversation ID
  const conversationIdRef = useRef<string | null>(null);

  // Track if AI listener has been registered
  const aiListenerRegisteredRef = useRef(false);

  // Upload individual audio chunk (now supports both patient and AI)
  const uploadAudioChunk = useCallback(async (
    chunk: Blob,
    chunkIndex: number,
    speaker: 'patient' | 'ai',
    chunkUploadQueue: React.MutableRefObject<Map<number, ChunkInfo>>
  ) => {
    const chunkInfo = chunkUploadQueue.current.get(chunkIndex);
    if (!chunkInfo || chunkInfo.uploading || chunkInfo.uploaded) {
      return; // Skip if already uploading or uploaded
    }

    try {
      // Mark as uploading
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: true, failed: false });

      // Get conversation_id: first try patient intake session, then fall back to selectedBookId
      const conversationId = conversationIdRef.current ||
                            localStorage.getItem('patient_conversation_id') ||
                            localStorage.getItem('selectedBookId');
      if (!conversationId) {
        throw new Error('No conversation ID available for chunk upload');
      }

      // Get user_id and intake_id from localStorage for linking
      const userId = localStorage.getItem('firebase_user_id');
      const intakeId = localStorage.getItem('patient_intake_id');

      // Create FormData for chunk upload with speaker identification
      const formData = new FormData();
      formData.append('audio', chunk, `v18-${speaker}-chunk-${chunkIndex}-${Date.now()}.webm`);
      formData.append('conversation_id', conversationId);
      formData.append('chunk_index', chunkIndex.toString());
      formData.append('purpose', 'voice_chunk');
      formData.append('speaker', speaker); // NEW: Identify speaker type

      // Link to patient intake
      if (userId) formData.append('user_id', userId);
      if (intakeId) formData.append('intake_id', intakeId);

      console.log(`[v18_voice_recording] Uploading ${speaker} audio chunk ${chunkIndex}:`, {
        chunkSize: chunk.size,
        conversationId: conversationId,
        chunkIndex: chunkIndex,
        speaker,
        userId,
        intakeId
      });

      // Upload to chunk endpoint
      const response = await fetch('/api/v18/voice-upload-chunk', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error(`[v18_voice_recording] ❌ ${speaker} chunk ${chunkIndex} API error:`, {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[v18_voice_recording] ✅ ${speaker} chunk ${chunkIndex} uploaded successfully:`, result);

      // Mark as uploaded
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: true, failed: false });

    } catch (error) {
      console.error(`[v18_voice_recording] ❌ ${speaker} chunk ${chunkIndex} upload failed:`, error);

      // Mark as failed for potential retry
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: false, failed: true });
    }
  }, []);

  // Start recording BOTH patient and AI audio streams
  const startRecording = useCallback(async () => {
    // Only check if PATIENT recording is active (AI recording starts independently)
    if (isRecordingPatientRef.current) {
      console.log('[v18_voice_recording] Patient recording already active');
      return;
    }

    try {
      console.log('[v18_voice_recording] WebRTC connected - initializing dual-stream recording session');

      // Get connection manager IMMEDIATELY (before any delay)
      const connectionManager = useWebRTCStore.getState().connectionManager;
      if (!connectionManager) {
        console.log('[v18_voice_recording] ConnectionManager not available - session may have ended');
        return; // Exit gracefully instead of throwing error
      }

      // Get conversation ID for uploads (patient intake session takes priority)
      conversationIdRef.current = localStorage.getItem('patient_conversation_id') ||
                                   localStorage.getItem('selectedBookId');

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // Wait a moment to ensure WebRTC connection is fully established
      await new Promise(resolve => setTimeout(resolve, 1000));

      // === PATIENT AUDIO STREAM (microphone input) ===
      const patientStream = connectionManager.getAudioInputStream();
      console.log('[v18_voice_recording] 🎤 Attempting to get patient audio stream:', {
        connectionManagerExists: !!connectionManager,
        patientStreamExists: !!patientStream,
        patientStreamId: patientStream?.id,
        patientStreamActive: patientStream?.active,
        audioTracksCount: patientStream?.getAudioTracks().length
      });

      if (patientStream) {
        console.log('[v18_voice_recording] ✅ Setting up PATIENT audio recording:', {
          streamId: patientStream.id,
          active: patientStream.active,
          audioTracks: patientStream.getAudioTracks().length
        });

        patientAudioChunksRef.current = [];
        const patientMediaRecorder = new MediaRecorder(patientStream, {
          mimeType,
          audioBitsPerSecond: 20000 // 20 kbps - optimal for voice
        });
        patientMediaRecorderRef.current = patientMediaRecorder;

        patientMediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            const chunkIndex = patientAudioChunksRef.current.length;
            patientAudioChunksRef.current.push(event.data);

            console.log('[v18_voice_recording] Patient audio chunk collected:', event.data.size, 'bytes, index:', chunkIndex);

            patientChunkUploadQueue.current.set(chunkIndex, {
              blob: event.data,
              uploading: false,
              uploaded: false,
              failed: false
            });

            // Upload patient chunk immediately in background
            uploadAudioChunk(event.data, chunkIndex, 'patient', patientChunkUploadQueue).catch(error => {
              console.error(`[v18_voice_recording] Failed to initiate patient chunk ${chunkIndex} upload:`, error);
            });
          }
        };

        patientMediaRecorder.onstop = () => {
          console.log('[v18_voice_recording] Patient recording session ended. Total chunks:', patientAudioChunksRef.current.length);
          isRecordingPatientRef.current = false;
        };

        patientMediaRecorder.start(5000); // 5-second chunks
        isRecordingPatientRef.current = true;

        console.log('[v18_voice_recording] ✅ PATIENT recording started');
      } else {
        console.error('[v18_voice_recording] ❌ Patient audio stream NOT AVAILABLE - patient audio will NOT be recorded!', {
          connectionManagerExists: !!connectionManager,
          patientStreamNull: patientStream === null,
          patientStreamUndefined: patientStream === undefined
        });
      }

      console.log('[v18_voice_recording] ✅ Dual-stream recording session initialized:', {
        mimeType,
        chunkInterval: 5000,
        conversationId: conversationIdRef.current,
        patientRecording: isRecordingPatientRef.current,
        aiRecording: isRecordingAiRef.current,
        aiListenerRegistered: true
      });

    } catch (error) {
      console.error('[v18_voice_recording] Failed to initialize recording session:', error);
      isRecordingPatientRef.current = false;
      isRecordingAiRef.current = false;
    }
  }, [uploadAudioChunk]);

  // Stop recording BOTH patient and AI sessions
  const stopRecording = useCallback(async () => {
    console.log('[v18_voice_recording] Stopping dual-stream recording session');

    // Stop PATIENT recording
    if (patientMediaRecorderRef.current && (isRecordingPatientRef.current || patientAudioChunksRef.current.length > 0)) {
      console.log('[v18_voice_recording] Ending PATIENT recording session');
      patientMediaRecorderRef.current.stop();

      const totalChunks = patientAudioChunksRef.current.length;
      const uploadedCount = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.uploaded).length;
      const failedCount = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.failed).length;
      const stillUploadingCount = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.uploading).length;

      console.log('[v18_voice_recording] 🎤 PATIENT recording ended - Chunk status:', {
        totalChunks,
        uploadedCount,
        failedCount,
        stillUploadingCount
      });

      if (totalChunks === 0) {
        console.log('[v18_voice_recording] ⚠️ No patient audio chunks captured during session');
      }
    }

    // Stop AI recording
    if (aiMediaRecorderRef.current && (isRecordingAiRef.current || aiAudioChunksRef.current.length > 0)) {
      console.log('[v18_voice_recording] Ending AI recording session');
      aiMediaRecorderRef.current.stop();

      const totalChunks = aiAudioChunksRef.current.length;
      const uploadedCount = Array.from(aiChunkUploadQueue.current.values()).filter(info => info.uploaded).length;
      const failedCount = Array.from(aiChunkUploadQueue.current.values()).filter(info => info.failed).length;
      const stillUploadingCount = Array.from(aiChunkUploadQueue.current.values()).filter(info => info.uploading).length;

      console.log('[v18_voice_recording] 🤖 AI recording ended - Chunk status:', {
        totalChunks,
        uploadedCount,
        failedCount,
        stillUploadingCount
      });

      if (totalChunks === 0) {
        console.log('[v18_voice_recording] ⚠️ No AI audio chunks captured during session');
      }
    }

    // Wait for any final chunks to upload
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Log final status for PATIENT
    const patientTotalChunks = patientAudioChunksRef.current.length;
    const patientFinalUploaded = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.uploaded).length;
    const patientFinalFailed = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.failed).length;

    // Log final status for AI
    const aiTotalChunks = aiAudioChunksRef.current.length;
    const aiFinalUploaded = Array.from(aiChunkUploadQueue.current.values()).filter(info => info.uploaded).length;
    const aiFinalFailed = Array.from(aiChunkUploadQueue.current.values()).filter(info => info.failed).length;

    console.log('[v18_voice_recording] 📊 Final dual-stream upload status:', {
      patient: {
        totalChunks: patientTotalChunks,
        uploaded: patientFinalUploaded,
        failed: patientFinalFailed,
        successRate: patientTotalChunks > 0 ? `${Math.round((patientFinalUploaded / patientTotalChunks) * 100)}%` : 'N/A'
      },
      ai: {
        totalChunks: aiTotalChunks,
        uploaded: aiFinalUploaded,
        failed: aiFinalFailed,
        successRate: aiTotalChunks > 0 ? `${Math.round((aiFinalUploaded / aiTotalChunks) * 100)}%` : 'N/A'
      }
    });

    // Clear chunks from memory after upload
    patientAudioChunksRef.current = [];
    patientChunkUploadQueue.current.clear();
    aiAudioChunksRef.current = [];
    aiChunkUploadQueue.current.clear();
  }, []);

  // Register AI audio listener when ConnectionManager becomes available
  useEffect(() => {
    if (!connectionManager) {
      return;
    }

    if (aiListenerRegisteredRef.current) {
      return;
    }

    console.log('[v18_voice_recording] Registering AI audio stream listener...');

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    const handleAiAudioStream = (aiStream: MediaStream) => {
      console.log('[v18_voice_recording] AI audio stream received:', {
        streamId: aiStream.id,
        active: aiStream.active,
        audioTracks: aiStream.getAudioTracks().length
      });

      // Only start recording if not already recording AI audio
      if (isRecordingAiRef.current) {
        console.log('[v18_voice_recording] AI recording already active, skipping');
        return;
      }

      // Get conversation ID
      const conversationId = conversationIdRef.current ||
                            localStorage.getItem('patient_conversation_id') ||
                            localStorage.getItem('selectedBookId');
      if (!conversationId) {
        console.log('[v18_voice_recording] No conversation ID available, cannot start AI recording');
        return;
      }

      aiAudioChunksRef.current = [];
      const aiMediaRecorder = new MediaRecorder(aiStream, {
        mimeType,
        audioBitsPerSecond: 20000 // 20 kbps - optimal for voice
      });
      aiMediaRecorderRef.current = aiMediaRecorder;

      aiMediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          const chunkIndex = aiAudioChunksRef.current.length;
          aiAudioChunksRef.current.push(event.data);

          console.log('[v18_voice_recording] AI audio chunk collected:', event.data.size, 'bytes, index:', chunkIndex);

          aiChunkUploadQueue.current.set(chunkIndex, {
            blob: event.data,
            uploading: false,
            uploaded: false,
            failed: false
          });

          // Upload AI chunk immediately in background (inline to avoid dependency issues)
          const chunkInfo = aiChunkUploadQueue.current.get(chunkIndex);
          if (chunkInfo && !chunkInfo.uploading && !chunkInfo.uploaded) {
            try {
              aiChunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: true, failed: false });

              const convId = conversationIdRef.current ||
                            localStorage.getItem('patient_conversation_id') ||
                            localStorage.getItem('selectedBookId');
              const userId = localStorage.getItem('firebase_user_id');
              const intakeId = localStorage.getItem('patient_intake_id');

              const formData = new FormData();
              formData.append('audio', event.data, `v18-ai-chunk-${chunkIndex}-${Date.now()}.webm`);
              formData.append('conversation_id', convId!);
              formData.append('chunk_index', chunkIndex.toString());
              formData.append('purpose', 'voice_chunk');
              formData.append('speaker', 'ai');
              if (userId) formData.append('user_id', userId);
              if (intakeId) formData.append('intake_id', intakeId);

              console.log(`[v18_voice_recording] Uploading ai audio chunk ${chunkIndex}`);

              const response = await fetch('/api/v18/voice-upload-chunk', {
                method: 'POST',
                body: formData
              });

              if (response.ok) {
                const result = await response.json();
                console.log(`[v18_voice_recording] ✅ ai chunk ${chunkIndex} uploaded successfully:`, result);
                aiChunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: true, failed: false });
              } else {
                throw new Error(`Upload failed: ${response.statusText}`);
              }
            } catch (error) {
              console.error(`[v18_voice_recording] ❌ ai chunk ${chunkIndex} upload failed:`, error);
              aiChunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: false, failed: true });
            }
          }
        }
      };

      aiMediaRecorder.onstop = () => {
        console.log('[v18_voice_recording] AI recording session ended. Total chunks:', aiAudioChunksRef.current.length);
        isRecordingAiRef.current = false;
      };

      aiMediaRecorder.start(5000); // 5-second chunks
      isRecordingAiRef.current = true;

      console.log('[v18_voice_recording] ✅ AI recording started');
    };

    // Register AI audio stream listener on the connection manager
    connectionManager.onAudioStream(handleAiAudioStream);
    aiListenerRegisteredRef.current = true;
    console.log('[v18_voice_recording] ✅ AI audio stream listener registered');

    // No cleanup - listener should persist for the lifetime of the component
  }, [connectionManager]); // Watch for connectionManager to become available

  // Auto-start recording when WebRTC connects, stop when disconnects
  useEffect(() => {
    // Only check if PATIENT recording has started (AI recording starts independently via listener)
    const isPatientRecording = isRecordingPatientRef.current;
    const isAnyRecording = isRecordingPatientRef.current || isRecordingAiRef.current;

    console.log('[v18_voice_recording] useEffect triggered:', {
      isConnected,
      isRecordingPatient: isRecordingPatientRef.current,
      isRecordingAi: isRecordingAiRef.current,
      isPatientRecording,
      isAnyRecording
    });

    // Start patient recording when connected (even if AI recording already started)
    if (isConnected && !isPatientRecording) {
      console.log('[v18_voice_recording] Conditions met - calling startRecording for PATIENT audio');
      startRecording();
    } else if (!isConnected && isAnyRecording) {
      console.log('[v18_voice_recording] WebRTC disconnected - stopping all recording');
      stopRecording();
    } else {
      console.log('[v18_voice_recording] Conditions NOT met for starting recording:', {
        isConnected,
        isPatientRecording,
        reason: !isConnected ? 'Not connected' : 'Patient recording already active'
      });
    }
  }, [isConnected, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const isRecording = isRecordingPatientRef.current || isRecordingAiRef.current;
      if (isRecording) {
        stopRecording();
      }
    };
  }, [stopRecording]);

  return {
    isRecording: isRecordingPatientRef.current || isRecordingAiRef.current,
    stopRecording
  };
}
