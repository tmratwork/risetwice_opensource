// src/app/s1/components/SessionInterface.tsx
// S1 Therapy Session Interface with Real WebRTC Chat

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useS1WebRTCStore } from '@/stores/s1-webrtc-store';
import { useS1Prompts } from '@/hooksS1/use-s1-prompts';
import type { ConnectionConfig } from '@/hooksV15/types';

interface SessionData {
  ai_patient_id: string;
  ai_patient_name: string;
  primary_concern?: string;
  patient_type?: string;
}

interface Props {
  sessionId: string;
  sessionData?: SessionData; // The full session object from API
  onSessionEnd: () => void;
}

const SessionInterface: React.FC<Props> = ({ sessionId, sessionData: passedSessionData, onSessionEnd }) => {
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [connecting, setConnecting] = useState(false);
  
  // Voice recording state
  const [isRecordingSession, setIsRecordingSession] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>('Recording ready - unmute mic to start');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initializingRef = useRef<boolean>(false);
  
  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);

  // S1 WebRTC Store
  const conversation = useS1WebRTCStore(state => state.conversation);
  const therapistMessage = useS1WebRTCStore(state => state.therapistMessage);
  const isConnected = useS1WebRTCStore(state => state.isConnected);
  const isThinking = useS1WebRTCStore(state => state.isThinking);
  const isMuted = useS1WebRTCStore(state => state.isMuted);
  const isAudioOutputMuted = useS1WebRTCStore(state => state.isAudioOutputMuted);
  const sendMessage = useS1WebRTCStore(state => state.sendMessage);
  const updateTherapistMessage = useS1WebRTCStore(state => state.updateTherapistMessage);
  const clearTherapistMessage = useS1WebRTCStore(state => state.clearTherapistMessage);
  const addConversationMessage = useS1WebRTCStore(state => state.addConversationMessage);
  const setS1Session = useS1WebRTCStore(state => state.setS1Session);
  const connect = useS1WebRTCStore(state => state.connect);
  const disconnect = useS1WebRTCStore(state => state.disconnect);
  const preInitialize = useS1WebRTCStore(state => state.preInitialize);
  const setTranscriptCallback = useS1WebRTCStore(state => state.setTranscriptCallback);
  const toggleMute = useS1WebRTCStore(state => state.toggleMute);
  const toggleAudioOutputMute = useS1WebRTCStore(state => state.toggleAudioOutputMute);

  // S1 Prompts Hook
  const { loadPatientPrompt, loading: promptLoading } = useS1Prompts();

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);
  };

  const setupMessageHandling = useCallback(() => {
    // Set up transcript callback for real-time message handling
    setTranscriptCallback(({ id, data, metadata }) => {
      // Determine if this is the final transcript or streaming
      const isFinal = metadata?.isFinal === true;
      
      // Extract the role from metadata like V16 does
      const metadataRole = (metadata as { role?: string })?.role || "assistant";
      
      // For S1 role reversal: user=therapist, assistant=ai_patient
      // Also check if ID contains "user-" prefix to catch cases where metadata is wrong
      const isUserMessage = metadataRole === 'user' || id.includes('user-');
      const role = isUserMessage ? 'therapist' : 'ai_patient';

      // Only log final transcripts, not streaming deltas (reduces log spam)
      if (isFinal) {
        console.log('[S1] Final transcript:', { id, textLength: data?.length, role });
        
        // Final message - add to conversation
        addConversationMessage({
          id: `${role}_${id}`,
          role,
          text: data,
          timestamp: new Date().toISOString(),
          isFinal: true,
          status: 'final',
          emotional_tone: metadata?.emotional_tone as string
        });
      }
    });
  }, [setTranscriptCallback, addConversationMessage]);

  const initializeSession = useCallback(async () => {
    // Prevent double initialization in React Strict Mode
    if (initializingRef.current) {
      console.log('[S1] Session already initializing, skipping...');
      return;
    }

    try {
      initializingRef.current = true;
      setConnecting(true);
      console.log('[S1] Initializing therapy session...');

      // Use the passed session data instead of fetching
      if (!passedSessionData) {
        throw new Error('No session data provided');
      }
      
      console.log('[S1] Using passed session data:', passedSessionData);
      
      // We need to get the actual patient data to determine primary_concern
      const patientResponse = await fetch(`/api/s1/ai-patients/${passedSessionData.ai_patient_id}`);
      if (!patientResponse.ok) {
        throw new Error('Failed to fetch patient data');
      }
      
      const { patient } = await patientResponse.json();
      console.log('[S1] Patient data loaded:', patient);
      
      // Map primary_concern to patient_type for prompt loading
      const concernToType: Record<string, string> = {
        'anxiety': 'anxiety_patient',
        'depression': 'depression_patient', 
        'trauma': 'trauma_patient' // This will need to be created in database
      };
      
      const patientType = concernToType[patient.primary_concern] || 'anxiety_patient';
      console.log('[S1] Mapped concern to type:', { primary_concern: patient.primary_concern, patient_type: patientType });
      
      // Map session data to expected format
      const sessionData = {
        ai_patient_id: passedSessionData.ai_patient_id,
        ai_patient_name: passedSessionData.ai_patient_name,
        primary_concern: patient.primary_concern,
        patient_type: patientType
      };
      setSessionData(sessionData);

      // Set S1 session in store - use the actual session data
      setS1Session({
        sessionId: sessionId, // This comes from the parent component after session creation
        aiPatientId: sessionData.ai_patient_id,
        aiPatientName: sessionData.ai_patient_name,
        primaryConcern: sessionData.primary_concern,
        sessionStatus: 'active'
      });

      // Load AI patient prompts from S1 database
      const patientPrompt = await loadPatientPrompt(sessionData.patient_type);
      
      if (!patientPrompt) {
        throw new Error('Could not load AI patient prompts');
      }

      // Create WebRTC configuration for AI patient
      const connectionConfig: ConnectionConfig = {
        instructions: patientPrompt.prompt_content,
        voice: 'alloy', // Same voice as V16 for consistency
        tools: [], // No tools needed for AI patients
        tool_choice: 'none',
        greetingInstructions: '' // S1: Allow auto-greeting - user wants to see/hear it
      };

      // Pre-initialize WebRTC with AI patient configuration
      await preInitialize(connectionConfig);

      // Set up message handling
      setupMessageHandling();

      // Connect to WebRTC - let OpenAI Realtime API handle microphone access automatically
      console.log('[S1] Connecting to WebRTC with microphone input enabled...');
      await connect();

      // In S1, the therapist should start the conversation
      // No auto-generated welcome message from AI patient

    } catch (error) {
      console.error('[S1] Error initializing session:', error);
    } finally {
      setConnecting(false);
      initializingRef.current = false; // Reset flag on completion or error
    }
  }, [sessionId, passedSessionData, loadPatientPrompt, preInitialize, setS1Session, connect, setupMessageHandling]);

  useEffect(() => {
    console.log('[S1] Session interface mounted for session:', sessionId);
    startTimer();
    initializeSession();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      disconnect();
    };
  }, [sessionId, disconnect, initializeSession]); // Include initializeSession dependency

  // Auto-start recording session when WebRTC connects
  useEffect(() => {
    const startRecordingSession = async () => {
      if (isConnected && !isRecordingSession) {
        console.log('[S1] WebRTC connected - initializing recording session');
        
        try {
          // Wait a moment to ensure WebRTC connection is established
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Get the SAME stream that WebRTC is using from connection manager
          const connectionManager = useS1WebRTCStore.getState().connectionManager;
          if (!connectionManager) {
            console.log('[S1] ConnectionManager not available - session may have ended');
            return; // Exit gracefully instead of throwing error
          }
          
          const stream = connectionManager.getAudioInputStream();
          if (!stream) {
            throw new Error('WebRTC audio stream not available');
          }
          
          console.log('[S1] Using WebRTC audio stream for recording:', {
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
              audioChunksRef.current.push(event.data);
              console.log('[S1] Audio chunk collected:', event.data.size, 'bytes (from WebRTC stream)');
            }
          };
          
          mediaRecorder.onstop = () => {
            console.log('[S1] Recording session ended. Total chunks:', audioChunksRef.current.length);
            setIsRecordingSession(false);
          };
          
          // Start recording session (captures same audio as WebRTC conversation)
          mediaRecorder.start(5000); // 5-second chunks for better debugging
          setIsRecordingSession(true);
          setRecordingStatus(isMuted ? 'Recording Muted' : 'Recording');
          
          console.log('[S1] ✅ Recording session started using WebRTC stream:', {
            mimeType,
            streamId: stream.id,
            streamActive: stream.active,
            audioTracks: stream.getAudioTracks().length,
            chunkInterval: 5000
          });
          
        } catch (error) {
          console.error('[S1] Failed to initialize recording session:', error);
          setRecordingStatus('Recording failed to initialize: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      }
    };
    
    startRecordingSession();
  }, [isConnected, isRecordingSession, isMuted]);

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  // Update recording status when mic mute state changes
  useEffect(() => {
    if (isRecordingSession) {
      setRecordingStatus(isMuted ? 'Recording Muted' : 'Recording');
    }
  }, [isMuted, isRecordingSession]);

  const handleSendMessage = async () => {
    if (!therapistMessage.trim() || !isConnected) return;

    console.log('[S1] Therapist sending message:', therapistMessage);

    // Add therapist message to conversation immediately
    addConversationMessage({
      id: 'therapist_' + Date.now(),
      role: 'therapist',
      text: therapistMessage,
      timestamp: new Date().toISOString(),
      isFinal: true,
      status: 'final'
    });

    // Send message through WebRTC
    const success = sendMessage(therapistMessage);
    
    if (success) {
      clearTherapistMessage();
    } else {
      console.error('[S1] Failed to send message through WebRTC');
    }
  };

  // Remove fake AI response generation - using real WebRTC now

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice recording functions - now automatic based on session state
  
  const endRecordingSession = useCallback(async () => {
    if (mediaRecorderRef.current && isRecordingSession) {
      console.log('[S1] Ending recording session');
      mediaRecorderRef.current.stop();
      
      // Don't stop the microphone stream - it belongs to WebRTC
      // Just clear our reference to it
      micStreamRef.current = null;
      
      setRecordingStatus('Recording session ended. Auto-uploading voice...');
      
      // Auto-upload after a short delay to ensure MediaRecorder has finished
      setTimeout(async () => {
        if (audioChunksRef.current.length === 0) {
          console.log('[S1] ❌ No audio chunks captured during session');
          setRecordingStatus('No voice recorded during session.');
          return;
        }
        
        console.log('[S1] 🎤 Audio chunks captured, starting upload:', {
          totalChunks: audioChunksRef.current.length,
          totalSize: audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        });
        
        try {
          setIsUploading(true);
          setRecordingStatus('Uploading voice to cloud...');
          
          // Combine all chunks into single blob
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm' 
          });
          
          console.log('[S1] 📤 Auto-uploading voice recording:', {
            size: audioBlob.size,
            type: audioBlob.type,
            chunks: audioChunksRef.current.length,
            sessionId: sessionId
          });
          
          // Create FormData for upload
          const formData = new FormData();
          formData.append('audio', audioBlob, `therapist-voice-${sessionId}-${Date.now()}.webm`);
          formData.append('session_id', sessionId);
          formData.append('purpose', 'voice_cloning');
          
          // Upload to server
          const response = await fetch('/api/s1/voice-upload', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log('[S1] Voice auto-upload successful:', result);
          
          setRecordingStatus('✅ Voice uploaded successfully for cloning!');
          
          // Clear chunks from memory
          audioChunksRef.current = [];
          
          // Hide status after 5 seconds
          setTimeout(() => setRecordingStatus(''), 5000);
          
        } catch (error) {
          console.error('[S1] Voice auto-upload failed:', error);
          setRecordingStatus('❌ Upload failed. Session ended but voice not saved.');
          setTimeout(() => setRecordingStatus(''), 8000);
        } finally {
          setIsUploading(false);
        }
      }, 1000);
    }
  }, [isRecordingSession, sessionId]);
  

  const endSession = async () => {
    // End recording session if active
    if (isRecordingSession) {
      endRecordingSession();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    const confirmed = confirm('Are you sure you want to end this session?');
    if (confirmed) {
      await disconnect();
      onSessionEnd();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading state while connecting
  if (connecting || promptLoading) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {connecting ? 'Connecting to AI Patient...' : 'Loading patient profile...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Session Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {sessionData?.ai_patient_name?.[0] || 'P'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                {sessionData?.ai_patient_name || 'AI Patient'}
              </h2>
              <p className="text-sm text-gray-500 capitalize">
                {sessionData?.primary_concern?.replace('_', ' ') || 'Session'}
              </p>
            </div>
            <div className={`px-2 py-1 text-xs rounded-full ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Voice Recording Status - Show during session and upload */}
            {recordingStatus && (isRecordingSession || isUploading || recordingStatus.includes('✅') || recordingStatus.includes('❌')) && (
              <div className="flex items-center space-x-2">
                {isRecordingSession && (
                  <div className={`w-2 h-2 rounded-full ${
                    isMuted ? 'bg-gray-800' : 'bg-red-600 animate-pulse'
                  }`} />
                )}
                <div className="text-xs text-gray-600">
                  {recordingStatus}
                </div>
              </div>
            )}
            
            
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {formatTime(sessionTimer)}
              </div>
              <div className="text-xs text-gray-500">Session Time</div>
            </div>
            
            <button
              onClick={endSession}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm"
            >
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {conversation.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'therapist' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                message.role === 'therapist'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-900 shadow-sm border'
              }`}
            >
              <p className="text-sm">{message.text}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs opacity-75">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
                {message.emotional_tone && (
                  <span className="text-xs opacity-75 capitalize">
                    {message.emotional_tone}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-lg text-sm">
              AI Patient is thinking...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-end space-x-3">
          {/* Audio Controls (copied from V16) */}
          <div className="flex items-center space-x-2">
            {/* Speaker Mute Button */}
            <button
              type="button"
              onClick={toggleAudioOutputMute}
              className={`p-2 rounded-md border ${isAudioOutputMuted ? 'bg-red-100 border-red-300 text-red-600' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
              aria-label={isAudioOutputMuted ? "Unmute speakers" : "Mute speakers"}
              title={isAudioOutputMuted ? "Unmute speakers" : "Mute speakers"}
            >
              {isAudioOutputMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
                  <path d="M11 5L6 9H2v6h4l3 3V16" stroke="currentColor" strokeWidth="2" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l3 3V5z" stroke="currentColor" strokeWidth="2" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" strokeWidth="2" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </button>

            {/* Microphone Mute Button */}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-2 rounded-md border ${isMuted ? 'bg-red-100 border-red-300 text-red-600' : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'}`}
              aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
              title={isMuted ? "Unmute microphone" : "Mute microphone"}
            >
              {isMuted ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 19v4" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 23h8" stroke="currentColor" strokeWidth="2" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 19v4" stroke="currentColor" strokeWidth="2" />
                  <path d="M8 23h8" stroke="currentColor" strokeWidth="2" />
                </svg>
              )}
            </button>
          </div>

          <div className="flex-1">
            <textarea
              value={therapistMessage}
              onChange={(e) => updateTherapistMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Typing disabled for case simulations"
              disabled={true}
              className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              rows={2}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={true}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionInterface;