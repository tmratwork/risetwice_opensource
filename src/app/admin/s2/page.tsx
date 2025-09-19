// src/app/admin/s2/page.tsx
// S2 Admin Panel - Therapist Data Overview

"use client";

import React, { useState, useEffect } from 'react';

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
  interaction_style: number;
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

interface TherapistData extends TherapistProfile {
  complete_profile?: CompleteProfile;
  ai_style_config?: AIStyleConfig;
  license_verification?: LicenseVerification;
  patient_description?: PatientDescription;
  session_summary?: SessionSummary;
}

const S2AdminPanel: React.FC = () => {
  const [therapists, setTherapists] = useState<TherapistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTherapist, setSelectedTherapist] = useState<TherapistData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {!selectedTherapist ? (
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
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Therapist
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profile Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sessions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTherapists.map((therapist) => (
                    <tr key={therapist.id} className="hover:bg-gray-50">
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {therapist.primary_location}
                        {therapist.offers_online && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Online
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          therapist.profile_completion_status === 'complete'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {therapist.profile_completion_status || 'incomplete'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {therapist.session_summary?.total_sessions || 0} sessions
                        <div className="text-xs text-gray-500">
                          {therapist.session_summary?.total_messages || 0} messages
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(therapist.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => setSelectedTherapist(therapist)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View Details
                        </button>
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

// Profile Information Component
const ProfileInformation: React.FC<{ therapist: TherapistData }> = ({ therapist }) => {
  return (
    <div className="space-y-6">
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
                  <span className="text-sm">Interaction Style</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.interaction_style}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Tone</span>
                  <span className="text-sm font-medium">{therapist.ai_style_config.tone}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Energy Level</span>
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
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

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
          </div>
        </div>

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
              {selectedSession.messages.map((message: any, index: number) => (
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
              className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => setSelectedSession(session)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">
                    Session #{session.session_number}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {new Date(session.created_at).toLocaleDateString()} at{' '}
                    {new Date(session.created_at).toLocaleTimeString()}
                  </p>
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>Status: <span className="capitalize">{session.status}</span></span>
                    <span>Messages: {session.message_count}</span>
                    {session.duration_seconds && (
                      <span>
                        Duration: {Math.floor(session.duration_seconds / 60)}m {session.duration_seconds % 60}s
                      </span>
                    )}
                  </div>
                </div>
                <button className="text-blue-600 hover:text-blue-800 text-sm">
                  View Transcript →
                </button>
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

export default S2AdminPanel;