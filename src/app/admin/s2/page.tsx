// src/app/admin/s2/page.tsx
// S2 Admin Panel - Therapist Data Overview

"use client";

import React, { useState, useEffect } from 'react';
import { convertWebMToMp3, isAudioConversionSupported, generateAudioFilename } from '@/utils/audio-converter';
import AIPreviewSettings from './components/AIPreviewSettings';

// Types based on database schema
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
  created_at: string;
  profile_completion_status?: string;
}

interface CompleteProfile {
  profile_photo_url?: string;
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
  completion_date: string;
}

interface AIStyleConfig {
  cognitive_behavioral: number;
  person_centered: number;
  psychodynamic: number;
  solution_focused: number;
  friction: number;
  tone: number;
  energy_level: number;
}

interface LicenseVerification {
  license_type: string;
  license_number: string;
  state_of_licensure: string;
  verification_status?: string;
  verification_date?: string;
}

interface PatientDescription {
  description: string;
  character_count: number;
  scenario_type?: string;
  extracted_themes?: string[];
  complexity_level?: number;
}

interface SessionSummary {
  total_sessions: number;
  total_messages: number;
  last_session_date?: string;
}

// S2 session interface for admin panel (matches database structure)
interface S2AdminSession {
  id: string;
  sessionId?: string; // Keep both for compatibility
  therapistProfileId?: string;
  generatedScenarioId?: string;
  session_number: number;
  sessionNumber?: number; // Keep both for compatibility
  sessionStatus?: 'created' | 'active' | 'completed';
  status: 'created' | 'active' | 'completed';
  aiPersonalityPrompt?: string;
  created_at: string;
  duration_seconds?: number;
  message_count: number;
  messages?: S2SessionMessage[];
  // Audio recording fields from database
  voice_recording_url?: string;
  voice_recording_uploaded?: boolean;
  voice_recording_size?: number;
  // NEW: Chunk-based audio fields
  total_chunks?: number;
  uploaded_chunks?: number;
  chunks_combined_at?: string;
  chunk_upload_enabled?: boolean;
  s2_generated_scenarios?: {
    scenario_text: string;
    generation_model?: string;
    scenario_rating?: number;
    used_in_session?: boolean;
  };
}

// S2 session message interface
interface S2SessionMessage {
  id: string;
  role: 'therapist' | 'patient';
  content: string;
  created_at: string;
  emotional_tone?: string;
  word_count?: number;
  sentiment_score?: number;
  clinical_relevance?: string;
}

interface TherapistData extends TherapistProfile {
  complete_profile?: CompleteProfile;
  ai_style_config?: AIStyleConfig;
  license_verification?: LicenseVerification;
  patient_description?: PatientDescription;
  session_summary?: SessionSummary;
  cloned_voice_id?: string;
}

const S2AdminPanel: React.FC = () => {
  const [therapists, setTherapists] = useState<TherapistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMainTab, setActiveMainTab] = useState<'therapists' | 'ai_preview'>('therapists');

  // Fetch therapist data
  useEffect(() => {
    const fetchTherapistData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/admin/s2/therapists');

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setTherapists(data.therapists || []);
      } catch (err) {
        console.error('Failed to fetch therapist data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTherapistData();
  }, []);

  // Filter therapists based on search
  const filteredTherapists = therapists.filter(therapist =>
    therapist.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    therapist.email_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    therapist.primary_location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading therapist data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
          <div className="text-red-500 mb-4">⚠️ Error</div>
          <p className="text-gray-800 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">S2 Admin Panel</h1>
          <p className="text-gray-600 mt-2">Therapist profiles and case simulation data</p>
        </div>

        {/* Main Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => {
                  setActiveMainTab('therapists');
                  setSelectedTherapist(null); // Reset selected therapist when switching tabs
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeMainTab === 'therapists'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Therapist Profiles
              </button>
              <button
                onClick={() => setActiveMainTab('ai_preview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeMainTab === 'ai_preview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AI Preview Settings
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tab Content */}
        {activeMainTab === 'ai_preview' ? (
          <AIPreviewSettings />
        ) : !selectedTherapist ? (
          // Therapist List View
          <>
            {/* Search Bar */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search by name, email, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Total Therapists</h3>
                <p className="text-3xl font-bold text-blue-600 mt-2">{therapists.length}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Active Profiles</h3>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {therapists.filter(t => t.profile_completion_status === 'complete').length}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900">Total Sessions</h3>
                <p className="text-3xl font-bold text-purple-600 mt-2">
                  {therapists.reduce((sum, t) => sum + (t.session_summary?.total_sessions || 0), 0)}
                </p>
              </div>
            </div>

            {/* Therapist Table */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Therapist
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                      Profile Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTherapists.map((therapist) => (
                    <tr
                      key={therapist.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedTherapist(therapist)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {therapist.title} {therapist.full_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {therapist.degrees.join(', ')}
                          </div>
                          {therapist.email_address && (
                            <div className="text-sm text-gray-500">
                              {therapist.email_address}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                        {therapist.primary_location}
                        {therapist.offers_online && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Online
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          therapist.profile_completion_status === 'complete'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {therapist.profile_completion_status || 'incomplete'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center justify-between">
                          <div>
                            {therapist.session_summary?.total_sessions || 0} sessions
                            <div className="text-xs text-gray-500">
                              {therapist.session_summary?.total_messages || 0} messages
                            </div>
                          </div>
                          {/* Arrow indicator on mobile */}
                          <svg className="ml-4 h-5 w-5 text-gray-400 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden lg:table-cell">
                        {new Date(therapist.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredTherapists.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    {searchTerm ? 'No therapists found matching your search.' : 'No therapists found.'}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          // Therapist Detail View
          <TherapistDetailView
            therapist={selectedTherapist}
            onBack={() => setSelectedTherapist(null)}
          />
        )}
      </div>
    </div>
  );
};

// Therapist Detail Component
interface TherapistDetailViewProps {
  therapist: TherapistData;
  onBack: () => void;
}

const TherapistDetailView: React.FC<TherapistDetailViewProps> = ({ therapist, onBack }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'sessions'>('profile');
  const [existingPrompt, setExistingPrompt] = useState<{
    id: string;
    title: string;
    version: number;
    createdAt: string;
  } | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // Load existing prompt for this therapist
  useEffect(() => {
    const loadExistingPrompt = async () => {
      try {
        setLoadingPrompt(true);
        console.log(`[s2_preview] Loading existing prompts for therapist: ${therapist.id}`);

        const response = await fetch(`/api/admin/s2/therapist-prompts?therapistId=${therapist.id}`);

        if (response.ok) {
          const data = await response.json();

          if (data.prompts && data.prompts.length > 0) {
            const latestPrompt = data.prompts[0]; // API returns sorted by latest
            const existingPromptData = {
              id: latestPrompt.id,
              title: latestPrompt.prompt_title,
              version: latestPrompt.prompt_version,
              createdAt: latestPrompt.created_at
            };

            console.log(`[s2_preview] Found existing prompt:`, existingPromptData);
            setExistingPrompt(existingPromptData);
          } else {
            console.log(`[s2_preview] No existing prompts found for therapist: ${therapist.id}`);
          }
        } else {
          console.error(`[s2_preview] Failed to load prompts:`, response.status, response.statusText);
        }
      } catch (error) {
        console.error(`[s2_preview] Error loading existing prompts:`, error);
      } finally {
        setLoadingPrompt(false);
      }
    };

    loadExistingPrompt();
  }, [therapist.id]);

  const handleStartPreview = () => {
    if (existingPrompt) {
      console.log(`[s2_preview] Starting AI preview with prompt: ${existingPrompt.id}`);
      window.open(`/admin/s2/preview/${existingPrompt.id}`, '_blank');
    }
  };

  return (
    <div>
      {/* Back Button */}
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-blue-600 hover:text-blue-800"
      >
        ← Back to Therapist List
      </button>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {therapist.title} {therapist.full_name}
        </h2>
        <p className="text-gray-600 mt-2">{therapist.degrees.join(', ')}</p>
        <div className="mt-4 flex space-x-4">
          <span className="text-sm text-gray-500">
            📍 {therapist.primary_location}
          </span>
          {therapist.offers_online && (
            <span className="text-sm text-blue-600">💻 Offers Online</span>
          )}
          {therapist.email_address && (
            <span className="text-sm text-gray-500">
              ✉️ {therapist.email_address}
            </span>
          )}
        </div>

        {/* AI Preview Button */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          {loadingPrompt ? (
            <div className="flex items-center text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              Loading existing AI prompt...
            </div>
          ) : existingPrompt ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">AI Therapist Prompt Available</p>
                <p className="text-xs text-gray-500">
                  Version {existingPrompt.version} • Created {new Date(existingPrompt.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={handleStartPreview}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start AI Preview
              </button>
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No AI therapist prompt generated yet. Use the &quot;Generate AI Prompt&quot; button to create one first.
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Profile Information
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'sessions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Sessions & Transcripts
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'profile' ? (
        <ProfileInformation therapist={therapist} />
      ) : (
        <SessionsAndTranscripts therapistId={therapist.id} />
      )}
    </div>
  );
};

// Prompt Generation Modal Component
interface PromptGenerationModalProps {
  therapist: TherapistData;
  isOpen: boolean;
  onClose: () => void;
}

const PromptGenerationModal: React.FC<PromptGenerationModalProps> = ({ therapist, isOpen, onClose }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [promptId, setPromptId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dataAnalysis, setDataAnalysis] = useState<{
    totalSessions?: number;
    totalMessages?: number;
    totalTherapistMessages?: number;
    completenessScore?: number;
    confidenceScore?: number;
    processingTimeMinutes?: string;
    conversationPatterns?: {
      totalTherapistMessages?: number;
      averageMessageLength?: number;
    };
  } | null>(null);
  const [existingPrompt, setExistingPrompt] = useState<{
    id: string;
    title: string;
    version: number;
    createdAt: string;
  } | null>(null);


  // Load existing prompt when modal opens
  useEffect(() => {
    const loadExistingPrompt = async () => {
      if (!isOpen || !therapist?.id) {
        return;
      }

      // Small delay to ensure modal is fully open before loading data
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const response = await fetch(`/api/admin/s2/therapist-prompts?therapistId=${therapist.id}`);

        if (response.ok) {
          const data = await response.json();

          if (data.prompts && data.prompts.length > 0) {
            const latestPrompt = data.prompts[0]; // API should return sorted by latest
            const existingPromptData = {
              id: latestPrompt.id,
              title: latestPrompt.prompt_title,
              version: latestPrompt.prompt_version,
              createdAt: latestPrompt.created_at
            };

            setExistingPrompt(existingPromptData);
            setPromptId(latestPrompt.id); // Set promptId so Start AI Preview button appears
          }
        }
      } catch (err) {
        console.error(`[s2_preview] Error loading existing prompts:`, err);
      }
    };

    loadExistingPrompt();
  }, [isOpen, therapist?.id]);

  const handleGeneratePrompt = async () => {
    try {
      setIsGenerating(true);
      setError(null);
      setGeneratedPrompt('');

      console.log(`[s2_prompt_generation] Generating prompt for therapist: ${therapist.id}`);

      const response = await fetch('/api/admin/s2/generate-therapist-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          therapistId: therapist.id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setGeneratedPrompt(data.prompt);
      setPromptId(data.promptId);
      setDataAnalysis(data.dataAnalysis);

      console.log(`[s2_prompt_generation] ✅ Prompt generated successfully`);

    } catch (err) {
      console.error('[s2_prompt_generation] Error generating prompt:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate prompt');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt);
      // Could add toast notification here
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };

  const handleStartPreview = () => {
    if (!promptId) {
      console.error('No prompt ID available for preview');
      return;
    }

    // Open AI Preview in new tab
    const previewUrl = `/admin/s2/preview/${promptId}`;
    window.open(previewUrl, '_blank');

    console.log(`[s2_preview] Starting AI Preview for prompt: ${promptId}`);
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 ${!isOpen ? 'hidden' : ''}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Generate AI Therapist Prompt
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-gray-600 mt-2">
            Generate a comprehensive AI prompt to simulate <strong>{therapist.full_name}</strong>&apos;s therapeutic style
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!generatedPrompt && !isGenerating && !error && (
            <div className="text-center py-8">
              {/* Show existing prompt info if available */}
              {existingPrompt && (
                <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="text-lg font-medium text-green-900">Existing AI Prompt Found</h4>
                  </div>
                  <p className="text-green-700 mb-3">
                    <strong>{existingPrompt.title}</strong>
                  </p>
                  <p className="text-sm text-green-600 mb-4">
                    Created: {new Date(existingPrompt.createdAt).toLocaleDateString()} at {new Date(existingPrompt.createdAt).toLocaleTimeString()}
                  </p>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={handleStartPreview}
                      disabled={!promptId}
                      className={`inline-flex items-center px-4 py-2 text-sm rounded transition-colors ${
                        promptId
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      title={promptId ? 'Start AI Preview with existing prompt' : 'Loading prompt...'}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start AI Preview
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {existingPrompt ? 'Generate New Version' : 'Ready to Generate'}
                </h3>
                <p className="text-gray-600 mb-6">
                  {existingPrompt
                    ? `Generate version ${existingPrompt.version + 1} with latest data analysis`
                    : `This will analyze all of ${therapist.full_name}'s profile data, therapy sessions, and conversation patterns to create a detailed AI roleplay prompt.`
                  }
                </p>
                <button
                  onClick={handleGeneratePrompt}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  {existingPrompt ? 'Generate New Version' : 'Generate AI Prompt'}
                </button>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Prompt...</h3>
              <p className="text-gray-600">
                Analyzing therapist data and generating comprehensive AI prompt with Claude AI
              </p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generation Failed</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={handleGeneratePrompt}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {generatedPrompt && (
            <div className="space-y-6">
              {/* Data Analysis Summary */}
              {dataAnalysis && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Data Analysis Summary</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Sessions:</span>
                      <span className="text-blue-900 ml-1">{dataAnalysis.totalSessions}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Messages:</span>
                      <span className="text-blue-900 ml-1">{dataAnalysis.totalMessages}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Therapist Responses:</span>
                      <span className="text-blue-900 ml-1">{dataAnalysis.totalTherapistMessages || dataAnalysis.conversationPatterns?.totalTherapistMessages || 0}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Avg Length:</span>
                      <span className="text-blue-900 ml-1">{dataAnalysis.conversationPatterns?.averageMessageLength || 0} chars</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Generated Prompt */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Generated AI Therapist Prompt</h4>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCopyPrompt}
                      className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Prompt
                    </button>
                    <button
                      onClick={handleStartPreview}
                      disabled={!promptId}
                      className={`inline-flex items-center px-4 py-2 text-sm rounded transition-colors ${
                        promptId
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                      title={promptId ? 'Start AI Preview with this prompt' : 'Generate a prompt first'}
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Start AI Preview
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                    {generatedPrompt}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Profile Information Component
const ProfileInformation: React.FC<{ therapist: TherapistData }> = ({ therapist }) => {
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isCloningVoice, setIsCloningVoice] = useState(false);
  const [isDeletingVoice, setIsDeletingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceSuccess, setVoiceSuccess] = useState<string | null>(null);

  const handleCloneVoice = async () => {
    try {
      setIsCloningVoice(true);
      setVoiceError(null);
      setVoiceSuccess(null);

      const response = await fetch('/api/admin/s2/clone-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          therapistProfileId: therapist.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Voice cloning failed');
      }

      setVoiceSuccess(data.message);

      // Update therapist data to reflect the new voice
      therapist.cloned_voice_id = data.voice_id;

      setTimeout(() => setVoiceSuccess(null), 5000);

    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Voice cloning failed');
      setTimeout(() => setVoiceError(null), 8000);
    } finally {
      setIsCloningVoice(false);
    }
  };

  const handleDeleteVoice = async () => {
    if (!confirm(`Are you sure you want to delete the cloned voice for ${therapist.full_name}? This cannot be undone.`)) {
      return;
    }

    try {
      setIsDeletingVoice(true);
      setVoiceError(null);
      setVoiceSuccess(null);

      const response = await fetch('/api/admin/s2/delete-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          therapistProfileId: therapist.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Voice deletion failed');
      }

      setVoiceSuccess(data.message);

      // Update therapist data to reflect the removed voice
      therapist.cloned_voice_id = undefined;

      setTimeout(() => setVoiceSuccess(null), 5000);

    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Voice deletion failed');
      setTimeout(() => setVoiceError(null), 8000);
    } finally {
      setIsDeletingVoice(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* AI Prompt Generation Card */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">AI Therapist Simulation</h3>
            <p className="text-gray-600 mb-4">
              Generate a comprehensive AI prompt that can simulate {therapist.full_name}&apos;s therapeutic style and approach based on their complete profile and session data.
            </p>
          </div>
          <div className="ml-6">
            <button
              onClick={() => setIsPromptModalOpen(true)}
              className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate AI Prompt
            </button>
          </div>
        </div>
      </div>

      {/* Voice Cloning Card */}
      <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Voice Cloning</h3>
            <p className="text-gray-600 mb-4">
              Clone {therapist.full_name}&apos;s voice using their therapy session audio recordings. Requires minimum 1 minute of audio data.
            </p>
            {therapist.cloned_voice_id && (
              <p className="text-sm text-green-700 bg-green-100 px-3 py-1 rounded-full inline-block">
                🎤 Voice already cloned (ID: {therapist.cloned_voice_id.substring(0, 12)}...)
              </p>
            )}
          </div>
          <div className="ml-6 flex flex-col space-y-3">
            {!therapist.cloned_voice_id ? (
              <button
                onClick={handleCloneVoice}
                disabled={isCloningVoice}
                className={`inline-flex items-center px-6 py-3 rounded-lg transition-colors shadow-md ${
                  isCloningVoice
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isCloningVoice ? (
                  <>
                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                    </svg>
                    Cloning Voice...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Clone Voice
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleDeleteVoice}
                disabled={isDeletingVoice}
                className={`inline-flex items-center px-6 py-3 rounded-lg transition-colors shadow-md ${
                  isDeletingVoice
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {isDeletingVoice ? (
                  <>
                    <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
                    </svg>
                    Deleting Voice...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Cloned Voice
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {voiceSuccess && (
          <div className="mt-4 p-3 bg-green-100 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-800">{voiceSuccess}</p>
            </div>
          </div>
        )}

        {voiceError && (
          <div className="mt-4 p-3 bg-red-100 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">{voiceError}</p>
            </div>
          </div>
        )}
      </div>

      <PromptGenerationModal
        therapist={therapist}
        isOpen={isPromptModalOpen}
        onClose={() => setIsPromptModalOpen(false)}
      />
      {/* Complete Profile */}
      {therapist.complete_profile && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Complete Profile</h3>

          {therapist.complete_profile.personal_statement && (
            <div className="mb-4">
              <h4 className="font-medium text-gray-700">Personal Statement</h4>
              <p className="text-gray-600 mt-1">{therapist.complete_profile.personal_statement}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700">Mental Health Specialties</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {therapist.complete_profile.mental_health_specialties?.map((specialty, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Treatment Approaches</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {therapist.complete_profile.treatment_approaches?.map((approach, index) => (
                  <span key={index} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    {approach}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Age Ranges Treated</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {therapist.complete_profile.age_ranges_treated?.map((range, index) => (
                  <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                    {range}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700">Practice Details</h4>
              <div className="mt-2 text-sm text-gray-600 space-y-1">
                <p><span className="font-medium">Type:</span> {therapist.complete_profile.practice_type}</p>
                <p><span className="font-medium">Session Length:</span> {therapist.complete_profile.session_length}</p>
                <p><span className="font-medium">Availability:</span> {therapist.complete_profile.availability_hours}</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="font-medium text-gray-700">Insurance Information</h4>
            <div className="mt-2 text-sm text-gray-600">
              <p><span className="font-medium">Accepts Insurance:</span> {therapist.complete_profile.accepts_insurance ? 'Yes' : 'No'}</p>
              {therapist.complete_profile.insurance_plans?.length > 0 && (
                <p><span className="font-medium">Plans:</span> {therapist.complete_profile.insurance_plans.join(', ')}</p>
              )}
              <p><span className="font-medium">Out of Network:</span> {therapist.complete_profile.out_of_network_supported ? 'Supported' : 'Not supported'}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Style Configuration */}
      {therapist.ai_style_config && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">AI Style Configuration</h3>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Therapeutic Modalities</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cognitive Behavioral</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.cognitive_behavioral}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Person Centered</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.person_centered}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Psychodynamic</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.psychodynamic}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Solution Focused</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.solution_focused}%</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-700 mb-2">Communication Style</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Friction</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.friction}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Tone</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.tone}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Expression</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.energy_level}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* License Verification */}
      {therapist.license_verification && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">License Verification</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-gray-700">License Type</h4>
              <p className="text-gray-600 mt-1">{therapist.license_verification.license_type}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">License Number</h4>
              <p className="text-gray-600 mt-1">{therapist.license_verification.license_number}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700">State</h4>
              <p className="text-gray-600 mt-1">{therapist.license_verification.state_of_licensure}</p>
            </div>
          </div>
        </div>
      )}

      {/* Patient Description */}
      {therapist.patient_description && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Patient Description</h3>
          <p className="text-gray-600">{therapist.patient_description.description}</p>
          {therapist.patient_description.extracted_themes && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700">Extracted Themes</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {therapist.patient_description.extracted_themes.map((theme, index) => (
                  <span key={index} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Sessions and Transcripts Component
const SessionsAndTranscripts: React.FC<{ therapistId: string }> = ({ therapistId }) => {
  const [sessions, setSessions] = useState<S2AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<S2AdminSession | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/admin/s2/sessions?therapistProfileId=${therapistId}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        setSessions(data.sessions || []);
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [therapistId]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading sessions...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">⚠️ Error</div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (selectedSession) {
    return (
      <div className="space-y-6">
        {/* Session Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <button
            onClick={() => setSelectedSession(null)}
            className="mb-4 text-blue-600 hover:text-blue-800"
          >
            ← Back to Sessions List
          </button>

          <h3 className="text-xl font-medium text-gray-900">
            Session #{selectedSession.session_number}
          </h3>
          <div className="mt-2 text-sm text-gray-600 space-y-1">
            <p><span className="font-medium">Date:</span> {new Date(selectedSession.created_at).toLocaleString()}</p>
            <p><span className="font-medium">Status:</span> <span className="capitalize">{selectedSession.status}</span></p>
            <p><span className="font-medium">Duration:</span> {selectedSession.duration_seconds ? `${Math.floor(selectedSession.duration_seconds / 60)}m ${selectedSession.duration_seconds % 60}s` : 'N/A'}</p>
            <p><span className="font-medium">Messages:</span> {selectedSession.message_count}</p>
            {/* Audio Recording Status and Link */}
            <div className="mt-2 pt-2 border-t border-gray-200">
              <span className="font-medium">Audio Recording:</span>{' '}
              {/* Check for combined audio first */}
              {selectedSession.voice_recording_uploaded && selectedSession.voice_recording_url ? (
                <span>
                  <a
                    href={selectedSession.voice_recording_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline ml-1"
                  >
                    🎧 Listen to Recording
                  </a>
                  <AudioDownloadButton
                    audioUrl={selectedSession.voice_recording_url}
                    sessionNumber={selectedSession.session_number}
                  />
                  {selectedSession.voice_recording_size && (
                    <span className="text-gray-500 ml-2">
                      ({(selectedSession.voice_recording_size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                  )}
                </span>
              ) : /* Check for audio chunks */ selectedSession.total_chunks && selectedSession.total_chunks > 0 ? (
                <span>
                  <span className="text-green-600 ml-1">
                    📁 {selectedSession.uploaded_chunks}/{selectedSession.total_chunks} chunks uploaded
                  </span>
                  {selectedSession.chunks_combined_at ? (
                    <span className="text-blue-600 ml-2">
                      (Combined: {new Date(selectedSession.chunks_combined_at).toLocaleString()})
                    </span>
                  ) : (
                    <CombineAudioButton sessionId={selectedSession.id} sessionNumber={selectedSession.session_number} />
                  )}
                </span>
              ) : selectedSession.status === 'completed' ? (
                <span className="text-amber-600 ml-1">
                  ⚠️ No audio uploaded (session may have ended unexpectedly)
                </span>
              ) : selectedSession.status === 'active' ? (
                <span className="text-gray-500 ml-1">
                  Session in progress...
                </span>
              ) : (
                <span className="text-gray-500 ml-1">
                  Not yet recorded
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Audio Recording Section */}
        {(selectedSession.voice_recording_uploaded || selectedSession.status === 'completed') && (
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Session Audio Recording</h4>
            {selectedSession.voice_recording_uploaded && selectedSession.voice_recording_url ? (
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-800 mb-2">
                      🎧 Audio recording successfully captured
                    </p>
                    <div className="flex gap-3">
                      <a
                        href={selectedSession.voice_recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Listen to Full Session Recording
                      </a>
                      <AudioDownloadButton
                        audioUrl={selectedSession.voice_recording_url}
                        sessionNumber={selectedSession.session_number}
                        variant="primary"
                      />
                    </div>
                  </div>
                  {selectedSession.voice_recording_size && (
                    <div className="text-sm text-gray-600">
                      <p>File size: {(selectedSession.voice_recording_size / (1024 * 1024)).toFixed(2)} MB</p>
                      <p>Format: WebM (Opus codec)</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 rounded-lg p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 text-amber-600 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-amber-800 font-medium">No audio recording available</p>
                    <p className="text-sm text-amber-600 mt-1">
                      This session was completed but no audio was uploaded. Possible reasons:
                    </p>
                    <ul className="text-sm text-amber-600 mt-2 list-disc list-inside space-y-1">
                      <li>Browser was closed before upload completed</li>
                      <li>Network connection was lost during upload</li>
                      <li>User navigated away from the session too quickly</li>
                      <li>Microphone permissions were not granted</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Scenario Information */}
        {selectedSession.s2_generated_scenarios && (
          <div className="bg-white rounded-lg shadow p-6">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Scenario Used</h4>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-gray-700">{selectedSession.s2_generated_scenarios.scenario_text}</p>
            </div>
            <div className="mt-3 flex items-center space-x-4 text-sm text-gray-600">
              {selectedSession.s2_generated_scenarios.generation_model && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {selectedSession.s2_generated_scenarios.generation_model}
                </span>
              )}
              {selectedSession.s2_generated_scenarios.scenario_rating && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                  Rating: {selectedSession.s2_generated_scenarios.scenario_rating}/5
                </span>
              )}
              {selectedSession.s2_generated_scenarios.used_in_session && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Used in Session
                </span>
              )}
            </div>
          </div>
        )}

        {/* Conversation Transcript */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Conversation Transcript</h4>

          {selectedSession.messages && selectedSession.messages.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {selectedSession.messages.map((message: S2SessionMessage, index: number) => (
                <div
                  key={message.id || index}
                  className={`flex ${message.role === 'therapist' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'therapist'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    <div className="text-xs opacity-75 mb-1">
                      {message.role === 'therapist' ? '👩‍⚕️ Therapist' : '🤖 AI Patient'}
                    </div>
                    <div className="text-sm">{message.content}</div>
                    {message.created_at && (
                      <div className="text-xs opacity-75 mt-1">
                        {new Date(message.created_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No messages found for this session.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Sessions & Transcripts</h3>

      {sessions.length > 0 ? (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => setSelectedSession(session)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900">
                    Session #{session.session_number}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(session.created_at).toLocaleDateString()} at{' '}
                    {new Date(session.created_at).toLocaleTimeString()}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>Status: <span className="capitalize">{session.status}</span></span>
                    <span>Messages: {session.message_count}</span>
                    {session.duration_seconds && (
                      <span>
                        Duration: {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s
                      </span>
                    )}
                    {/* Audio Recording Indicator */}
                    {session.voice_recording_uploaded ? (
                      <span className="text-green-600">🎧 Audio Available</span>
                    ) : session.total_chunks && session.total_chunks > 0 ? (
                      <span className="text-blue-600">📁 {session.uploaded_chunks}/{session.total_chunks} chunks</span>
                    ) : session.status === 'completed' ? (
                      <span className="text-amber-600">⚠️ No Audio</span>
                    ) : null}
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-center py-8">No sessions found for this therapist.</p>
      )}
    </div>
  );
};

// Audio Download Button Component
interface AudioDownloadButtonProps {
  audioUrl: string;
  sessionNumber: number;
  variant?: 'primary' | 'link';
}

const AudioDownloadButton: React.FC<AudioDownloadButtonProps> = ({
  audioUrl,
  sessionNumber,
  variant = 'link'
}) => {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  useEffect(() => {
    // Check if audio conversion is supported in this browser
    setIsSupported(isAudioConversionSupported());
  }, []);

  const handleDownload = async () => {
    if (!isSupported) {
      alert('Audio conversion not supported in this browser. Please try Chrome, Firefox, or Safari.');
      return;
    }

    try {
      setIsConverting(true);
      setProgress(0);
      setError(null);

      const filename = generateAudioFilename(audioUrl, sessionNumber);

      await convertWebMToMp3(audioUrl, filename, (progressPercent) => {
        setProgress(progressPercent);
      });

      // Success - reset state
      setProgress(100);
      setTimeout(() => {
        setIsConverting(false);
        setProgress(0);
      }, 1000);

    } catch (err) {
      console.error('Download failed:', err);
      setError(err instanceof Error ? err.message : 'Download failed');
      setIsConverting(false);
      setProgress(0);
    }
  };

  if (!isSupported) {
    return (
      <span className="text-gray-400 text-sm ml-2" title="Audio conversion not supported in this browser">
        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download MP3 (Not supported)
      </span>
    );
  }

  if (variant === 'primary') {
    return (
      <button
        onClick={handleDownload}
        disabled={isConverting}
        className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
          isConverting
            ? 'bg-gray-400 cursor-not-allowed'
            : error
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-green-600 hover:bg-green-700'
        } text-white`}
        title={error || (isConverting ? `Converting... ${progress}%` : 'Download as MP3')}
      >
        {isConverting ? (
          <>
            <svg className="w-5 h-5 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" opacity="0.25" />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" opacity="0.75" />
            </svg>
            Converting... {progress}%
          </>
        ) : error ? (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Retry Download
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download MP3
          </>
        )}
      </button>
    );
  }

  // Link variant (default)
  return (
    <button
      onClick={handleDownload}
      disabled={isConverting}
      className={`text-sm ml-2 ${
        isConverting
          ? 'text-gray-400 cursor-not-allowed'
          : error
          ? 'text-red-600 hover:text-red-800'
          : 'text-green-600 hover:text-green-800'
      } underline`}
      title={error || (isConverting ? `Converting... ${progress}%` : 'Download as MP3')}
    >
      {isConverting ? (
        <>⏳ Converting... {progress}%</>
      ) : error ? (
        <>
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retry MP3
        </>
      ) : (
        <>
          <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download MP3
        </>
      )}
    </button>
  );
};

// Combine Audio Button Component
interface CombineAudioButtonProps {
  sessionId: string;
  sessionNumber: number;
}

const CombineAudioButton: React.FC<CombineAudioButtonProps> = ({
  sessionId
}) => {
  const [isCombining, setIsCombining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [combinedUrl, setCombinedUrl] = useState<string | null>(null);

  const handleCombineAudio = async () => {
    try {
      setIsCombining(true);
      setError(null);

      console.log(`[admin_combine] Combining audio for session: ${sessionId}`);

      const response = await fetch('/api/s2/voice-combine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[admin_combine] ✅ Audio combined successfully:`, result);

      setCombinedUrl(result.combined_audio_url);

      // Reload the page to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (err) {
      console.error('[admin_combine] Audio combination failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to combine audio');
    } finally {
      setIsCombining(false);
    }
  };

  if (combinedUrl) {
    return (
      <a
        href={combinedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline ml-2"
      >
        🎧 Listen to Combined Audio
      </a>
    );
  }

  return (
    <button
      onClick={handleCombineAudio}
      disabled={isCombining}
      className={`ml-2 px-3 py-1 text-sm rounded transition-colors ${
        isCombining
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : error
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
      title={error || (isCombining ? 'Combining audio chunks...' : 'Combine chunks into playable audio')}
    >
      {isCombining ? (
        <>⏳ Combining...</>
      ) : error ? (
        <>❌ Retry Combine</>
      ) : (
        <>🔧 Combine Audio</>
      )}
    </button>
  );
};

export default S2AdminPanel;