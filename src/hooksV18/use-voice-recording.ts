// src/hooksV18/use-voice-recording.ts
// Background voice recording for V18 chatbot sessions
// Records user's voice and uploads chunks to cloud storage silently

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

  // Recording state refs (not React state - background operation)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chunkUploadQueue = useRef<Map<number, ChunkInfo>>(new Map());
  const isRecordingRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);

  // Upload individual audio chunk
  const uploadAudioChunk = useCallback(async (chunk: Blob, chunkIndex: number) => {
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

      // Create FormData for chunk upload
      const formData = new FormData();
      formData.append('audio', chunk, `v18-chunk-${chunkIndex}-${Date.now()}.webm`);
      formData.append('conversation_id', conversationId);
      formData.append('chunk_index', chunkIndex.toString());
      formData.append('purpose', 'voice_chunk');

      // Link to patient intake
      if (userId) formData.append('user_id', userId);
      if (intakeId) formData.append('intake_id', intakeId);

      console.log(`[v18_voice_recording] Uploading audio chunk ${chunkIndex}:`, {
        chunkSize: chunk.size,
        conversationId: conversationId,
        chunkIndex: chunkIndex,
        userId,
        intakeId
      });

      // Upload to chunk endpoint
      const response = await fetch('/api/v18/voice-upload-chunk', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[v18_voice_recording] ✅ Chunk ${chunkIndex} uploaded successfully:`, result);

      // Mark as uploaded
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: true, failed: false });

    } catch (error) {
      console.error(`[v18_voice_recording] ❌ Chunk ${chunkIndex} upload failed:`, error);

      // Mark as failed for potential retry
      chunkUploadQueue.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: false, failed: true });
    }
  }, []);

  // Start recording session
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) {
      console.log('[v18_voice_recording] Recording already active');
      return;
    }

    try {
      console.log('[v18_voice_recording] WebRTC connected - initializing recording session');

      // Wait a moment to ensure WebRTC connection is established
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the SAME stream that WebRTC is using from connection manager
      const connectionManager = useWebRTCStore.getState().connectionManager;
      if (!connectionManager) {
        console.log('[v18_voice_recording] ConnectionManager not available - session may have ended');
        return; // Exit gracefully instead of throwing error
      }

      const stream = connectionManager.getAudioInputStream();
      if (!stream) {
        throw new Error('WebRTC audio stream not available');
      }

      console.log('[v18_voice_recording] Using WebRTC audio stream for recording:', {
        streamId: stream.id,
        active: stream.active,
        audioTracks: stream.getAudioTracks().length
      });

      audioChunksRef.current = []; // Clear previous chunks

      // Create MediaRecorder using the SAME stream as WebRTC
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 20000 // 20 kbps - optimal for voice (6x smaller than default 128kbps)
      });
      mediaRecorderRef.current = mediaRecorder;

      // Collect ALL audio chunks - this captures the exact same audio WebRTC uses
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          const chunkIndex = audioChunksRef.current.length;
          audioChunksRef.current.push(event.data);

          console.log('[v18_voice_recording] Audio chunk collected:', event.data.size, 'bytes (from WebRTC stream), index:', chunkIndex);

          // Add chunk to upload queue and upload immediately
          chunkUploadQueue.current.set(chunkIndex, {
            blob: event.data,
            uploading: false,
            uploaded: false,
            failed: false
          });

          // Upload chunk immediately in background
          uploadAudioChunk(event.data, chunkIndex).catch(error => {
            console.error(`[v18_voice_recording] Failed to initiate chunk ${chunkIndex} upload:`, error);
          });
        }
      };

      mediaRecorder.onstop = () => {
        console.log('[v18_voice_recording] Recording session ended. Total chunks:', audioChunksRef.current.length);
        isRecordingRef.current = false;
      };

      // Start recording session (captures same audio as WebRTC conversation)
      mediaRecorder.start(5000); // 5-second chunks
      isRecordingRef.current = true;

      // Get conversation ID for uploads (patient intake session takes priority)
      conversationIdRef.current = localStorage.getItem('patient_conversation_id') ||
                                   localStorage.getItem('selectedBookId');

      console.log('[v18_voice_recording] ✅ Recording session started using WebRTC stream:', {
        mimeType,
        streamId: stream.id,
        streamActive: stream.active,
        audioTracks: stream.getAudioTracks().length,
        chunkInterval: 5000,
        conversationId: conversationIdRef.current
      });

    } catch (error) {
      console.error('[v18_voice_recording] Failed to initialize recording session:', error);
      isRecordingRef.current = false;
    }
  }, [uploadAudioChunk]);

  // Stop recording session
  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && (isRecordingRef.current || audioChunksRef.current.length > 0)) {
      console.log('[v18_voice_recording] Ending recording session');
      mediaRecorderRef.current.stop();

      const totalChunks = audioChunksRef.current.length;
      const uploadedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.uploaded).length;
      const failedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.failed).length;
      const stillUploadingCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.uploading).length;

      console.log('[v18_voice_recording] 🎤 Recording session ended - Chunk status:', {
        totalChunks,
        uploadedCount,
        failedCount,
        stillUploadingCount
      });

      if (totalChunks === 0) {
        console.log('[v18_voice_recording] ❌ No audio chunks captured during session');
        return;
      }

      // Wait a moment for any final chunks to upload
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalUploadedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.uploaded).length;
      const finalFailedCount = Array.from(chunkUploadQueue.current.values()).filter(info => info.failed).length;

      console.log('[v18_voice_recording] Final chunk upload status:', {
        totalChunks,
        finalUploadedCount,
        finalFailedCount,
        successRate: `${Math.round((finalUploadedCount / totalChunks) * 100)}%`
      });

      // Clear chunks from memory after upload
      audioChunksRef.current = [];
      chunkUploadQueue.current.clear();
    }
  }, []);

  // Auto-start recording when WebRTC connects
  useEffect(() => {
    console.log('[v18_voice_recording] useEffect triggered:', {
      isConnected,
      isRecordingRefCurrent: isRecordingRef.current
    });

    if (isConnected && !isRecordingRef.current) {
      console.log('[v18_voice_recording] Conditions met - calling startRecording');
      startRecording();
    } else {
      console.log('[v18_voice_recording] Conditions NOT met for starting recording:', {
        isConnected,
        isRecordingRefCurrent: isRecordingRef.current,
        reason: !isConnected ? 'Not connected' : 'Already recording'
      });
    }
  }, [isConnected, startRecording]);

  // Cleanup on unmount or disconnect
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        stopRecording();
      }
    };
  }, [stopRecording]);

  return {
    isRecording: isRecordingRef.current,
    stopRecording
  };
}
