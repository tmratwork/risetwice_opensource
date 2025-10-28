// src/app/dashboard/provider/messages/page.tsx
// Provider view of patient audio replies and conversation threads

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import { getUserRole } from '@/utils/user-role';

interface Message {
  id: string;
  senderType: 'provider' | 'patient';
  audioUrl: string;
  durationSeconds: number;
  readAt: string | null;
  createdAt: string;
}

interface Conversation {
  patientUserId: string;
  intakeId: string;
  accessCode: string;
  messages: Message[];
}

const ProviderMessagesPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recording state
  const [recordingForConvo, setRecordingForConvo] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 1800) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const fetchMessages = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/provider/patient-messages?provider_user_id=${user.uid}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch messages');
      }

      setConversations(result.conversations || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const role = await getUserRole(user.uid);

        if (role !== 'provider') {
          router.push('/dashboard/patient');
          return;
        }

        fetchMessages();
      } catch (error) {
        console.error('Error checking provider access:', error);
        router.push('/dashboard/patient');
      }
    }

    checkAccess();
  }, [user, authLoading, router]);

  const markAsRead = async (messageId: string) => {
    if (!user?.uid) return;

    try {
      await fetch('/api/provider/mark-message-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, providerUserId: user.uid })
      });

      // Update local state
      setConversations(prev =>
        prev.map(convo => ({
          ...convo,
          messages: convo.messages.map(msg =>
            msg.id === messageId ? { ...msg, readAt: new Date().toISOString() } : msg
          )
        }))
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const startRecording = async (convoKey: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        setRecordedAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      setRecordingForConvo(convoKey);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure microphone permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
    setRecordingTime(0);
    setRecordingForConvo(null);
  };

  const uploadReply = async (convo: Conversation) => {
    if (!recordedAudioBlob || !user?.uid) return;

    setIsUploading(true);
    try {
      const fileExt = recordedAudioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const timestamp = Date.now();
      const fileName = `${convo.accessCode}/${user.uid}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

      const formData = new FormData();
      formData.append('audio', recordedAudioBlob, fileName);
      formData.append('accessCode', convo.accessCode);
      formData.append('providerUserId', user.uid);
      formData.append('patientUserId', convo.patientUserId);
      formData.append('intakeId', convo.intakeId);
      formData.append('fileName', fileName);
      formData.append('durationSeconds', recordingTime.toString());
      formData.append('mimeType', recordedAudioBlob.type);

      const response = await fetch('/api/provider/upload-audio-response', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // Refresh messages
      await fetchMessages();
      cancelRecording();
      alert('Message sent successfully!');
    } catch (error) {
      console.error('Error uploading message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading messages...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen" style={{ backgroundColor: '#c1d7ca', paddingTop: '80px' }}>
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => router.push('/dashboard/provider')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: '#c1d7ca', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard/provider')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-800">Patient Messages</h1>
            <button
              onClick={fetchMessages}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Conversations */}
          {conversations.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Messages Yet</h3>
              <p className="text-gray-600">
                Patient replies to your audio messages will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {conversations.map((convo) => {
                const convoKey = `${convo.patientUserId}-${convo.intakeId}`;
                return (
                  <div key={convoKey} className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          Patient - Intake #{convo.accessCode}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {convo.messages.length} message{convo.messages.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(`/dashboard/provider/intake/${convo.accessCode}`)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Full Intake
                      </button>
                    </div>

                    {/* Message Thread */}
                    <div className="space-y-4 mb-6">
                      {convo.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-4 rounded-lg ${
                            msg.senderType === 'patient'
                              ? 'bg-green-50 border border-green-200'
                              : 'bg-blue-50 border border-blue-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-800">
                              {msg.senderType === 'patient' ? 'Patient' : 'You'}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-600">{formatDate(msg.createdAt)}</span>
                              {msg.senderType === 'patient' && !msg.readAt && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  New
                                </span>
                              )}
                            </div>
                          </div>
                          <audio
                            controls
                            className="w-full"
                            onPlay={() => {
                              if (msg.senderType === 'patient' && !msg.readAt) {
                                markAsRead(msg.id);
                              }
                            }}
                          >
                            <source src={msg.audioUrl} />
                          </audio>
                          <p className="text-xs text-gray-600 mt-1">Duration: {formatTime(msg.durationSeconds)}</p>
                        </div>
                      ))}
                    </div>

                    {/* Reply Section */}
                    {recordingForConvo !== convoKey ? (
                      <button
                        onClick={() => startRecording(convoKey)}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                        Record Message
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {!recordedAudioUrl ? (
                          <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                              <span className="text-gray-800 font-medium">Recording: {formatTime(recordingTime)}</span>
                            </div>
                            <button
                              onClick={stopRecording}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                              Stop
                            </button>
                          </div>
                        ) : (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-blue-800 font-medium mb-2">Preview ({formatTime(recordingTime)})</p>
                            <audio controls className="w-full mb-3">
                              <source src={recordedAudioUrl} type={recordedAudioBlob?.type} />
                            </audio>
                            <div className="flex gap-2">
                              <button
                                onClick={() => uploadReply(convo)}
                                disabled={isUploading}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                              >
                                {isUploading ? 'Sending...' : 'Send Message'}
                              </button>
                              <button
                                onClick={cancelRecording}
                                disabled={isUploading}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProviderMessagesPage;
