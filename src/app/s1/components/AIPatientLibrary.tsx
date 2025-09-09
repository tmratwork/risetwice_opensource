// src/app/s1/components/AIPatientLibrary.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

interface AIPatient {
  id: string;
  name: string;
  age: number;
  gender: string;
  primary_concern: string;
  secondary_concerns: string[];
  severity_level: number;
  personality_traits: Record<string, any>;
  background_story?: string;
  therapeutic_goals: string[];
  difficulty_level: string;
  created_at: string;
}

interface Props {
  user: User;
}

const AIPatientLibrary: React.FC<Props> = ({ user }) => {
  const [patients, setPatients] = useState<AIPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<AIPatient | null>(null);
  const [filters, setFilters] = useState({
    difficulty: '',
    primary_concern: '',
    severity_min: 1,
    severity_max: 10
  });

  useEffect(() => {
    fetchPatients();
  }, [filters]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.difficulty) queryParams.append('difficulty', filters.difficulty);
      if (filters.primary_concern) queryParams.append('primary_concern', filters.primary_concern);

      const response = await fetch(`/api/s1/ai-patients?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI patients');
      }

      const data = await response.json();
      let filteredPatients = data.aiPatients || [];

      // Client-side filtering for severity range
      filteredPatients = filteredPatients.filter((patient: AIPatient) => 
        patient.severity_level >= filters.severity_min && 
        patient.severity_level <= filters.severity_max
      );

      setPatients(filteredPatients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Failed to load AI patients');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      difficulty: '',
      primary_concern: '',
      severity_min: 1,
      severity_max: 10
    });
  };

  if (loading && patients.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-300 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">AI Patient Library</h2>
          <p className="text-gray-600">Browse and learn about available AI patients for practice sessions</p>
        </div>
        <div className="text-sm text-gray-500">
          {patients.length} patient{patients.length !== 1 ? 's' : ''} available
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Difficulty Level
            </label>
            <select
              value={filters.difficulty}
              onChange={(e) => handleFilterChange('difficulty', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Concern
            </label>
            <select
              value={filters.primary_concern}
              onChange={(e) => handleFilterChange('primary_concern', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Concerns</option>
              <option value="anxiety">Anxiety</option>
              <option value="depression">Depression</option>
              <option value="trauma">Trauma</option>
              <option value="relationship_issues">Relationship Issues</option>
              <option value="addiction">Addiction</option>
              <option value="eating_disorders">Eating Disorders</option>
              <option value="grief">Grief & Loss</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Severity
            </label>
            <select
              value={filters.severity_min}
              onChange={(e) => handleFilterChange('severity_min', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Severity
            </label>
            <select
              value={filters.severity_max}
              onChange={(e) => handleFilterChange('severity_max', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Clear all filters
          </button>
        </div>
      </div>

      {/* Patient Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {patients.map((patient) => (
          <div
            key={patient.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedPatient(patient)}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{patient.name}</h3>
                  <p className="text-sm text-gray-500">{patient.age} years old, {patient.gender}</p>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  patient.difficulty_level === 'beginner' ? 'bg-green-100 text-green-800' :
                  patient.difficulty_level === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {patient.difficulty_level}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Primary Concern:</span>
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {patient.primary_concern.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Severity Level:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {patient.severity_level}/10
                  </span>
                </div>
              </div>

              {patient.secondary_concerns.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-1">Secondary Concerns:</p>
                  <div className="flex flex-wrap gap-1">
                    {patient.secondary_concerns.slice(0, 3).map((concern, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {concern.replace('_', ' ')}
                      </span>
                    ))}
                    {patient.secondary_concerns.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        +{patient.secondary_concerns.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="text-center">
                <button
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPatient(patient);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {patients.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">🤖</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
          <p className="text-gray-500">Try adjusting your filters or check back later.</p>
        </div>
      )}

      {/* Patient Detail Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-medium text-gray-900">{selectedPatient.name}</h3>
              <button
                onClick={() => setSelectedPatient(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="px-6 py-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Basic Information</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-600">Age:</span> {selectedPatient.age}</p>
                    <p><span className="text-gray-600">Gender:</span> {selectedPatient.gender}</p>
                    <p><span className="text-gray-600">Difficulty:</span> 
                      <span className="capitalize ml-1">{selectedPatient.difficulty_level}</span>
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Clinical Presentation</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-600">Primary:</span> 
                      <span className="capitalize ml-1">{selectedPatient.primary_concern.replace('_', ' ')}</span>
                    </p>
                    <p><span className="text-gray-600">Severity:</span> {selectedPatient.severity_level}/10</p>
                  </div>
                </div>
              </div>

              {selectedPatient.secondary_concerns.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Secondary Concerns</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.secondary_concerns.map((concern, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                      >
                        {concern.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedPatient.therapeutic_goals.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Therapeutic Goals</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                    {selectedPatient.therapeutic_goals.map((goal, index) => (
                      <li key={index}>{goal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedPatient.background_story && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Background</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {selectedPatient.background_story}
                  </p>
                </div>
              )}

              {selectedPatient.personality_traits && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Personality Traits</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(selectedPatient.personality_traits).map(([trait, value]) => (
                      <div key={trait} className="text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 capitalize">{trait.replace('_', ' ')}:</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedPatient(null)}
                className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIPatientLibrary;