'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { ExternalLink, Users, Calendar, User } from 'lucide-react';

interface Circle {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  rules: string[] | null;
  icon_url: string | null;
  banner_url: string | null;
  member_count: number;
  post_count: number;
  is_private: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  requires_approval: boolean;
  welcome_message: string | null;
  join_questions: string[] | null;
  is_approved: boolean;
}

export default function CircleApprovalAdmin() {
  const { isAdmin, loading: authLoading, error: authError } = useAdminAuth();
  const [pendingCircles, setPendingCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    loadPendingCircles();
  }, [isAdmin]);

  const loadPendingCircles = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v16/admin/circles');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setPendingCircles(data.pendingCircles || []);
    } catch (err) {
      console.error('Error loading pending circles:', err);
      setError(`Failed to load pending circles: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (circleId: string, isApproved: boolean) => {
    const action = isApproved ? 'approve' : 'reject';
    const circle = pendingCircles.find(c => c.id === circleId);
    
    if (!circle) {
      setError('Circle not found');
      return;
    }

    if (!confirm(`Are you sure you want to ${action} the circle "${circle.display_name}"?`)) {
      return;
    }

    try {
      setProcessing(circleId);
      setError(null);

      const response = await fetch(`/api/v16/admin/circles/${circleId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_approved: isApproved
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`Circle ${action}d:`, data.message);

      // Reload pending circles
      await loadPendingCircles();

    } catch (err) {
      console.error(`Error ${action}ing circle:`, err);
      setError(`Failed to ${action} circle: ${(err as Error).message}`);
    } finally {
      setProcessing(null);
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Verifying admin access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there was an issue checking permissions
  if (authError) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
                Authentication Error
              </h2>
              <p className="text-red-600 dark:text-red-300 mb-4">{authError}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contact developers to gain access to these admin pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8">
              <div className="mb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-200 mb-3">
                Admin Access Required
              </h2>
              <p className="text-blue-600 dark:text-blue-300 mb-2">
                This page requires administrator privileges.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contact developers to gain access to these admin pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sage-200 dark:bg-[#131314] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-sage-100 dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-sage-500 dark:text-gray-200">
              Circle Approval
            </h1>
            <div className="flex gap-2">
              <button
                onClick={loadPendingCircles}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                onClick={() => window.location.href = '/chatbotV16/admin'}
                className="px-4 py-2 bg-sage-300 dark:bg-gray-700 text-sage-500 dark:text-gray-200 rounded hover:bg-sage-400 dark:hover:bg-gray-600"
              >
                ← Back to Admin
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
              <p className="text-red-800 dark:text-red-300 font-medium">Error:</p>
              <p className="text-red-700 dark:text-red-400 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Statistics */}
          <div className="mb-6 p-4 bg-sage-50 dark:bg-gray-700 rounded">
            <h3 className="text-sm font-medium text-sage-500 dark:text-gray-200 mb-2">
              Statistics
            </h3>
            <div className="text-xs text-sage-400 dark:text-gray-400">
              Pending circles awaiting approval: {pendingCircles.length}
            </div>
          </div>

          {/* Pending Circles List */}
          <div className="space-y-4">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading pending circles...</p>
              </div>
            ) : pendingCircles.length === 0 ? (
              <div className="p-8 text-center bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg">
                <Users className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-green-800 dark:text-green-300 mb-2">
                  No Pending Circles
                </h3>
                <p className="text-green-700 dark:text-green-400">
                  All circles have been reviewed. New circles created by users will appear here for approval.
                </p>
              </div>
            ) : (
              pendingCircles.map((circle) => (
                <div key={circle.id} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {circle.display_name}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({circle.name})
                        </span>
                        {circle.is_private && (
                          <span className="px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded">
                            Private
                          </span>
                        )}
                        {circle.requires_approval && (
                          <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                            Requires Approval
                          </span>
                        )}
                      </div>
                      
                      {circle.description && (
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                          {circle.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>Creator: {circle.created_by}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Created: {new Date(circle.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{circle.member_count} members</span>
                        </div>
                      </div>

                      {circle.rules && circle.rules.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rules:</h4>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                            {circle.rules.map((rule, index) => (
                              <li key={index}>{rule}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {circle.welcome_message && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Welcome Message:</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-600 p-2 rounded">
                            {circle.welcome_message}
                          </p>
                        </div>
                      )}

                      {circle.join_questions && circle.join_questions.length > 0 && (
                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Join Questions:</h4>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
                            {circle.join_questions.map((question, index) => (
                              <li key={index}>{question}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        Circle ID: {circle.id}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 ml-4">
                      <button
                        onClick={() => handleApproval(circle.id, true)}
                        disabled={processing === circle.id}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {processing === circle.id ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            ✓ Approve
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleApproval(circle.id, false)}
                        disabled={processing === circle.id}
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        ✗ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}