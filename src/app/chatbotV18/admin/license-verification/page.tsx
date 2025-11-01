'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface TherapistProfile {
  id: string;
  user_id: string;
  full_name: string;
  email_address: string | null;
  phone_number: string | null;
  is_license_verified: boolean;
  title: string;
  primary_location: string;
}

export default function LicenseVerificationPage() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [therapists, setTherapists] = useState<TherapistProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      fetchTherapists();
    }
  }, [authLoading, isAdmin]);

  const fetchTherapists = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/therapist-profiles');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch therapist profiles');
      }

      setTherapists(result.profiles);
    } catch (err) {
      console.error('Error fetching therapists:', err);
      setError(err instanceof Error ? err.message : 'Failed to load therapist profiles');
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    try {
      setUpdating(userId);
      const response = await fetch('/api/admin/toggle-license-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          isVerified: !currentStatus
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update verification status');
      }

      // Update local state
      setTherapists(prev =>
        prev.map(t =>
          t.user_id === userId
            ? { ...t, is_license_verified: !currentStatus }
            : t
        )
      );
    } catch (err) {
      console.error('Error toggling verification:', err);
      alert(err instanceof Error ? err.message : 'Failed to update verification status');
    } finally {
      setUpdating(null);
    }
  };

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24 overflow-y-auto h-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Verifying admin access...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24 overflow-y-auto h-full">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8">
              <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-200 mb-3">
                Admin Access Required
              </h2>
              <p className="text-blue-600 dark:text-blue-300">
                This page requires administrator privileges.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pt-24 overflow-y-auto h-full pb-24">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/chatbotV18/admin"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Admin Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Therapist License Verification
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage therapist license verification status. Verified therapists can access patient voice recordings and contact information.
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading therapist profiles...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Therapists</h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {therapists.length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Verified</h3>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-2">
                {therapists.filter(t => t.is_license_verified).length}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Unverified</h3>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-2">
                {therapists.filter(t => !t.is_license_verified).length}
              </p>
            </div>
          </div>

          {/* Therapist List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Therapist Profiles
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {therapists.map((therapist) => (
                    <tr key={therapist.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {therapist.full_name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {therapist.user_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {therapist.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {therapist.primary_location}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 dark:text-gray-100">
                          {therapist.email_address && (
                            <div className="truncate max-w-xs">{therapist.email_address}</div>
                          )}
                          {therapist.phone_number && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {therapist.phone_number}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {therapist.is_license_verified ? (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            Verified
                          </span>
                        ) : (
                          <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200">
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => toggleVerification(therapist.user_id, therapist.is_license_verified)}
                          disabled={updating === therapist.user_id}
                          className={`px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            therapist.is_license_verified
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {updating === therapist.user_id ? (
                            <span className="flex items-center">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Updating...
                            </span>
                          ) : therapist.is_license_verified ? (
                            'Revoke Verification'
                          ) : (
                            'Verify License'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {therapists.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No therapist profiles found</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
