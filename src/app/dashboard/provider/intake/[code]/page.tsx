// src/app/dashboard/provider/intake/[code]/page.tsx
// Provider view of patient intake information by access code

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { getUserRole, UserRole } from '@/utils/user-role';
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
}

interface IntakeSummary {
  summaryText: string;
  keyConcerns: string[];
  urgencyLevel: string;
  recommendedSpecializations: string[];
  voiceTranscript: string | null;
}

const ProviderIntakeView: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
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
  const [currentIntakeId, setCurrentIntakeId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<string>('');
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  useEffect(() => {
    async function loadIntakeData() {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        setUserRole(role);

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
          setCurrentIntakeId(intakeId);

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
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">AI Summary</h2>

              <div className="mb-4">
                <div className="prose max-w-none text-gray-700">
                  {summary.summaryText}
                </div>
              </div>

              {summary.keyConcerns && summary.keyConcerns.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Key Concerns:</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    {summary.keyConcerns.map((concern, index) => (
                      <li key={index}>{concern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summary.urgencyLevel && (
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Urgency Level:</h3>
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
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Recommended Specializations:</h3>
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
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Voice Transcript</h2>

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
            </div>
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
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Voice Recording</h2>

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
          </div>

          {/* Personal Information */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Personal Information</h2>
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
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Contact Information</h2>
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
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Location</h2>
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
          </div>

          {/* Insurance & Payment */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Insurance & Payment</h2>
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
          </div>

          {/* Session Preferences */}
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">Session Preferences</h2>
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
          </div>

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
