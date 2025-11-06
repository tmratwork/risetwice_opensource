// src/app/dashboard/provider/patient-matches/page.tsx
// Provider's list of entered patient access codes

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { getUserRole, UserRole } from '@/utils/user-role';
import { Header } from '@/components/header';

interface AccessCodeEntry {
  accessCode: string;
  intakeId: string;
  firstEnteredAt: string;
  lastEnteredAt: string;
  patientName: string;
  preferredName: string | null;
  submittedAt: string;
  status: string;
}

const PatientMatchesPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [, setUserRole] = useState<UserRole | null>(null);
  const [accessCodes, setAccessCodes] = useState<AccessCodeEntry[]>([]);

  useEffect(() => {
    async function loadAccessCodes() {
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

        // Fetch access codes
        const response = await fetch(`/api/provider/access-codes?provider_user_id=${user.uid}`);
        const data = await response.json();

        if (data.success) {
          setAccessCodes(data.codes || []);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading access codes:', error);
        setLoading(false);
      }
    }

    loadAccessCodes();
  }, [user, authLoading, router]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading patient matches...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: '#c1d7ca', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <button
              onClick={() => router.push('/dashboard/provider')}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Back to Dashboard
            </button>
            <div className="text-right">
              <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Patient Matches
              </h1>
              <p className="text-gray-600">Access codes you&apos;ve entered</p>
            </div>
          </div>

          {/* Access Codes List */}
          {accessCodes.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-500 dark:text-gray-400 mb-2">
                  No patient matches yet
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  Enter access codes from the dashboard to see patient intake recordings here.
                </p>
                <button
                  onClick={() => router.push('/dashboard/provider')}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Access Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Patient Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Viewed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {accessCodes.map((entry) => (
                      <tr
                        key={entry.accessCode}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/provider/intake/${entry.accessCode}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {entry.accessCode}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {entry.patientName}
                          </div>
                          {entry.preferredName && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              ({entry.preferredName})
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(entry.submittedAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(entry.lastEnteredAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            entry.status === 'completed'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : entry.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/dashboard/provider/intake/${entry.accessCode}`);
                            }}
                            className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PatientMatchesPage;
