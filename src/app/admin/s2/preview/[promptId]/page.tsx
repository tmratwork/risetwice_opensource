// src/app/admin/s2/preview/[promptId]/page.tsx
// AI Preview page for testing generated therapist prompts

"use client";

import React, { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';
import { useElevenLabsConversation } from '@/hooksV17/use-elevenlabs-conversation';
import { AudioOrbV15 } from '@/app/chatbotV17/components/AudioOrbV15';
import { ThemeProvider } from '@/contexts/theme-context';
// Import V16 styles for V17 chat interface
import '@/app/chatbotV16/chatbotV16.css';

interface PromptData {
  id: string;
  title: string;
  text: string;
  version: number;
  generatedBy: string;
  createdAt: string;
  completenessScore: number;
  confidenceScore: number;
}

interface TherapistProfile {
  id: string;
  user_id: string;
  full_name: string;
  title: string;
  degrees: string[];
  primary_location: string;
  offers_online: boolean;
  phone_number?: string;
  email_address?: string;
}

interface CompleteProfile {
  personal_statement: string;
  mental_health_specialties: string[];
  treatment_approaches: string[];
  age_ranges_treated: string[];
  practice_type: string;
  session_length: string;
  availability_hours: string;
  emergency_protocol: string;
  accepts_insurance: boolean;
  insurance_plans: string[];
  out_of_network_supported: boolean;
}

interface AIStyleConfig {
  cognitive_behavioral: number;
  person_centered: number;
  psychodynamic: number;
  solution_focused: number;
  interaction_style: number;
  tone: number;
  energy_level: number;
}

interface PatientDescription {
  description: string;
  character_count: number;
  scenario_type?: string;
  extracted_themes?: string[];
  complexity_level?: number;
}

interface PreviewData {
  prompt: PromptData;
  therapistProfile: TherapistProfile;
  completeProfile?: CompleteProfile;
  aiStyleConfig?: AIStyleConfig;
  patientDescription?: PatientDescription;
}

interface AIPreviewPageProps {
  params: Promise<{
    promptId: string;
  }>;
}

const AIPreviewPageContent: React.FC<AIPreviewPageProps> = ({ params }) => {
  const resolvedParams = use(params);
  const { user, loading: authLoading } = useAuth();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewStarted, setPreviewStarted] = useState(false);

  // V17 integration
  const store = useElevenLabsStore();
  const { startSession, isConnected, conversationInstance } = useElevenLabsConversation();

  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        setLoading(true);
        console.log(`[s2_preview] Fetching preview data for prompt: ${resolvedParams.promptId}`);

        const response = await fetch(`/api/admin/s2/prompt/${resolvedParams.promptId}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setPreviewData(data.data);

        console.log(`[s2_preview] ✅ Preview data loaded for: ${data.data.therapistProfile.full_name}`);
      } catch (err) {
        console.error('[s2_preview] Error loading preview data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load preview data');
      } finally {
        setLoading(false);
      }
    };

    if (resolvedParams.promptId) {
      fetchPreviewData();
    }
  }, [resolvedParams.promptId]);

  const handleStartPreview = async () => {
    if (!previewData) {
      return;
    }

    try {
      console.log(`[s2_preview] Starting V17 preview with generated prompt: ${previewData.prompt.id}`);

      // Create conversation if needed
      if (!store.conversationId) {
        await store.createConversation();
      }

      // Use the generated AI therapist prompt as demoPromptAppend for V17
      // This tells V17 to role-play as this specific therapist
      const generatedTherapistPrompt = previewData.prompt.text;
      console.log(`[s2_preview] Using generated prompt (${generatedTherapistPrompt.length} chars) as therapist personality`);

      // Start V17 session with triage specialist + generated therapist prompt
      // V17 AI will role-play as the therapist described in the generated prompt
      await startSession('triage', 'EmtkmiOFoQVpKRVpXH2B', generatedTherapistPrompt);

      console.log(`[s2_preview] ✅ V17 preview session started - AI now role-playing as: ${previewData.therapistProfile.full_name}`);
      setPreviewStarted(true);

    } catch (err) {
      console.error('[s2_preview] Error starting V17 preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to start V17 preview');
    }
  };

  const handleEndPreview = () => {
    // End V17 conversation
    if (conversationInstance) {
      conversationInstance.endSession();
    }

    setPreviewStarted(false);
    console.log(`[s2_preview] V17 preview session ended`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AI Preview...</p>
        </div>
      </div>
    );
  }

  if (error || !previewData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <div className="text-red-500 mb-4">⚠️ Error</div>
          <p className="text-gray-800 mb-4">{error || 'Preview data not found'}</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Close Preview
          </button>
        </div>
      </div>
    );
  }

  if (previewStarted && isConnected) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Preview Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Therapist Preview - Active</h1>
                <p className="text-gray-600">Testing {previewData?.therapistProfile.full_name} - Speak naturally as a patient</p>
              </div>
              <button
                onClick={handleEndPreview}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                End Preview
              </button>
            </div>
          </div>
        </div>

        {/* V17 Chat Interface */}
        <div className="main-container">
          {/* Conversation Display */}
          <div className="conversation-container">
            <div className="conversation-history">
              {store.conversationHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`message ${msg.role} ${!msg.isFinal ? 'animate-pulse' : ''}`}
                >
                  <div className="message-content">
                    <p className="message-text">{msg.text}</p>
                    {msg.status && msg.status !== 'final' && (
                      <div className="message-status">
                        <span className="status-indicator">{msg.status}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Show placeholder when no messages yet */}
              {store.conversationHistory.length === 0 && (
                <div className="conversation-placeholder">
                  <div className="flex flex-col items-center justify-center py-8">
                    <div className="relative w-12 h-12 mb-4">
                      <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-600">AI Therapist ready - Start speaking...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audio Visualizer */}
          <div className="visualization-container">
            <AudioOrbV15 isFunctionExecuting={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Therapist Preview</h1>
              <p className="text-gray-600 mt-2">Testing generated prompt for {previewData.therapistProfile.full_name}</p>
            </div>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Prompt Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Generated Prompt Details</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Version {previewData.prompt.version}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-medium text-gray-700 mb-2">Prompt Quality</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Completeness Score:</span>
                  <span className="text-sm font-medium">{(previewData.prompt.completenessScore * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Confidence Score:</span>
                  <span className="text-sm font-medium">{(previewData.prompt.confidenceScore * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-700 mb-2">Generation Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Model Used:</span>
                  <span className="text-sm font-medium">{previewData.prompt.generatedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Created:</span>
                  <span className="text-sm font-medium">{new Date(previewData.prompt.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-gray-700 mb-3">Therapist Profile</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-4 mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{previewData.therapistProfile.title} {previewData.therapistProfile.full_name}</h4>
                  <p className="text-sm text-gray-600">{previewData.therapistProfile.degrees.join(', ')}</p>
                  <p className="text-sm text-gray-600">{previewData.therapistProfile.primary_location}</p>
                </div>
              </div>

              {previewData.completeProfile?.mental_health_specialties && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Specialties:</p>
                  <div className="flex flex-wrap gap-2">
                    {previewData.completeProfile.mental_health_specialties.map((specialty, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {specialty}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-center">
            <button
              onClick={handleStartPreview}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start AI Preview Session
            </button>
            <p className="text-sm text-gray-500 mt-2">
              This will launch a WebRTC session using the generated AI prompt to simulate {previewData.therapistProfile.full_name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrapper component with ThemeProvider for V17 compatibility
const AIPreviewPage: React.FC<AIPreviewPageProps> = ({ params }) => {
  return (
    <ThemeProvider>
      <AIPreviewPageContent params={params} />
    </ThemeProvider>
  );
};

export default AIPreviewPage;