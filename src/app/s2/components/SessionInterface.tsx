// src/app/s2/components/SessionInterface.tsx
// S2 Case Simulation Session Interface - WebRTC with cleaner styling

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useS1WebRTCStore } from '@/stores/s1-webrtc-store';
import { useAuth } from '@/contexts/auth-context';
import type { ConnectionConfig } from '@/hooksV15/types';

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
      interactionStyle: number;
      tone: number;
      energyLevel: number;
    };
  };
  generatedScenario?: string;
}

interface SessionInterfaceProps {
  sessionData: SessionData & { scenarioId?: string };
  onEndSession: () => void;
}

interface Message {
  id: string;
  role: 'therapist' | 'patient';
  text: string;
  timestamp: string;
  isFinal: boolean;
  status: string;
}

const SessionInterface: React.FC<SessionInterfaceProps> = ({
  sessionData,
  onEndSession
}) => {
  const [sessionTimer, setSessionTimer] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [therapistMessage, setTherapistMessage] = useState('');
  const [s2SessionId, setS2SessionId] = useState<string>('');
  
  // Voice recording state (copied from S1)
  const [isRecordingSession, setIsRecordingSession] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<string>('Recording ready - unmute mic to start');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initializingRef = useRef<boolean>(false);
  
  // Voice recording refs (copied from S1)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Auth context
  const { user } = useAuth();

  // S1 WebRTC Store (reusing for S2)
  const isConnected = useS1WebRTCStore(state => state.isConnected);
  const isThinking = useS1WebRTCStore(state => state.isThinking);
  const isMuted = useS1WebRTCStore(state => state.isMuted);
  const sendMessage = useS1WebRTCStore(state => state.sendMessage);
  const connect = useS1WebRTCStore(state => state.connect);
  const disconnect = useS1WebRTCStore(state => state.disconnect);
  const preInitialize = useS1WebRTCStore(state => state.preInitialize);
  const setTranscriptCallback = useS1WebRTCStore(state => state.setTranscriptCallback);
  const toggleMute = useS1WebRTCStore(state => state.toggleMute);
  const setS1Session = useS1WebRTCStore(state => state.setS1Session);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setSessionTimer(prev => prev + 1);
    }, 1000);
  };

  const saveMessageToDatabase = useCallback(async (message: Message) => {
    if (!s2SessionId || !user?.uid) return;

    try {
      const response = await fetch('/api/s2/session', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'save_message',
          sessionId: s2SessionId,
          userId: user.uid,
          messageData: {
            role: message.role,
            content: message.text,
            timestamp: message.timestamp,
            messageId: message.id
          }
        })
      });

      const data = await response.json();
      if (!data.success) {
        console.error('[S2] Failed to save message to database:', data.error);
      }
    } catch (error) {
      console.error('[S2] Error saving message to database:', error);
    }
  }, [s2SessionId, user?.uid]);

  const setupMessageHandling = useCallback(() => {
    setTranscriptCallback(({ id, data, metadata }) => {
      const isFinal = metadata?.isFinal === true;
      const metadataRole = (metadata as { role?: string })?.role || "assistant";
      const isUserMessage = metadataRole === 'user' || id.includes('user-');
      const role = isUserMessage ? 'therapist' : 'patient';

      if (isFinal && data) {
        const newMessage: Message = {
          id: `${role}_${id}`,
          role,
          text: data,
          timestamp: new Date().toISOString(),
          isFinal: true,
          status: 'final'
        };
        
        setConversation(prev => [...prev, newMessage]);
        
        // Save message to database
        saveMessageToDatabase(newMessage);
      }
    });
  }, [setTranscriptCallback, saveMessageToDatabase]);

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
- Interaction Style: ${getStyleDescription(communicationStyle.interactionStyle, 'receptive to suggestions', 'prefer guided self-reflection')}
- Tone: ${getStyleDescription(communicationStyle.tone, 'casual and conversational', 'formal and clinical')}
- Energy Level: ${getStyleDescription(communicationStyle.energyLevel, 'expressive and animated', 'calm and measured')}

Stay in character as the patient throughout the session. Respond naturally to the therapist's interventions while maintaining consistency with the scenario and the therapist's preferred style. Be authentic to the patient's struggles while being appropriately responsive to therapeutic techniques that match the therapist's approach.`;
  }, [sessionData]);

  const createS2Session = useCallback(async (aiPersonalityPrompt: string) => {
    if (!user?.uid) {
      console.error('[S2] Cannot create session - user not authenticated');
      return null;
    }

    if (!sessionData.scenarioId) {
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
    // Prevent double initialization in React Strict Mode (exactly like S1)
    if (initializingRef.current) {
      console.log('[S2] Session already initializing, skipping...');
      return;
    }

    try {
      initializingRef.current = true;
      setConnecting(true);
      console.log('[S2] Initializing case simulation session...');

      // Generate AI personality prompt based on user selections
      const aiPersonalityPrompt = generateAIPersonalityPrompt();
      console.log('[S2] Generated AI personality prompt:', aiPersonalityPrompt.slice(0, 200) + '...');

      // Create S2 session in database
      const createdSessionId = await createS2Session(aiPersonalityPrompt);
      if (!createdSessionId) {
        throw new Error('Failed to create S2 session in database');
      }

      // Set S2 session in store - exactly like S1 pattern
      setS1Session({
        sessionId: createdSessionId,
        aiPatientId: 's2_ai_patient',
        aiPatientName: 'AI Patient (S2)',
        primaryConcern: 'custom_scenario',
        sessionStatus: 'active'
      });

      // Create WebRTC configuration for AI patient (identical to S1)
      const connectionConfig: ConnectionConfig = {
        instructions: aiPersonalityPrompt,
        voice: 'alloy', // Same voice as S1 for consistency
        tools: [], // No tools needed for AI patients
        tool_choice: 'none',
        greetingInstructions: '' // S2: Allow auto-greeting - user wants to see/hear it
      };

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

  useEffect(() => {
    console.log('[S2] Case simulation interface mounted');
    startTimer();
    initializeSession();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
              audioChunksRef.current.push(event.data);
              console.log('[S2] Audio chunk collected:', event.data.size, 'bytes (from WebRTC stream)');
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
      setRecordingStatus(isMuted ? 'Recording Muted' : 'Recording');
    }
  }, [isMuted, isRecordingSession]);

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSendMessage = async () => {
    if (!therapistMessage.trim() || !isConnected) return;

    console.log('[S2] Therapist sending message:', therapistMessage);

    // Add therapist message to conversation immediately
    const newMessage: Message = {
      id: 'therapist_' + Date.now(),
      role: 'therapist',
      text: therapistMessage,
      timestamp: new Date().toISOString(),
      isFinal: true,
      status: 'final'
    };
    
    setConversation(prev => [...prev, newMessage]);
    
    // Save message to database
    saveMessageToDatabase(newMessage);

    // Send message through WebRTC
    const success = sendMessage(therapistMessage);
    
    if (success) {
      setTherapistMessage('');
    } else {
      console.error('[S2] Failed to send message through WebRTC');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Voice recording functions - now automatic based on session state (copied from S1)
  const endRecordingSession = useCallback(async () => {
    if (mediaRecorderRef.current && isRecordingSession) {
      console.log('[S2] Ending recording session');
      mediaRecorderRef.current.stop();
      
      // Don't stop the microphone stream - it belongs to WebRTC
      // Just clear our reference to it
      micStreamRef.current = null;
      
      setRecordingStatus('Recording session ended. Auto-uploading voice...');
      
      // Auto-upload after a short delay to ensure MediaRecorder has finished
      setTimeout(async () => {
        if (audioChunksRef.current.length === 0) {
          console.log('[S2] ❌ No audio chunks captured during session');
          setRecordingStatus('No voice recorded during session.');
          return;
        }
        
        console.log('[S2] 🎤 Audio chunks captured, starting upload:', {
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
          
          console.log('[S2] 📤 Auto-uploading voice recording:', {
            size: audioBlob.size,
            type: audioBlob.type,
            chunks: audioChunksRef.current.length,
            sessionId: s2SessionId
          });
          
          // Create FormData for upload
          const formData = new FormData();
          formData.append('audio', audioBlob, `s2-therapist-voice-${s2SessionId}-${Date.now()}.webm`);
          formData.append('session_id', s2SessionId);
          formData.append('purpose', 'voice_recording');
          
          // Upload to S2 server
          const response = await fetch('/api/s2/voice-upload', {
            method: 'POST',
            body: formData
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log('[S2] Voice auto-upload successful:', result);
          
          setRecordingStatus('✅ Voice uploaded successfully!');
          
          // Clear chunks from memory
          audioChunksRef.current = [];
          
          // Hide status after 5 seconds
          setTimeout(() => setRecordingStatus(''), 5000);
          
        } catch (error) {
          console.error('[S2] Voice auto-upload failed:', error);
          setRecordingStatus('❌ Upload failed. Session ended but voice not saved.');
          setTimeout(() => setRecordingStatus(''), 8000);
        } finally {
          setIsUploading(false);
        }
      }, 1000);
    }
  }, [isRecordingSession, s2SessionId]);

  const endSession = async () => {
    console.log('[S2] Ending case simulation session');
    
    // End recording session if active (copied from S1)
    if (isRecordingSession) {
      endRecordingSession();
    }
    
    // Update session status in database
    if (s2SessionId && user?.uid) {
      try {
        console.log('[S2] Updating session status to completed...');
        
        const response = await fetch('/api/s2/session', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'end_session',
            sessionId: s2SessionId,
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
    <div className="flex flex-col h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* Session Header - Clean styling like mockup */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 pt-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-700 font-medium">🌱</span>
            </div>
            <div>
              <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                RiseTwice Case Simulation
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Step 4 of 9 - AI Patient Session
              </p>
            </div>
            <div className={`px-2 py-1 text-xs rounded-full ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Voice Recording Status - Show during session and upload (copied from S1) */}
            {recordingStatus && (isRecordingSession || isUploading || recordingStatus.includes('✅') || recordingStatus.includes('❌')) && (
              <div className="flex items-center space-x-2">
                {isRecordingSession && (
                  <div className={`w-2 h-2 rounded-full ${
                    isMuted ? 'bg-gray-400' : 'bg-red-600 animate-pulse'
                  }`} />
                )}
                <div className="text-xs text-gray-600">
                  {recordingStatus}
                </div>
              </div>
            )}
            
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatTime(sessionTimer)}
              </div>
            </div>
            
            <button
              onClick={endSession}
              className="control-button"
              style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              End Session
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {conversation.length === 0 && isConnected && (
          <div className="text-center py-8">
            <div className="bg-blue-50 rounded-lg p-6 max-w-2xl mx-auto">
              <h3 className="text-lg font-medium text-blue-900 mb-2">Session Ready</h3>
              <p className="text-blue-700 text-sm">
                Your AI patient is ready. Begin the session by speaking or typing your first message.
              </p>
            </div>
          </div>
        )}

        {conversation.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'therapist' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-3xl ${message.role === 'therapist' ? 'ml-12' : 'mr-12'}`}>
              <div className="flex items-start space-x-3">
                {message.role === 'patient' && (
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm font-medium">AI Assistant</span>
                    </div>
                  </div>
                )}
                
                <div
                  className={`px-4 py-3 rounded-lg ${
                    message.role === 'therapist'
                      ? 'bg-green-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-900'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.text}
                  </p>
                </div>

                {message.role === 'therapist' && (
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-700 text-sm font-medium">You</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="max-w-3xl mr-12">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 text-sm font-medium">AI Assistant</span>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 text-gray-900 px-4 py-3 rounded-lg">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Clean styling like mockup */}
      <div className="border-t border-gray-200 bg-white p-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-colors ${
              isMuted 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
          </button>

          <div className="flex-1">
            <textarea
              value={therapistMessage}
              onChange={(e) => setTherapistMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message to the patient or speak directly..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              rows={1}
              disabled={!isConnected}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={!therapistMessage.trim() || !isConnected}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              therapistMessage.trim() && isConnected
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionInterface;