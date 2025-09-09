// src/app/s1/components/CaseStudyLibrary.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';

interface CaseStudy {
  id: string;
  title: string;
  case_study_type: string;
  presenting_concerns: string[];
  therapeutic_approach_used?: string;
  key_learning_points: string[];
  educational_level: string;
  publication_tags: string[];
  is_published: boolean;
  review_status: string;
  created_at: string;
  created_by: string;
}

interface Props {
  user: User;
}

const CaseStudyLibrary: React.FC<Props> = ({ user }) => {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<CaseStudy | null>(null);
  const [detailedCaseStudy, setDetailedCaseStudy] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [filters, setFilters] = useState({
    published: 'all', // 'all', 'published', 'mine'
    educational_level: '',
    case_study_type: '',
    concern: ''
  });

  useEffect(() => {
    fetchCaseStudies();
  }, [filters]);

  const fetchCaseStudies = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      
      if (filters.published === 'published') {
        queryParams.append('published', 'true');
      }
      if (filters.educational_level) {
        queryParams.append('educational_level', filters.educational_level);
      }
      if (filters.case_study_type) {
        queryParams.append('type', filters.case_study_type);
      }

      const response = await fetch(`/api/s1/case-studies?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch case studies');
      }

      const data = await response.json();
      let filteredCaseStudies = data.caseStudies || [];

      // Client-side filtering for concern
      if (filters.concern) {
        filteredCaseStudies = filteredCaseStudies.filter((cs: CaseStudy) =>
          cs.presenting_concerns.some(concern => 
            concern.toLowerCase().includes(filters.concern.toLowerCase())
          )
        );
      }

      // Filter for "mine" option
      if (filters.published === 'mine') {
        filteredCaseStudies = filteredCaseStudies.filter((cs: CaseStudy) =>
          cs.created_by === user.uid
        );
      }

      setCaseStudies(filteredCaseStudies);
    } catch (error) {
      console.error('Error fetching case studies:', error);
      setError('Failed to load case studies');
    } finally {
      setLoading(false);
    }
  };

  const fetchCaseStudyDetails = async (id: string) => {
    try {
      setLoadingDetails(true);
      const response = await fetch(`/api/s1/case-studies/${id}`, {
        headers: {
          'Authorization': `Bearer ${await user.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDetailedCaseStudy(data.caseStudy);
      }
    } catch (error) {
      console.error('Error fetching case study details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      published: 'all',
      educational_level: '',
      case_study_type: '',
      concern: ''
    });
  };

  const openCaseStudyDetail = (caseStudy: CaseStudy) => {
    setSelectedCaseStudy(caseStudy);
    fetchCaseStudyDetails(caseStudy.id);
  };

  const closeCaseStudyDetail = () => {
    setSelectedCaseStudy(null);
    setDetailedCaseStudy(null);
  };

  if (loading && caseStudies.length === 0) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-gray-300 rounded-lg"></div>
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
          <h2 className="text-2xl font-bold text-gray-900">Case Study Library</h2>
          <p className="text-gray-600">Review case studies generated from therapy sessions</p>
        </div>
        <div className="text-sm text-gray-500">
          {caseStudies.length} case stud{caseStudies.length !== 1 ? 'ies' : 'y'}
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
              Visibility
            </label>
            <select
              value={filters.published}
              onChange={(e) => handleFilterChange('published', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Available</option>
              <option value="published">Published Only</option>
              <option value="mine">My Case Studies</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Educational Level
            </label>
            <select
              value={filters.educational_level}
              onChange={(e) => handleFilterChange('educational_level', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Levels</option>
              <option value="student">Student</option>
              <option value="novice">Novice</option>
              <option value="experienced">Experienced</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Case Type
            </label>
            <select
              value={filters.case_study_type}
              onChange={(e) => handleFilterChange('case_study_type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="therapy_session">Therapy Session</option>
              <option value="assessment">Assessment</option>
              <option value="treatment_series">Treatment Series</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Concern
            </label>
            <input
              type="text"
              value={filters.concern}
              onChange={(e) => handleFilterChange('concern', e.target.value)}
              placeholder="e.g. anxiety, depression"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

      {/* Case Study Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {caseStudies.map((caseStudy) => (
          <div
            key={caseStudy.id}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => openCaseStudyDetail(caseStudy)}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-medium text-gray-900 line-clamp-2">
                  {caseStudy.title}
                </h3>
                <div className="flex space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    caseStudy.educational_level === 'student' ? 'bg-green-100 text-green-800' :
                    caseStudy.educational_level === 'novice' ? 'bg-blue-100 text-blue-800' :
                    caseStudy.educational_level === 'experienced' ? 'bg-purple-100 text-purple-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {caseStudy.educational_level}
                  </span>
                  {caseStudy.is_published && (
                    <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800">
                      Published
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Presenting Concerns:</p>
                  <div className="flex flex-wrap gap-1">
                    {caseStudy.presenting_concerns.slice(0, 3).map((concern, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded capitalize"
                      >
                        {concern.replace('_', ' ')}
                      </span>
                    ))}
                    {caseStudy.presenting_concerns.length > 3 && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        +{caseStudy.presenting_concerns.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                {caseStudy.therapeutic_approach_used && (
                  <div>
                    <p className="text-sm text-gray-600">Approach:</p>
                    <p className="text-sm font-medium text-gray-900">
                      {caseStudy.therapeutic_approach_used}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-600">Learning Points:</p>
                  <p className="text-sm text-gray-700">
                    {caseStudy.key_learning_points.length} key insight{caseStudy.key_learning_points.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  {new Date(caseStudy.created_at).toLocaleDateString()}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full ${
                  caseStudy.review_status === 'published' ? 'bg-green-100 text-green-800' :
                  caseStudy.review_status === 'approved' ? 'bg-blue-100 text-blue-800' :
                  caseStudy.review_status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {caseStudy.review_status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {caseStudies.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No case studies found</h3>
          <p className="text-gray-500">
            Complete therapy sessions to generate case studies, or try adjusting your filters.
          </p>
        </div>
      )}

      {/* Case Study Detail Modal */}
      {selectedCaseStudy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-xl font-medium text-gray-900">{selectedCaseStudy.title}</h3>
              <button
                onClick={closeCaseStudyDetail}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="px-6 py-4">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : detailedCaseStudy ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Case Information</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-gray-600">Type:</span> {detailedCaseStudy.case_study_type}</p>
                        <p><span className="text-gray-600">Educational Level:</span> {detailedCaseStudy.educational_level}</p>
                        <p><span className="text-gray-600">Status:</span> {detailedCaseStudy.review_status}</p>
                        <p><span className="text-gray-600">Date:</span> {new Date(detailedCaseStudy.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Clinical Details</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="text-gray-600">Approach:</span> {detailedCaseStudy.therapeutic_approach_used || 'N/A'}</p>
                        <p><span className="text-gray-600">Concerns:</span> {detailedCaseStudy.presenting_concerns.join(', ')}</p>
                      </div>
                    </div>
                  </div>

                  {detailedCaseStudy.key_learning_points && detailedCaseStudy.key_learning_points.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Key Learning Points</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {detailedCaseStudy.key_learning_points.map((point: string, index: number) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detailedCaseStudy.therapeutic_challenges && detailedCaseStudy.therapeutic_challenges.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Therapeutic Challenges</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {detailedCaseStudy.therapeutic_challenges.map((challenge: string, index: number) => (
                          <li key={index}>{challenge}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detailedCaseStudy.successful_interventions && detailedCaseStudy.successful_interventions.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Successful Interventions</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {detailedCaseStudy.successful_interventions.map((intervention: string, index: number) => (
                          <li key={index}>{intervention}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detailedCaseStudy.therapist_performance_analysis && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Performance Analysis</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                          {detailedCaseStudy.therapist_performance_analysis}
                        </pre>
                      </div>
                    </div>
                  )}

                  {detailedCaseStudy.alternative_approaches_suggested && detailedCaseStudy.alternative_approaches_suggested.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Alternative Approaches</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                        {detailedCaseStudy.alternative_approaches_suggested.map((approach: string, index: number) => (
                          <li key={index}>{approach}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detailedCaseStudy.publication_tags && detailedCaseStudy.publication_tags.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {detailedCaseStudy.publication_tags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Failed to load case study details.</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200">
              <button
                onClick={closeCaseStudyDetail}
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

export default CaseStudyLibrary;