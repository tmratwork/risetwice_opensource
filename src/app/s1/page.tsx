// src/app/s1/page.tsx
// S1 Main Dashboard - Therapist Interface (Simplified for Testing)

"use client";

import React, { useState, useEffect } from 'react';
import SessionInterface from './components/SessionInterface';

// Types
interface TherapistProfile {
  id: string;
  competency_level: string;
  total_sessions_completed: number;
  total_case_studies_generated: number;
  is_active: boolean;
}

interface AIPatient {
  id: string;
  name: string;
  primary_concern: string;
  severity_level: number;
  difficulty_level: string;
}

const S1Dashboard: React.FC = () => {
  const [therapistProfile, setTherapistProfile] = useState<TherapistProfile | null>(null);
  const [availablePatients, setAvailablePatients] = useState<AIPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);

  useEffect(() => {
    console.log('[S1] Component mounted, starting data fetch...');
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      console.log('[S1] Fetching therapist profile...');
      const profileResponse = await fetch('/api/s1/therapist-profile');
      console.log('[S1] Profile response status:', profileResponse.status);
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('[S1] Profile data:', profileData);
        setTherapistProfile(profileData.profile);
      }

      console.log('[S1] Fetching AI patients...');
      const patientsResponse = await fetch('/api/s1/ai-patients');
      console.log('[S1] Patients response status:', patientsResponse.status);
      
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        console.log('[S1] Patients data:', patientsData);
        setAvailablePatients(patientsData.aiPatients || []);
      }

    } catch (error) {
      console.error('[S1] Error fetching data:', error);
      setError('Failed to load data');
    } finally {
      console.log('[S1] Setting loading to false');
      setLoading(false);
    }
  };

  const startSession = async (patientId: string) => {
    try {
      console.log('[S1] Starting session with patient:', patientId);
      setStartingSession(patientId);
      
      // Create session
      const response = await fetch('/api/s1/therapy-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ai_patient_id: patientId })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const { session } = await response.json();
      console.log('[S1] Session created:', session);
      
      // Open the chat interface
      setActiveSession(session);
      
    } catch (error) {
      console.error('[S1] Error starting session:', error);
      alert('Failed to start session. Check console for details.');
    } finally {
      setStartingSession(null);
    }
  };

  console.log('[S1] Render - loading:', loading, 'error:', error, 'profile:', !!therapistProfile);

  // If we have an active session, show the chat interface
  if (activeSession) {
    return (
      <SessionInterface
        sessionId={activeSession.id}
        onSessionEnd={() => setActiveSession(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading S1 Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">S1 Therapist Interface</h1>
              <p className="text-sm text-gray-600">AI Patient Simulation & Case Study Generation</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">Test User</p>
                <p className="text-xs text-gray-500 capitalize">
                  {therapistProfile?.competency_level || 'student'}
                </p>
              </div>
              <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">T</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold">📊</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Sessions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {therapistProfile?.total_sessions_completed || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-semibold">📚</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Case Studies</p>
                <p className="text-2xl font-bold text-gray-900">
                  {therapistProfile?.total_case_studies_generated || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-semibold">🤖</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">AI Patients</p>
                <p className="text-2xl font-bold text-gray-900">
                  {availablePatients.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Patients */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Available AI Patients</h3>
            <p className="text-sm text-gray-500">Choose an AI patient to practice with</p>
          </div>
          <div className="p-6">
            {availablePatients.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No AI patients available</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availablePatients.map((patient) => (
                  <div key={patient.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{patient.name}</h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        patient.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                        patient.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {patient.difficulty_level}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2 capitalize">
                      {patient.primary_concern.replace('_', ' ')}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Severity: {patient.severity_level}/10
                      </span>
                      <button 
                        onClick={() => startSession(patient.id)}
                        disabled={startingSession === patient.id}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {startingSession === patient.id ? 'Starting...' : 'Start Session'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default S1Dashboard;