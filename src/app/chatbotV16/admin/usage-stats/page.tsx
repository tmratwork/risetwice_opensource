'use client';

import { useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, Activity, Eye, Clock, TrendingUp, UserCheck, UserPlus, RotateCcw, Key, User, ExternalLink } from 'lucide-react';
import { useAdminAuth } from '@/hooks/useAdminAuth';

interface UsageStats {
  totalUsers: number;
  authenticatedUsers: number;
  anonymousUsers: number;
  totalSessions: number;
  totalPageViews: number;
  averageSessionDuration: number;
  dailyStats: Array<{
    date: string;
    sessions: number;
    pageViews: number;
    uniqueUsers: number;
  }>;
  topPages: Array<{
    path: string;
    views: number;
  }>;
  userActivity: {
    newUsersToday: number;
    activeUsersToday: number;
    returningUsers: number;
  };
}

interface UniqueUser {
  user_id: string | null;
  anonymous_id: string | null;
  first_visit: string;
  last_visit: string;
  total_sessions: number;
  total_page_views: number;
  total_time_spent_minutes: number;
}

export default function UsageStatsPage() {
  const { isAdmin, loading: authLoading, error: authError } = useAdminAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [uniqueUsers, setUniqueUsers] = useState<UniqueUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(1);
  const [showUserIds, setShowUserIds] = useState(false);
  const [showAuthenticatedOnly, setShowAuthenticatedOnly] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [statsResponse, usersResponse] = await Promise.all([
        fetch(`/api/admin/usage-stats?days=${days}`),
        fetch(`/api/admin/unique-users?days=${days}`)
      ]);

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const statsData = await statsResponse.json();
      setStats(statsData);

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUniqueUsers(usersData.users || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking authentication
  if (authLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {authLoading ? 'Verifying admin access...' : 'Loading usage statistics...'}
            </p>
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

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-32">
        <h1 className="text-3xl font-bold mb-8">Usage Statistics</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">Error: {error}</p>
          <button
            onClick={fetchStats}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const StatCard = ({ title, value, icon: Icon, subtitle }: {
    title: string;
    value: number | string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    subtitle?: string;
  }) => (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        <Icon size={24} className="text-sage-500" />
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6 pt-32">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Usage Statistics</h1>
        <div className="flex items-center space-x-4">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 bg-white dark:bg-gray-800"
          >
            <option value={0}>Today</option>
            <option value={1}>Yesterday</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchStats}
            className="flex items-center space-x-2 px-4 py-2 bg-sage-500 text-white rounded-md hover:bg-sage-600"
          >
            <RotateCcw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          subtitle={`${stats.authenticatedUsers} auth, ${stats.anonymousUsers} anon`}
        />
        <StatCard
          title="Total Sessions"
          value={stats.totalSessions}
          icon={Activity}
        />
        <StatCard
          title="Total Page Views"
          value={stats.totalPageViews}
          icon={Eye}
        />
        <StatCard
          title="Avg Session Duration"
          value={`${stats.averageSessionDuration}m`}
          icon={Clock}
        />
      </div>

      {/* Key/Legend */}
      <div className="mb-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setShowLegend(!showLegend)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors rounded-lg"
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">How are these metrics calculated?</span>
          </div>
          <svg 
            className={`w-4 h-4 text-gray-600 dark:text-gray-400 transform transition-transform ${showLegend ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showLegend && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="pt-4 space-y-6">
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-4">
                All metrics are calculated based on the selected time period using the dropdown above.
              </div>
              
              {/* Overview Statistics */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-1">
                  Overview Statistics
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <Users size={16} className="text-sage-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Users</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Count of unique user identifiers (both authenticated and anonymous) who had sessions during the selected period.
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                        <div>• <span className="text-blue-600 dark:text-blue-400">Authenticated:</span> Users logged in with Firebase accounts</div>
                        <div>• <span className="text-orange-600 dark:text-orange-400">Anonymous:</span> Browser-generated identifiers (may overcount actual people)</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Activity size={16} className="text-sage-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Sessions</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Count of distinct user sessions that occurred during the selected period. A session starts when a user visits the site and ends when they leave or become inactive.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Eye size={16} className="text-sage-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Page Views</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Sum of all individual page views across all sessions during the selected period. Each navigation to a new page increments this count.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <Clock size={16} className="text-sage-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Average Session Duration</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Average time (in minutes) calculated only from sessions that successfully recorded an end time via browser unload events. Most sessions (~79%) don&apos;t record end times due to unreliable browser unload tracking, making this metric incomplete and potentially inflated.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Activity */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-1">
                  Today&apos;s Activity
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <UserPlus size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-green-700 dark:text-green-300">New Users</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Count of users whose first_visit timestamp in user_usage_summary occurred today. This can be inaccurate due to summary record creation issues or upsert conflicts that reset first_visit dates.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <UserCheck size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Active Users</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Count of unique user identifiers (authenticated user_id or anonymous anonymous_id) who had at least one session today.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <TrendingUp size={16} className="text-purple-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Returning Users</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Count of users whose first_visit in user_usage_summary is before today AND who also had a session today. Often shows 0 due to data integrity issues where first_visit dates get incorrectly reset to recent dates.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Activity Chart */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-1">
                  Daily Activity Chart
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>
                      <div className="text-sm font-medium text-green-700 dark:text-green-300">Sessions (Green Line)</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Number of sessions that started on each day within the selected period.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>
                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300">Unique Users (Blue Line)</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Number of distinct users who had sessions on each day within the selected period.
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-3 h-3 bg-purple-500 rounded-full mt-1.5 flex-shrink-0"></div>
                    <div>
                      <div className="text-sm font-medium text-purple-700 dark:text-purple-300">Page Views (Purple Line)</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Total number of pages viewed on each day within the selected period.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Pages */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600 pb-1">
                  Top Pages
                </h3>
                
                <div className="flex items-start space-x-3">
                  <div className="w-3 h-3 bg-gray-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Page Views</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Count of individual page views for each URL path during the selected period, sorted by most viewed.
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Collection Notes */}
              <div className="space-y-4 border-t border-orange-200 dark:border-orange-800 pt-4">
                <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                  ⚠️ Data Collection Notes
                </h3>
                
                <div className="space-y-2 text-xs text-orange-700 dark:text-orange-300">
                  <div>• <strong>Anonymous User Counting:</strong> Each browser/device generates a unique anonymous ID, so the same person using multiple browsers appears as multiple users.</div>
                  <div>• <strong>Session Duration Reliability:</strong> Only ~21% of sessions successfully record end times due to unreliable browser unload events (sendBeacon/fetch failures). The reported average may be inflated as it excludes the majority of shorter sessions that don&apos;t complete the end-session tracking.</div>
                  <div>• <strong>Date Filtering:</strong> &quot;Today&quot; uses full day (00:00-23:59), &quot;Yesterday&quot; uses previous full day, other periods use X days ago to now.</div>
                  <div>• <strong>Real-time Data:</strong> Today&apos;s activity metrics are always calculated for the current day, regardless of the selected time period filter.</div>
                  <div>• <strong>Sessions vs Page Views Discrepancy:</strong> If Total Sessions exceeds Total Page Views, this indicates a tracking system bug where multiple phantom sessions are created per actual user visit. These duplicate sessions have 0 page views while only the valid sessions record actual page navigation. <em>A fix was implemented on August 8, 2025 to prevent duplicate session creation - we are monitoring to verify the fix is working.</em></div>
                  <div>• <strong>Today&apos;s Activity Data Issues:</strong> &quot;Returning Users&quot; often shows 0 because the user_usage_summary table&apos;s first_visit timestamps get incorrectly reset due to upsert conflicts or summary table bugs. Users who have visited before may appear as &quot;New Users&quot; instead of &quot;Returning Users&quot;. <em>Fixes implemented on August 9, 2025 to preserve first_visit timestamps and prevent session double-counting - monitoring to verify effectiveness.</em></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Today's Activity */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Today&apos;s Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <UserPlus className="text-green-600" size={20} />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">New Users</p>
              <p className="text-lg font-semibold">{stats.userActivity.newUsersToday}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <UserCheck className="text-blue-600" size={20} />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Users</p>
              <p className="text-lg font-semibold">{stats.userActivity.activeUsersToday}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <TrendingUp className="text-purple-600" size={20} />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Returning Users</p>
              <p className="text-lg font-semibold">{stats.userActivity.returningUsers}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unique User IDs */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Unique Users</h2>
          <div className="flex items-center space-x-2">
            {showUserIds && (
              <button
                onClick={() => setShowAuthenticatedOnly(!showAuthenticatedOnly)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-md text-sm ${showAuthenticatedOnly
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
              >
                <UserCheck size={16} />
                <span>Authenticated Only</span>
              </button>
            )}
            <button
              onClick={() => setShowUserIds(!showUserIds)}
              className="flex items-center space-x-2 px-3 py-1 bg-sage-500 text-white rounded-md hover:bg-sage-600 text-sm"
            >
              <Key size={16} />
              <span>{showUserIds ? 'Hide' : 'Show'} IDs</span>
            </button>
          </div>
        </div>

        {showUserIds && (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {uniqueUsers
              .filter(user => !showAuthenticatedOnly || user.user_id)
              .map((user, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User size={16} className={user.user_id ? 'text-blue-600' : 'text-gray-500'} />
                    <div>
                      <p className="font-mono text-sm">
                        {user.user_id || user.anonymous_id}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user.user_id ? 'Authenticated' : 'Anonymous'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{user.total_sessions} sessions</p>
                    <p className="text-gray-500 dark:text-gray-400">{user.total_page_views} views</p>
                  </div>
                </div>
              ))}
            {uniqueUsers.filter(user => !showAuthenticatedOnly || user.user_id).length === 0 && (
              <p className="text-gray-500 text-center py-4">
                {showAuthenticatedOnly ? 'No authenticated users found' : 'No users found'}
              </p>
            )}
          </div>
        )}

        {!showUserIds && (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-400">
              Click &quot;Show IDs&quot; to view individual user identifiers
            </p>
          </div>
        )}
      </div>

      {/* Daily Activity Chart */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Daily Activity</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats.dailyStats}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="sessions" stroke="#22c55e" strokeWidth={2} name="Sessions" />
            <Line type="monotone" dataKey="uniqueUsers" stroke="#3b82f6" strokeWidth={2} name="Unique Users" />
            <Line type="monotone" dataKey="pageViews" stroke="#8b5cf6" strokeWidth={2} name="Page Views" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Pages */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Top Pages</h2>
        <div className="space-y-3">
          {stats.topPages.map((page, index) => (
            <div key={page.path} className="flex items-center justify-between py-2">
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                <span className="font-mono text-sm">{page.path}</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {page.views} views
              </span>
            </div>
          ))}
          {stats.topPages.length === 0 && (
            <p className="text-gray-500 text-center py-4">No page data available</p>
          )}
        </div>
      </div>
    </div>
  );
}