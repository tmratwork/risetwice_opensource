// src/hooksV17/use-voice-recording.ts
// Background voice recording for V17 chatbot sessions (ElevenLabs)
// Records patient audio (microphone) and uploads as chunks to cloud storage silently

import { useEffect, useRef, useCallback } from 'react';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';

interface ChunkInfo {
  blob: Blob;
  uploading: boolean;
  uploaded: boolean;
  failed: boolean;
}

// Helper function to create WAV file from PCM data
function createWavBlob(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  const fileSize = 44 + dataSize; // WAV header is 44 bytes

  // Create WAV header
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true); // File size minus RIFF header
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, byteRate, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // Combine header and PCM data
  const wavData = new Uint8Array(fileSize);
  wavData.set(new Uint8Array(header), 0);
  wavData.set(pcmData, 44);

  return new Blob([wavData], { type: 'audio/wav' });
}

// Helper to write string to DataView
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function useVoiceRecording() {
  // ElevenLabs connection state
  const isConnected = useElevenLabsStore(state => state.isConnected);
  const conversationId = useElevenLabsStore(state => state.conversationId);

  // Patient audio recording state refs (not React state - background operation)
  const patientMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const patientAudioChunksRef = useRef<Blob[]>([]);
  const patientChunkUploadQueue = useRef<Map<number, ChunkInfo>>(new Map());
  const isRecordingPatientRef = useRef(false);
  const patientStreamRef = useRef<MediaStream | null>(null);

  // AI audio recording state refs
  const aiAudioChunksRef = useRef<string[]>([]); // Store base64 strings
  const aiChunkUploadQueue = useRef<Map<number, ChunkInfo>>(new Map());
  const isRecordingAiRef = useRef(false);
  const aiChunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const aiChunkIndexRef = useRef(0);

  // Upload individual audio chunk
  const uploadAudioChunk = useCallback(async (
    chunk: Blob,
    chunkIndex: number,
    speaker: 'patient' | 'ai',
    currentConversationId: string | null
  ) => {
    console.log(`[v17_voice_recording] uploadAudioChunk called:`, {
      speaker,
      chunkIndex,
      chunkSize: chunk.size,
      conversationId: currentConversationId
    });

    // Select correct queue based on speaker type
    const queueToUse = speaker === 'ai' ? aiChunkUploadQueue : patientChunkUploadQueue;
    const chunkInfo = queueToUse.current.get(chunkIndex);

    console.log(`[v17_voice_recording] Queue check:`, {
      speaker,
      chunkIndex,
      hasChunkInfo: !!chunkInfo,
      isUploading: chunkInfo?.uploading,
      isUploaded: chunkInfo?.uploaded
    });

    if (!chunkInfo || chunkInfo.uploading || chunkInfo.uploaded) {
      console.log(`[v17_voice_recording] ⚠️ Skipping upload:`, {
        speaker,
        chunkIndex,
        reason: !chunkInfo ? 'no_chunk_info' : chunkInfo.uploading ? 'already_uploading' : 'already_uploaded'
      });
      return; // Skip if already uploading or uploaded
    }

    try {
      // Mark as uploading
      queueToUse.current.set(chunkIndex, { ...chunkInfo, uploading: true, failed: false });

      // Get conversation_id from store (passed as parameter)
      if (!currentConversationId) {
        throw new Error('No conversation ID available for chunk upload');
      }

      // Get user_id and intake_id from localStorage for linking
      const userId = localStorage.getItem('firebase_user_id');
      const intakeId = localStorage.getItem('patient_intake_id');

      // Create FormData for chunk upload with speaker identification
      const formData = new FormData();
      // Use .wav extension for AI audio (converted from PCM), .webm for patient audio (MediaRecorder)
      const fileExtension = speaker === 'ai' ? 'wav' : 'webm';
      formData.append('audio', chunk, `v17-${speaker}-chunk-${chunkIndex}-${Date.now()}.${fileExtension}`);
      formData.append('conversation_id', currentConversationId);
      formData.append('chunk_index', chunkIndex.toString());
      formData.append('purpose', 'voice_chunk');
      formData.append('speaker', speaker); // Identify speaker type

      // Link to patient intake
      if (userId) formData.append('user_id', userId);
      if (intakeId) formData.append('intake_id', intakeId);

      console.log(`[v17_voice_recording] Uploading ${speaker} audio chunk ${chunkIndex}:`, {
        chunkSize: chunk.size,
        conversationId: currentConversationId,
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
        console.error(`[v17_voice_recording] ❌ ${speaker} chunk ${chunkIndex} API error:`, {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[v17_voice_recording] ✅ ${speaker} chunk ${chunkIndex} uploaded successfully:`, result);

      // Mark as uploaded
      queueToUse.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: true, failed: false });

    } catch (error) {
      console.error(`[v17_voice_recording] ❌ ${speaker} chunk ${chunkIndex} upload failed:`, error);

      // Mark as failed for potential retry
      queueToUse.current.set(chunkIndex, { ...chunkInfo, uploading: false, uploaded: false, failed: true });
    }
  }, []);

  // Start recording patient audio stream
  const startRecording = useCallback(async (currentConversationId: string | null) => {
    if (isRecordingPatientRef.current) {
      console.log('[v17_voice_recording] Patient recording already active');
      return;
    }

    if (!currentConversationId) {
      console.log('[v17_voice_recording] No conversation ID - cannot start recording');
      return;
    }

    try {
      console.log('[v17_voice_recording] ElevenLabs connected - initializing patient audio recording', {
        conversationId: currentConversationId
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // Wait a moment to ensure connection is fully established
      await new Promise(resolve => setTimeout(resolve, 1000));

      // === PATIENT AUDIO STREAM (microphone input) ===
      // Get the audio stream that ElevenLabs is already using (exposed globally)
      console.log('[v17_voice_recording] 🎤 Looking for ElevenLabs audio stream...');
      const windowWithStream = window as Window & { v17AudioStream?: MediaStream };
      const patientStream = windowWithStream.v17AudioStream;

      if (!patientStream) {
        console.error('[v17_voice_recording] ❌ No audio stream available - ElevenLabs may not have requested microphone yet');
        return;
      }

      patientStreamRef.current = patientStream;

      console.log('[v17_voice_recording] 🎤 Using ElevenLabs audio stream:', {
        streamId: patientStream.id,
        streamActive: patientStream.active,
        audioTracksCount: patientStream.getAudioTracks().length
      });

      if (patientStream) {
        console.log('[v17_voice_recording] ✅ Setting up PATIENT audio recording:', {
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

            console.log('[v17_voice_recording] Patient audio chunk collected:', event.data.size, 'bytes, index:', chunkIndex);

            patientChunkUploadQueue.current.set(chunkIndex, {
              blob: event.data,
              uploading: false,
              uploaded: false,
              failed: false
            });

            // Upload patient chunk immediately in background
            uploadAudioChunk(event.data, chunkIndex, 'patient', currentConversationId).catch(error => {
              console.error(`[v17_voice_recording] Failed to initiate patient chunk ${chunkIndex} upload:`, error);
            });
          }
        };

        patientMediaRecorder.onstop = () => {
          console.log('[v17_voice_recording] Patient recording session ended. Total chunks:', patientAudioChunksRef.current.length);
          isRecordingPatientRef.current = false;

          // Don't stop the stream - ElevenLabs owns it
          // Just clear our reference
          patientStreamRef.current = null;
        };

        patientMediaRecorder.start(5000); // 5-second chunks
        isRecordingPatientRef.current = true;

        console.log('[v17_voice_recording] ✅ PATIENT recording started');
      } else {
        console.error('[v17_voice_recording] ❌ Patient audio stream NOT AVAILABLE - patient audio will NOT be recorded!');
      }

      console.log('[v17_voice_recording] ✅ Recording session initialized:', {
        mimeType,
        chunkInterval: 5000,
        conversationId: currentConversationId,
        patientRecording: isRecordingPatientRef.current
      });

    } catch (error) {
      console.error('[v17_voice_recording] Failed to initialize recording session:', error);
      isRecordingPatientRef.current = false;
    }
  }, [uploadAudioChunk]);

  // Stop recording patient session
  const stopRecording = useCallback(async () => {
    console.log('[v17_voice_recording] Stopping recording session');

    // Stop PATIENT recording
    if (patientMediaRecorderRef.current && (isRecordingPatientRef.current || patientAudioChunksRef.current.length > 0)) {
      console.log('[v17_voice_recording] Ending PATIENT recording session');
      patientMediaRecorderRef.current.stop();

      const totalChunks = patientAudioChunksRef.current.length;
      const uploadedCount = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.uploaded).length;
      const failedCount = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.failed).length;
      const stillUploadingCount = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.uploading).length;

      console.log('[v17_voice_recording] 🎤 PATIENT recording ended - Chunk status:', {
        totalChunks,
        uploadedCount,
        failedCount,
        stillUploadingCount
      });

      if (totalChunks === 0) {
        console.log('[v17_voice_recording] ⚠️ No patient audio chunks captured during session');
      }
    }

    // Wait for any final chunks to upload
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Log final status for PATIENT
    const patientTotalChunks = patientAudioChunksRef.current.length;
    const patientFinalUploaded = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.uploaded).length;
    const patientFinalFailed = Array.from(patientChunkUploadQueue.current.values()).filter(info => info.failed).length;

    console.log('[v17_voice_recording] 📊 Final upload status:', {
      patient: {
        totalChunks: patientTotalChunks,
        uploaded: patientFinalUploaded,
        failed: patientFinalFailed,
        successRate: patientTotalChunks > 0 ? `${Math.round((patientFinalUploaded / patientTotalChunks) * 100)}%` : 'N/A'
      }
    });

    // Clear chunks from memory after upload
    patientAudioChunksRef.current = [];
    patientChunkUploadQueue.current.clear();
  }, []);

  // Process AI audio chunks (convert base64 to blob and upload)
  const processAiAudioChunk = useCallback(async (currentConversationId: string) => {
    if (aiAudioChunksRef.current.length === 0) {
      console.log('[ai_audio_capture] No AI audio data to process');
      return;
    }

    try {
      console.log('[ai_audio_capture] Processing AI chunk:', {
        chunkIndex: aiChunkIndexRef.current,
        segments: aiAudioChunksRef.current.length
      });

      // Decode each base64 segment separately, then concatenate binary data
      const decodedSegments: Uint8Array[] = [];
      let totalBytes = 0;

      for (const base64Segment of aiAudioChunksRef.current) {
        try {
          const binaryString = atob(base64Segment);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          decodedSegments.push(bytes);
          totalBytes += bytes.length;
        } catch (decodeError) {
          console.error('[ai_audio_capture] Failed to decode segment:', decodeError);
        }
      }

      if (decodedSegments.length === 0) {
        console.error('[ai_audio_capture] No segments successfully decoded');
        return;
      }

      // Concatenate all decoded segments into single Uint8Array
      const combinedBytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const segment of decodedSegments) {
        combinedBytes.set(segment, offset);
        offset += segment.length;
      }

      // Convert PCM to WAV format for browser playback
      // ElevenLabs Conversational AI uses PCM16 format: 48kHz sample rate, 16-bit, mono
      // Note: Was playing at half speed with 24kHz, indicating actual rate is 48kHz
      const wavBlob = createWavBlob(combinedBytes, 48000, 1, 16);

      console.log('[ai_audio_capture] Created AI audio WAV blob:', {
        pcmSize: combinedBytes.length,
        wavSize: wavBlob.size,
        type: wavBlob.type,
        chunkIndex: aiChunkIndexRef.current
      });

      const blob = wavBlob;

      // Add to upload queue
      aiChunkUploadQueue.current.set(aiChunkIndexRef.current, {
        blob,
        uploading: false,
        uploaded: false,
        failed: false
      });

      // Upload immediately
      await uploadAudioChunk(blob, aiChunkIndexRef.current, 'ai', currentConversationId);

      // Increment chunk index
      aiChunkIndexRef.current++;

      // Clear processed chunks
      aiAudioChunksRef.current = [];

    } catch (error) {
      console.error('[ai_audio_capture] Failed to process AI audio chunk:', error);
    }
  }, [uploadAudioChunk]);

  // Listen for AI audio events from ElevenLabs
  useEffect(() => {
    if (!isConnected || !conversationId) {
      return;
    }

    const handleAiAudio = (event: Event) => {
      const customEvent = event as CustomEvent;
      const audioData = customEvent.detail;

      if (typeof audioData === 'string' && audioData.length > 0) {
        // Store base64 audio chunk
        aiAudioChunksRef.current.push(audioData);
        console.log('[ai_audio_capture] Received AI audio segment:', {
          segmentLength: audioData.length,
          totalSegments: aiAudioChunksRef.current.length
        });

        // Start AI recording flag
        if (!isRecordingAiRef.current) {
          isRecordingAiRef.current = true;
          console.log('[ai_audio_capture] ✅ AI recording started');

          // Set up 5-second timer to process chunks
          aiChunkTimerRef.current = setInterval(() => {
            if (aiAudioChunksRef.current.length > 0) {
              processAiAudioChunk(conversationId);
            }
          }, 5000);
        }
      }
    };

    console.log('[ai_audio_capture] Registering AI audio event listener');
    window.addEventListener('elevenlabs-ai-audio', handleAiAudio);

    return () => {
      console.log('[ai_audio_capture] Removing AI audio event listener');
      window.removeEventListener('elevenlabs-ai-audio', handleAiAudio);

      // Clear timer
      if (aiChunkTimerRef.current) {
        clearInterval(aiChunkTimerRef.current);
        aiChunkTimerRef.current = null;
      }

      // Process any remaining chunks
      if (aiAudioChunksRef.current.length > 0 && conversationId) {
        processAiAudioChunk(conversationId);
      }

      isRecordingAiRef.current = false;
      aiChunkIndexRef.current = 0;
      aiAudioChunksRef.current = [];
    };
  }, [isConnected, conversationId, processAiAudioChunk]);

  // Auto-start recording when ElevenLabs connects, stop when disconnects
  useEffect(() => {
    const isPatientRecording = isRecordingPatientRef.current;

    console.log('[v17_voice_recording] useEffect triggered:', {
      isConnected,
      conversationId,
      isRecordingPatient: isRecordingPatientRef.current,
      isPatientRecording
    });

    // Start patient recording when connected and have conversation ID
    if (isConnected && !isPatientRecording && conversationId) {
      console.log('[v17_voice_recording] Conditions met - calling startRecording for PATIENT audio');
      startRecording(conversationId);
    } else if (!isConnected && isPatientRecording) {
      console.log('[v17_voice_recording] ElevenLabs disconnected - stopping recording');
      stopRecording();
    } else {
      console.log('[v17_voice_recording] Conditions NOT met for starting recording:', {
        isConnected,
        conversationId,
        isPatientRecording,
        reason: !isConnected ? 'Not connected' : !conversationId ? 'No conversation ID' : 'Patient recording already active'
      });
    }
  }, [isConnected, conversationId, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const isRecording = isRecordingPatientRef.current;
      if (isRecording) {
        stopRecording();
      }
    };
  }, [stopRecording]);

  return {
    isRecording: isRecordingPatientRef.current,
    stopRecording
  };
}
