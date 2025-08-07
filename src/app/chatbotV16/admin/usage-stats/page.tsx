'use client';

import { useState, useEffect } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Users, Activity, Eye, Clock, TrendingUp, UserCheck, UserPlus, RotateCcw, Key, User } from 'lucide-react';

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
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [uniqueUsers, setUniqueUsers] = useState<UniqueUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(1);
  const [showUserIds, setShowUserIds] = useState(false);
  const [showAuthenticatedOnly, setShowAuthenticatedOnly] = useState(false);

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

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-32">
        <h1 className="text-3xl font-bold mb-8">Usage Statistics</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-500"></div>
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