// src/app/s1/components/SessionDashboard.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import SessionInterface from './SessionInterface';

interface TherapistProfile {
  id: string;
  competency_level: string;
  total_sessions_completed: number;
  total_case_studies_generated: number;
  average_alliance_score?: number;
}

interface ActiveSession {
  id: string;
  ai_patient_id: string;
  status: 'in_progress' | 'scheduled';
  started_at?: string;
}

interface Session {
  id: string;
  ai_patient_id: string;
  session_number: number;
  session_type: string;
  status: string;
  created_at: string;
  therapeutic_alliance_score?: number;
  technique_effectiveness_score?: number;
  s1_ai_patients: {
    name: string;
    primary_concern: string;
    severity_level: number;
    difficulty_level: string;
  };
}

interface AIPatient {
  id: string;
  name: string;
  primary_concern: string;
  severity_level: number;
  difficulty_level: string;
}

interface Props {
  user: User;
  therapistProfile: TherapistProfile;
  activeSession: ActiveSession | null;
  onSessionStart: (session: ActiveSession) => void;
  onSessionEnd: () => void;
}

const SessionDashboard: React.FC<Props> = ({ 
  user, 
  therapistProfile, 
  activeSession, 
  onSessionStart, 
  onSessionEnd 
}) => {
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [availablePatients, setAvailablePatients] = useState<AIPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSessionInterface, setShowSessionInterface] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeSession) {
      setShowSessionInterface(true);
    }
  }, [activeSession]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch recent sessions
      const sessionsResponse = await fetch('/api/s1/therapy-sessions', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      
      if (sessionsResponse.ok) {
        const sessionsData = await sessionsResponse.json();
        setRecentSessions(sessionsData.sessions.slice(0, 5)); // Show 5 most recent
      }

      // Fetch available AI patients
      const patientsResponse = await fetch('/api/s1/ai-patients', {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });
      
      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        setAvailablePatients(patientsData.aiPatients);
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = async (aiPatientId: string) => {
    try {
      const response = await fetch('/api/s1/therapy-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          ai_patient_id: aiPatientId,
          session_type: 'therapy'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const { session } = await response.json();
      
      // Start the session
      const startResponse = await fetch('/api/s1/therapy-sessions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          session_id: session.id
        })
      });

      if (!startResponse.ok) {
        throw new Error('Failed to start session');
      }

      const { session: startedSession } = await startResponse.json();
      
      onSessionStart({
        id: startedSession.id,
        ai_patient_id: startedSession.ai_patient_id,
        status: 'in_progress',
        started_at: startedSession.started_at
      });

      setShowSessionInterface(true);
      
    } catch (error) {
      console.error('Error starting session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start session');
    }
  };

  const handleSessionEnd = () => {
    onSessionEnd();
    setShowSessionInterface(false);
    fetchDashboardData(); // Refresh data
  };

  if (showSessionInterface && activeSession) {
    return (
      <SessionInterface
        user={user}
        sessionId={activeSession.id}
        onSessionEnd={handleSessionEnd}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-gray-300 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                {therapistProfile.total_sessions_completed}
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
                {therapistProfile.total_case_studies_generated}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-semibold">🤝</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Alliance</p>
              <p className="text-2xl font-bold text-gray-900">
                {therapistProfile.average_alliance_score 
                  ? `${therapistProfile.average_alliance_score.toFixed(1)}/10`
                  : 'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start Session */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Start New Session</h3>
          <p className="text-sm text-gray-500">Choose an AI patient to practice with</p>
        </div>
        <div className="p-6">
          {availablePatients.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No AI patients available</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePatients.map((patient) => (
                <div key={patient.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
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
                      onClick={() => startNewSession(patient.id)}
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                    >
                      Start Session
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Sessions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Sessions</h3>
        </div>
        <div className="overflow-hidden">
          {recentSessions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No sessions yet</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Session
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alliance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {session.s1_ai_patients.name}
                        </div>
                        <div className="text-sm text-gray-500 capitalize">
                          {session.s1_ai_patients.primary_concern.replace('_', ' ')}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      #{session.session_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        session.status === 'completed' ? 'bg-green-100 text-green-800' :
                        session.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.therapeutic_alliance_score 
                        ? `${session.therapeutic_alliance_score}/10`
                        : 'N/A'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(session.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionDashboard;