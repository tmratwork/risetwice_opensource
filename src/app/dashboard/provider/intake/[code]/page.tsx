// src/app/dashboard/provider/intake/[code]/page.tsx
// Provider view of patient intake information by access code

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { getUserRole } from '@/utils/user-role';
import { Header } from '@/components/header';

interface IntakeData {
  id: string;
  fullLegalName: string;
  preferredName: string | null;
  pronouns: string | null;
  dateOfBirth: string;
  gender: string | null;
  email: string;
  phone: string;
  state: string;
  city: string;
  zipCode: string;
  insuranceProvider: string;
  insurancePlan: string | null;
  insuranceId: string | null;
  isSelfPay: boolean;
  budgetPerSession: string | null;
  sessionPreference: string;
  availability: string[];
  status: string;
  createdAt: string;
  conversationId: string | null;
  userId: string;
}

interface IntakeSummary {
  summaryText: string;
  formDataSummary?: {
    clientProfile: string | null;
    presentingConcern: string | null;
    primaryGoal: string | null;
    therapyHistory: string | null;
    clinicalBackground: string | null;
    desiredStyle: string | null;
    keyPreferences: string | null;
  } | null;
  keyConcerns: string[];
  urgencyLevel: string;
  recommendedSpecializations: string[];
  voiceTranscript: string | null;
}

// Collapsible Panel Component
const CollapsiblePanel: React.FC<{
  id: string;
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ title, isCollapsed, onToggle, children, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-sm border mb-6 ${className}`}>
      <div
        className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        <svg
          className={`w-6 h-6 text-gray-600 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {!isCollapsed && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  );
};

const ProviderIntakeView: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [intakeData, setIntakeData] = useState<IntakeData | null>(null);
  const [summary, setSummary] = useState<IntakeSummary | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [hasAudio, setHasAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chunkCount, setChunkCount] = useState<number>(0);
  const [needsCombination, setNeedsCombination] = useState(false);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string>('');
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  // Collapsible panels state
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});

  // Provider audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [providerRecordings, setProviderRecordings] = useState<Array<{
    id: string;
    audioUrl: string;
    createdAt: string;
    durationSeconds: number;
  }>>([]);
  const [loadingRecordings, setLoadingRecordings] = useState(true);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('provider-intake-collapsed-panels');
    if (saved) {
      try {
        setCollapsedPanels(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse collapsed panels state:', e);
      }
    }
  }, []);

  // Save collapsed state to localStorage
  const togglePanel = (panelId: string) => {
    setCollapsedPanels(prev => {
      const newState = { ...prev, [panelId]: !prev[panelId] };
      localStorage.setItem('provider-intake-collapsed-panels', JSON.stringify(newState));
      return newState;
    });
  };

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 1800) { // 30 minutes = 1800 seconds
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

  // Fetch provider recordings
  const fetchProviderRecordings = async (intakeId: string) => {
    try {
      const response = await fetch(`/api/provider/audio-responses?intake_id=${intakeId}`);
      const result = await response.json();

      if (result.success && result.recordings) {
        setProviderRecordings(result.recordings);
      }
    } catch (error) {
      console.error('Error fetching provider recordings:', error);
    } finally {
      setLoadingRecordings(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine MIME type based on browser support
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedAudioUrl(url);
        setRecordedAudioBlob(blob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure microphone permissions are granted.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (recordedAudioUrl) {
      URL.revokeObjectURL(recordedAudioUrl);
    }
    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
    setRecordingTime(0);
  };

  // Upload recording
  const uploadRecording = async () => {
    if (!recordedAudioBlob || !intakeData) return;

    setIsUploading(true);
    try {
      // Get file extension from blob type
      const fileExt = recordedAudioBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const timestamp = Date.now();
      const fileName = `${code}/${user?.uid}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

      // Create FormData
      const formData = new FormData();
      formData.append('audio', recordedAudioBlob, fileName);
      formData.append('accessCode', code);
      formData.append('providerUserId', user?.uid || '');
      formData.append('patientUserId', intakeData.userId || '');
      formData.append('intakeId', intakeData.id);
      formData.append('fileName', fileName);
      formData.append('durationSeconds', recordingTime.toString());
      formData.append('mimeType', recordedAudioBlob.type);

      const response = await fetch('/api/provider/upload-audio-response', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      // Refresh recordings list
      await fetchProviderRecordings(intakeData.id);

      // Clear recording
      cancelRecording();
      alert('Audio response uploaded successfully!');
    } catch (error) {
      console.error('Error uploading recording:', error);
      alert('Failed to upload recording. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    async function loadIntakeData() {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const role = await getUserRole(user.uid);

        // Redirect non-providers
        if (role !== 'provider') {
          router.push('/dashboard/patient');
          return;
        }

        // Validate access code
        if (!code || code.length !== 5) {
          setError('Invalid access code');
          setLoading(false);
          return;
        }

        // Fetch intake data
        const response = await fetch('/api/provider/validate-intake-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessCode: code,
            providerUserId: user.uid
          })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          setError(result.error || 'Invalid access code');
          setLoading(false);
          return;
        }

        setIntakeData(result.intake);
        setLoading(false);

        // Fetch audio recording
        fetchAudioRecording(result.intake.id);

        // Fetch transcript
        fetchTranscript(result.intake.id);

        // Fetch AI summary (will wait for transcript)
        fetchSummary(result.intake.id);

        // Fetch provider recordings
        fetchProviderRecordings(result.intake.id);

      } catch (error) {
        console.error('Error loading intake data:', error);
        setError('Failed to load intake data');
        setLoading(false);
      }
    }

    loadIntakeData();
  }, [user, authLoading, router, code]);

  const fetchAudioRecording = async (intakeId: string) => {
    try {
      console.log('[provider_intake] 🎵 Fetching audio for intake:', intakeId);
      const response = await fetch(`/api/provider/intake-audio?intake_id=${intakeId}`);
      const result = await response.json();

      console.log('[provider_intake] 📋 Audio fetch result:', result);

      if (result.success && result.hasRecording) {
        if (result.audioUrl) {
          console.log('[provider_intake] ✅ Audio URL ready');
          setAudioUrl(result.audioUrl);
          setHasAudio(true);
          setNeedsCombination(false);

          // Clear polling if it exists
          if (pollingInterval) {
            console.log('[provider_intake] 🛑 Clearing polling interval');
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        } else if (result.needsCombination) {
          console.log('[provider_intake] ⏳ Audio needs combination, status:', result.jobStatus);
          setHasAudio(true);
          setNeedsCombination(true);
          setChunkCount(result.chunkCount || 0);
          setJobStatus(result.jobStatus || 'processing');

          // Start polling if status is processing and not already polling
          if (result.jobStatus === 'processing' && !pollingInterval) {
            console.log('[provider_intake] 🔄 Starting polling for audio combination');
            startPolling(intakeId);
          }
        }
      } else {
        setHasAudio(false);
      }
    } catch (error) {
      console.error('[provider_intake] ❌ Error fetching audio:', error);
      setHasAudio(false);
    } finally {
      setAudioLoading(false);
    }
  };

  const startPolling = (intakeId: string) => {
    // Store interval reference locally to avoid closure issues
    let localInterval: NodeJS.Timeout | null = null;

    const pollAudio = async () => {
      console.log('[provider_intake] 🔍 Polling audio status...');

      try {
        const response = await fetch(`/api/provider/intake-audio?intake_id=${intakeId}`);
        const result = await response.json();

        console.log('[provider_intake] 📊 Poll result:', {
          hasRecording: result.hasRecording,
          audioUrl: !!result.audioUrl,
          jobStatus: result.jobStatus
        });

        if (result.success && result.hasRecording && result.audioUrl) {
          console.log('[provider_intake] 🛑 Audio ready - stopping polling');

          // Clear local interval
          if (localInterval) {
            clearInterval(localInterval);
            localInterval = null;
            console.log('[provider_intake] ✅ Local interval cleared');
          }

          // Clear state interval
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
            console.log('[provider_intake] ✅ State interval cleared');
          }

          // Update state
          setAudioUrl(result.audioUrl);
          setNeedsCombination(false);
          setJobStatus('completed');

          return;
        }

        // Update status if still processing
        if (result.jobStatus) {
          setJobStatus(result.jobStatus);
        }
      } catch (error) {
        console.error('[provider_intake] ❌ Polling error:', error);
      }
    };

    // Initial poll
    pollAudio();

    // Poll every 2 seconds
    localInterval = setInterval(pollAudio, 2000);
    setPollingInterval(localInterval);
  };

  // Cleanup polling on unmount
  React.useEffect(() => {
    return () => {
      if (pollingInterval) {
        console.log('[provider_intake] 🧹 Cleaning up polling on unmount');
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const fetchSummary = async (intakeId: string) => {
    try {
      const response = await fetch(`/api/provider/intake-summary?intake_id=${intakeId}`);
      const result = await response.json();

      if (result.success && result.summary) {
        setSummary(result.summary);
        setSummaryLoading(false);
      } else if (result.status === 'pending_transcript') {
        // Summary waiting for transcript - keep loading state
        console.log('Summary pending transcript:', result.message);
        // Poll again in 3 seconds
        setTimeout(() => fetchSummary(intakeId), 3000);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSummaryLoading(false);
    }
  };

  const fetchTranscript = async (intakeId: string) => {
    try {
      const response = await fetch(`/api/provider/intake-transcript?intake_id=${intakeId}`);
      const result = await response.json();

      if (result.success && result.transcript) {
        setTranscript(result.transcript);
        setTranscriptStatus(result.status);
      } else if (result.status === 'processing') {
        setTranscriptStatus('processing');
        // Poll again in 3 seconds
        setTimeout(() => fetchTranscript(intakeId), 3000);
      }
    } catch (error) {
      console.error('Error fetching transcript:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading patient intake...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="min-h-screen" style={{ backgroundColor: '#c1d7ca', paddingTop: '80px', paddingBottom: '80px' }}>
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
              <p className="text-red-700">{error}</p>
              <button
                onClick={() => router.push('/dashboard/provider')}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!intakeData) {
    return null;
  }

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: '#c1d7ca', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard/provider')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Dashboard
            </button>
            <div className="text-right">
              <h1 className="text-3xl font-bold mb-2 text-gray-800">
                Patient Intake Details
              </h1>
              <p className="text-gray-600">Access Code: {code}</p>
            </div>
          </div>

          {/* AI Summary Section */}
          {!summaryLoading && summary && (
            <CollapsiblePanel
              id="ai-summary"
              title="AI Summary"
              isCollapsed={collapsedPanels['ai-summary'] || false}
              onToggle={() => togglePanel('ai-summary')}
            >
              <div className="space-y-4">
                {summary.formDataSummary?.clientProfile && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Client Profile</h3>
                    <p className="text-gray-700">{summary.formDataSummary.clientProfile}</p>
                  </div>
                )}

                {summary.formDataSummary?.presentingConcern && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Presenting Concern</h3>
                    <p className="text-gray-700">{summary.formDataSummary.presentingConcern}</p>
                  </div>
                )}

                {summary.formDataSummary?.primaryGoal && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Primary Goal</h3>
                    <p className="text-gray-700">{summary.formDataSummary.primaryGoal}</p>
                  </div>
                )}

                {summary.formDataSummary?.therapyHistory && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Therapy History</h3>
                    <p className="text-gray-700">{summary.formDataSummary.therapyHistory}</p>
                  </div>
                )}

                {summary.formDataSummary?.clinicalBackground && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Clinical Background</h3>
                    <p className="text-gray-700">{summary.formDataSummary.clinicalBackground}</p>
                  </div>
                )}

                {summary.formDataSummary?.desiredStyle && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Desired Therapeutic Style</h3>
                    <p className="text-gray-700">{summary.formDataSummary.desiredStyle}</p>
                  </div>
                )}

                {summary.formDataSummary?.keyPreferences && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">Key Preferences</h3>
                    <p className="text-gray-700">{summary.formDataSummary.keyPreferences}</p>
                  </div>
                )}

                {summary.urgencyLevel && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Urgency Level</h3>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      summary.urgencyLevel === 'crisis' ? 'bg-red-100 text-red-800' :
                      summary.urgencyLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                      summary.urgencyLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {summary.urgencyLevel.charAt(0).toUpperCase() + summary.urgencyLevel.slice(1)}
                    </span>
                  </div>
                )}

                {summary.recommendedSpecializations && summary.recommendedSpecializations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Recommended Specializations</h3>
                    <div className="flex flex-wrap gap-2">
                      {summary.recommendedSpecializations.map((spec, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                          {spec}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsiblePanel>
          )}

          {summaryLoading && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">AI Summary</h2>
              <div className="flex items-center text-gray-600">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mr-3"></div>
                {transcriptStatus === 'processing' ? 'Waiting for audio transcription...' : 'Generating summary...'}
              </div>
            </div>
          )}

          {/* Voice Transcript Section */}
          {transcript && (
            <CollapsiblePanel
              id="voice-transcript"
              title="Voice Transcript"
              isCollapsed={collapsedPanels['voice-transcript'] || false}
              onToggle={() => togglePanel('voice-transcript')}
            >
              {!showFullTranscript ? (
                <div>
                  <p className="text-gray-700 mb-4 line-clamp-3">
                    {transcript}
                  </p>
                  <button
                    onClick={() => setShowFullTranscript(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    View Full Transcript
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-gray-700 mb-4 whitespace-pre-wrap max-h-96 overflow-y-auto border border-gray-200 rounded p-4">
                    {transcript}
                  </div>
                  <button
                    onClick={() => setShowFullTranscript(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Collapse Transcript
                  </button>
                </div>
              )}
            </CollapsiblePanel>
          )}

          {transcriptStatus === 'processing' && !transcript && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Voice Transcript</h2>
              <div className="flex items-center text-gray-600">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mr-3"></div>
                Transcribing audio...
              </div>
            </div>
          )}

          {/* Audio Recording Section */}
          <CollapsiblePanel
            id="voice-recording"
            title="Voice Recording"
            isCollapsed={collapsedPanels['voice-recording'] || false}
            onToggle={() => togglePanel('voice-recording')}
          >
            {audioLoading ? (
              <div className="flex items-center text-gray-600">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-600 mr-3"></div>
                Loading audio...
              </div>
            ) : hasAudio && audioUrl ? (
              <div>
                <audio controls className="w-full">
                  <source src={audioUrl} type="audio/webm" />
                  Your browser does not support the audio element.
                </audio>
                <p className="text-sm text-gray-600 mt-2">
                  Note: Audio is in WebM format. If playback fails, please use Chrome or Firefox.
                </p>
              </div>
            ) : hasAudio && needsCombination && jobStatus === 'failed' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium mb-2">Audio combination failed</p>
                <p className="text-red-700 text-sm mb-3">
                  The audio recording exists ({chunkCount} chunks) but failed to combine.
                  Please contact support to resolve this issue.
                </p>
                <p className="text-red-600 text-xs">
                  Conversation ID: {intakeData?.conversationId}
                </p>
              </div>
            ) : hasAudio && needsCombination ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-blue-800 font-medium">Preparing audio playback...</p>
                </div>
                <p className="text-blue-700 text-sm">
                  Combining {chunkCount} audio chunks from the patient intake session.
                  This will take a few moments.
                </p>
                {jobStatus && (
                  <p className="text-blue-600 text-xs mt-2">
                    Status: {jobStatus === 'processing' ? 'Processing...' : jobStatus}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-gray-600">No voice recording available for this intake.</p>
            )}

            {/* Provider Response Recording */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Provider Audio Response</h3>

              {/* Recording Controls */}
              {!recordedAudioUrl && (
                <div className="mb-4">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                      </svg>
                      Record Provider Response
                    </button>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                        <span className="text-gray-800 font-medium">Recording: {formatTime(recordingTime)}</span>
                        {recordingTime >= 1800 && <span className="text-red-600 text-sm">(Max duration reached)</span>}
                      </div>
                      <button
                        onClick={stopRecording}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        Stop Recording
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Playback and Upload */}
              {recordedAudioUrl && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 font-medium mb-3">Recording Preview ({formatTime(recordingTime)})</p>
                  <audio controls className="w-full mb-4">
                    <source src={recordedAudioUrl} type={recordedAudioBlob?.type || 'audio/webm'} />
                    Your browser does not support the audio element.
                  </audio>
                  <div className="flex gap-3">
                    <button
                      onClick={uploadRecording}
                      disabled={isUploading}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUploading ? 'Uploading...' : 'Upload Response'}
                    </button>
                    <button
                      onClick={cancelRecording}
                      disabled={isUploading}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel / Re-record
                    </button>
                  </div>
                </div>
              )}

              {/* Previous Recordings */}
              <div className="mt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">Previous Recordings</h4>
                {loadingRecordings ? (
                  <div className="flex items-center text-gray-600">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600 mr-2"></div>
                    Loading recordings...
                  </div>
                ) : providerRecordings.length > 0 ? (
                  <div className="space-y-3">
                    {providerRecordings.map((recording) => (
                      <div key={recording.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">
                            {new Date(recording.createdAt).toLocaleString()} ({formatTime(recording.durationSeconds)})
                          </span>
                        </div>
                        <audio controls className="w-full">
                          <source src={recording.audioUrl} />
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm">No recordings yet.</p>
                )}
              </div>
            </div>
          </CollapsiblePanel>

          {/* Personal Information */}
          <CollapsiblePanel
            id="personal-info"
            title="Personal Information"
            isCollapsed={collapsedPanels['personal-info'] || false}
            onToggle={() => togglePanel('personal-info')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Full Legal Name:</label>
                <p className="text-gray-900">{intakeData.fullLegalName}</p>
              </div>
              {intakeData.preferredName && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Preferred Name:</label>
                  <p className="text-gray-900">{intakeData.preferredName}</p>
                </div>
              )}
              {intakeData.pronouns && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Pronouns:</label>
                  <p className="text-gray-900">{intakeData.pronouns}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-semibold text-gray-700">Date of Birth:</label>
                <p className="text-gray-900">{formatDate(intakeData.dateOfBirth)} (Age: {calculateAge(intakeData.dateOfBirth)})</p>
              </div>
              {intakeData.gender && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Gender:</label>
                  <p className="text-gray-900">{intakeData.gender}</p>
                </div>
              )}
            </div>
          </CollapsiblePanel>

          {/* Contact Information */}
          <CollapsiblePanel
            id="contact-info"
            title="Contact Information"
            isCollapsed={collapsedPanels['contact-info'] || false}
            onToggle={() => togglePanel('contact-info')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Email:</label>
                <p className="text-gray-900">{intakeData.email}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Phone:</label>
                <p className="text-gray-900">{intakeData.phone}</p>
              </div>
            </div>
          </CollapsiblePanel>

          {/* Location */}
          <CollapsiblePanel
            id="location"
            title="Location"
            isCollapsed={collapsedPanels['location'] || false}
            onToggle={() => togglePanel('location')}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">State:</label>
                <p className="text-gray-900">{intakeData.state}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">City:</label>
                <p className="text-gray-900">{intakeData.city}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Zip Code:</label>
                <p className="text-gray-900">{intakeData.zipCode}</p>
              </div>
            </div>
          </CollapsiblePanel>

          {/* Insurance & Payment */}
          <CollapsiblePanel
            id="insurance-payment"
            title="Insurance & Payment"
            isCollapsed={collapsedPanels['insurance-payment'] || false}
            onToggle={() => togglePanel('insurance-payment')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Insurance Provider:</label>
                <p className="text-gray-900">{intakeData.insuranceProvider}</p>
              </div>
              {!intakeData.isSelfPay && intakeData.insurancePlan && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Insurance Plan:</label>
                  <p className="text-gray-900">{intakeData.insurancePlan}</p>
                </div>
              )}
              {!intakeData.isSelfPay && intakeData.insuranceId && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Insurance ID:</label>
                  <p className="text-gray-900">{intakeData.insuranceId}</p>
                </div>
              )}
              {intakeData.isSelfPay && intakeData.budgetPerSession && (
                <div>
                  <label className="text-sm font-semibold text-gray-700">Budget Per Session:</label>
                  <p className="text-gray-900">{intakeData.budgetPerSession}</p>
                </div>
              )}
            </div>
          </CollapsiblePanel>

          {/* Session Preferences */}
          <CollapsiblePanel
            id="session-preferences"
            title="Session Preferences"
            isCollapsed={collapsedPanels['session-preferences'] || false}
            onToggle={() => togglePanel('session-preferences')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Session Preference:</label>
                <p className="text-gray-900">{intakeData.sessionPreference}</p>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Availability:</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {intakeData.availability.map((slot, index) => (
                    <span key={index} className="px-3 py-1 bg-sage-100 text-gray-800 rounded-full text-sm">
                      {slot.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </CollapsiblePanel>

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg border p-4">
            <p className="text-sm text-gray-600">
              Submitted: {formatDate(intakeData.createdAt)}
            </p>
            <p className="text-sm text-gray-600">
              Status: <span className="font-semibold">{intakeData.status}</span>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProviderIntakeView;
