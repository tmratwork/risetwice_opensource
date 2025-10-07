// src/app/dashboard/provider/analytics/page.tsx
// Provider Analytics & Insights Dashboard

"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { getUserRole, UserRole } from '@/utils/user-role';
import { Header } from '@/components/header';

type TabType = 'overview' | 'insights' | 'users' | 'profile';

interface AnalyticsMetrics {
  totalSessions: number;
  uniqueUsers: number;
  totalContactClicks: number;
  avgSessionDuration: string;
  avgSessionDurationSeconds: number;
  conversionRate: number;
  weeklyGrowth: number;
  sessionsThisWeek: number;
  sessionsPreviousWeek: number;
}

interface Topic {
  topic: string;
  count: number;
  percentage: number;
}

interface AnalyticsInsights {
  commonTopics: Topic[];
  sessionAnalytics: {
    avgDropoffPoint: string;
    avgDropoffPointSeconds: number;
    peakEngagementTimes: string;
    totalSessions: number;
  };
  frequentQuestions: string[];
}

interface EngagedUser {
  id: string;
  actualUserId: string;
  sessions: number;
  lastActive: string;
  lastActiveTimestamp: string;
  engagement: 'high' | 'medium' | 'low';
  optedIn: boolean;
  displayName: string | null;
  email: string | null;
  totalDurationSeconds: number;
}

interface UsersData {
  users: EngagedUser[];
  totalUsers: number;
  optedInCount: number;
}

const ProviderAnalytics: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [, setUserRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Data states
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [insights, setInsights] = useState<AnalyticsInsights | null>(null);
  const [usersData, setUsersData] = useState<UsersData | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'opted_in' | 'high_engagement'>('all');

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return;

      if (!user) {
        router.push('/');
        return;
      }

      try {
        const role = await getUserRole(user.uid);
        setUserRole(role);

        if (role !== 'provider') {
          router.push('/dashboard/patient');
          return;
        }

        setLoading(false);

        // Load initial data
        loadMetrics();
        loadInsights();
        loadUsers('all');
      } catch (error) {
        console.error('Error checking provider access:', error);
        router.push('/dashboard/patient');
      }
    }

    checkAccess();
  }, [user, authLoading, router]);

  const loadMetrics = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/provider/analytics/metrics?provider_user_id=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        console.error('Failed to load metrics:', await response.text());
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const loadInsights = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/provider/analytics/insights?provider_user_id=${user.uid}`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      } else {
        console.error('Failed to load insights:', await response.text());
      }
    } catch (error) {
      console.error('Error loading insights:', error);
    }
  };

  const loadUsers = async (filter: string) => {
    if (!user) return;

    try {
      const response = await fetch(`/api/provider/analytics/users?provider_user_id=${user.uid}&filter=${filter}`);
      if (response.ok) {
        const data = await response.json();
        setUsersData(data);
      } else {
        console.error('Failed to load users:', await response.text());
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleFilterChange = (filter: 'all' | 'opted_in' | 'high_engagement') => {
    setUserFilter(filter);
    loadUsers(filter);
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-secondary)', paddingTop: '80px', paddingBottom: '80px' }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard/provider')}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Analytics & Insights
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your AI Preview performance and user engagement
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border mb-6">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'insights', label: 'Insights' },
                { id: 'users', label: 'Engaged Users' },
                { id: 'profile', label: 'Profile' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-6 py-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'overview' && (
                <OverviewTab metrics={metrics} onRefresh={loadMetrics} />
              )}
              {activeTab === 'insights' && (
                <InsightsTab insights={insights} onRefresh={loadInsights} />
              )}
              {activeTab === 'users' && (
                <UsersTab
                  usersData={usersData}
                  filter={userFilter}
                  onFilterChange={handleFilterChange}
                  providerUserId={user?.uid || ''}
                />
              )}
              {activeTab === 'profile' && (
                <ProfileTab />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Tab Components
interface OverviewTabProps {
  metrics: AnalyticsMetrics | null;
  onRefresh: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ metrics, onRefresh }) => {
  if (!metrics) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MetricCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
          label="Unique Users"
          value={metrics.uniqueUsers}
          trend={metrics.weeklyGrowth > 0 ? `+${metrics.weeklyGrowth.toFixed(1)}%` : `${metrics.weeklyGrowth.toFixed(1)}%`}
          trendPositive={metrics.weeklyGrowth >= 0}
        />
        <MetricCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          }
          label="Total Sessions"
          value={metrics.totalSessions}
          subtext={`${metrics.sessionsThisWeek} this week`}
        />
        <MetricCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          label="Contact Clicks"
          value={metrics.totalContactClicks}
          subtext={`${metrics.conversionRate.toFixed(1)}% conversion`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MetricCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="Avg Session Duration"
          value={metrics.avgSessionDuration}
        />
        <MetricCard
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
          label="Weekly Growth"
          value={`${metrics.weeklyGrowth >= 0 ? '+' : ''}${metrics.weeklyGrowth.toFixed(1)}%`}
          trendPositive={metrics.weeklyGrowth >= 0}
        />
      </div>

      <button
        onClick={onRefresh}
        className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
      >
        Refresh Data
      </button>
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: string;
  trendPositive?: boolean;
  subtext?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ icon, label, value, trend, trendPositive, subtext }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
          {icon}
        </div>
        {trend && (
          <span className={`text-sm font-medium ${trendPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
};

interface InsightsTabProps {
  insights: AnalyticsInsights | null;
  onRefresh: () => void;
}

const InsightsTab: React.FC<InsightsTabProps> = ({ insights }) => {
  if (!insights) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Common Topics */}
      {insights.commonTopics.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Common Discussion Topics
          </h3>
          {insights.commonTopics.map((topic, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{topic.topic}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {topic.count} sessions ({topic.percentage}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${topic.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {insights.commonTopics.length === 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Privacy Note:</strong> All conversation data is aggregated and anonymized. Topic insights will appear here as more users engage with your AI Preview.
          </p>
        </div>
      )}

      {/* Session Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Average Session Duration</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {insights.sessionAnalytics.avgDropoffPoint}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Peak Engagement Times</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {insights.sessionAnalytics.peakEngagementTimes}
          </p>
        </div>
      </div>
    </div>
  );
};

interface UsersTabProps {
  usersData: UsersData | null;
  filter: string;
  onFilterChange: (filter: 'all' | 'opted_in' | 'high_engagement') => void;
  providerUserId: string;
}

const UsersTab: React.FC<UsersTabProps> = ({ usersData, filter, onFilterChange }) => {
  const [, setSelectedUser] = useState<EngagedUser | null>(null);

  if (!usersData) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onFilterChange('all')}
          className={`px-3 py-1 text-sm rounded-lg ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          All Users ({usersData.totalUsers})
        </button>
        <button
          onClick={() => onFilterChange('opted_in')}
          className={`px-3 py-1 text-sm rounded-lg ${
            filter === 'opted_in'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Opted-In Only ({usersData.optedInCount})
        </button>
        <button
          onClick={() => onFilterChange('high_engagement')}
          className={`px-3 py-1 text-sm rounded-lg ${
            filter === 'high_engagement'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          High Engagement
        </button>
      </div>

      {/* User list */}
      {usersData.users.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No users found with current filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {usersData.users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition cursor-pointer"
              onClick={() => setSelectedUser(user)}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {user.optedIn && user.displayName ? user.displayName : user.id}
                    </p>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      user.engagement === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      user.engagement === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {user.engagement}
                    </span>
                    {user.optedIn && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                        Can Contact
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {user.sessions} sessions • Last active {user.lastActive}
                  </p>
                  {user.optedIn && user.email && (
                    <p className="text-sm text-gray-500 dark:text-gray-500">{user.email}</p>
                  )}
                </div>
              </div>
              <button
                disabled={!user.optedIn}
                className={`px-4 py-2 text-sm rounded-lg transition ${
                  user.optedIn
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (user.optedIn) {
                    alert('Messaging feature coming soon!');
                  }
                }}
              >
                {user.optedIn ? 'Send Message' : 'Not Opted In'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Privacy notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>Privacy First:</strong> You can only message users who have explicitly opted in to receive provider contact. User identities remain anonymous until they choose to share their information with you.
        </p>
      </div>
    </div>
  );
};

const ProfileTab: React.FC = () => {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          AI Preview Status
        </h3>
        <div className="flex items-center gap-3">
          <span className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium">
            Active
          </span>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your AI preview is currently available to users
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => router.push('/s2?skip=welcome')}
            className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-left"
          >
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Update Profile</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Edit your professional information</div>
            </div>
          </button>
          <button
            onClick={() => router.push('/chatbotV17?provider=true')}
            className="flex items-center gap-3 p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-left"
          >
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">Preview Your AI</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">See what users experience</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProviderAnalytics;
