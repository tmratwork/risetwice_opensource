'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings, Users, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../../../../../../contexts/auth-context';
import CircleRequestQueue from '../../../components/CircleRequestQueue';
import CircleAccessLink from '../../../components/CircleAccessLink';

interface Circle {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  rules: string[];
  member_count: number;
  post_count: number;
  is_private: boolean;
  requires_approval: boolean;
  welcome_message?: string;
  join_questions?: string[];
  created_at: string;
}

interface AccessLink {
  id: string;
  access_token: string;
  usage_count: number;
  max_uses?: number;
  expires_at?: string;
  created_at: string;
}

interface JoinRequest {
  id: string;
  requester_id: string;
  message?: string;
  notification_email?: string;
  notification_phone?: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  answers?: string[];
}

export default function CircleAdminPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const circleId = params.circleId as string;

  const [circle, setCircle] = useState<Circle | null>(null);
  const [accessLink, setAccessLink] = useState<AccessLink | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'access-link' | 'settings'>('requests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Logging helper following project standards
  const logCircleAdmin = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_ADMIN_LOGS === 'true') {
      console.log(`[circle_admin] ${message}`, ...args);
    }
  };

  useEffect(() => {
    logCircleAdmin('Admin page useEffect running', { circleId, userId: user?.uid });
    if (user?.uid) {
      logCircleAdmin('User authenticated, fetching data...');
      fetchCircleData();
      fetchAccessLink();
      fetchJoinRequests();
    } else {
      logCircleAdmin('User not yet authenticated, waiting...');
    }
  }, [circleId, user?.uid]);

  const fetchCircleData = async () => {
    if (!user?.uid) {
      logCircleAdmin('No user available, cannot fetch circle data');
      return;
    }

    try {
      logCircleAdmin('Fetching circle data', { circleId, userId: user.uid });
      const response = await fetch(`/api/v16/community/circles/${circleId}?requesting_user_id=${user.uid}`);
      const data = await response.json();

      logCircleAdmin('Circle API response received', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load circle');
      }

      setCircle(data);
    } catch (err) {
      logCircleAdmin('❌ Error fetching circle data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load circle');
    }
  };

  const fetchAccessLink = async () => {
    try {
      logCircleAdmin('Fetching access link', { circleId });
      const response = await fetch(`/api/v16/community/circles/${circleId}/access-link`);
      const data = await response.json();

      logCircleAdmin('Access link API response received', { status: response.status, data });

      if (response.ok && data.accessLink) {
        setAccessLink(data.accessLink);
      }
    } catch (err) {
      logCircleAdmin('❌ Error fetching access link:', err);
    }
  };

  const fetchJoinRequests = async () => {
    if (!user?.uid) {
      logCircleAdmin('No user ID available for fetching join requests');
      return;
    }
    
    try {
      setLoading(true);
      logCircleAdmin('Fetching join requests', { circleId, userId: user.uid });
      const response = await fetch(
        `/api/v16/community/circles/${circleId}/join-requests?userId=${user.uid}&status=pending`
      );
      const data = await response.json();

      logCircleAdmin('Join requests API response received', { status: response.status, data });

      if (response.ok) {
        setJoinRequests(data.requests || []);
      }
    } catch (err) {
      logCircleAdmin('❌ Error fetching join requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccessLink = async (options: { maxUses?: number; expiresAt?: string }) => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/v16/community/circles/${circleId}/access-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          ...options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create access link');
      }

      setAccessLink(data.accessLink);
    } catch (err) {
      console.error('Error creating access link:', err);
      alert(err instanceof Error ? err.message : 'Failed to create access link');
    }
  };

  const handleDeactivateAccessLink = async () => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/v16/community/circles/${circleId}/access-link`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deactivate access link');
      }

      setAccessLink(null);
    } catch (err) {
      console.error('Error deactivating access link:', err);
      alert(err instanceof Error ? err.message : 'Failed to deactivate access link');
    }
  };

  const handleApproveRequest = async (
    requestId: string, 
    options: {
      adminResponse?: string;
      notificationMethod: 'email' | 'sms' | 'none';
      adminNotes?: string;
    }
  ) => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/v16/community/circles/${circleId}/join-requests`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          requestId,
          decision: 'approved',
          ...options,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve request');
      }

      await fetchJoinRequests();
    } catch (err) {
      console.error('Error approving request:', err);
      alert(err instanceof Error ? err.message : 'Failed to approve request');
    }
  };

  const handleDenyRequest = async (
    requestId: string, 
    options: {
      adminResponse?: string;
      notificationMethod: 'email' | 'sms' | 'none';
      adminNotes?: string;
    }
  ) => {
    if (!user?.uid) return;
    
    try {
      const response = await fetch(`/api/v16/community/circles/${circleId}/join-requests`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          requestId,
          decision: 'denied',
          ...options,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to deny request');
      }

      await fetchJoinRequests();
    } catch (err) {
      console.error('Error denying request:', err);
      alert(err instanceof Error ? err.message : 'Failed to deny request');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-lg font-semibold mb-2">Authentication Required</div>
          <div className="text-gray-600 mb-4">You must be logged in to access the admin panel.</div>
          <button
            onClick={() => router.push('/chatbotV16/community/circles')}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Circles
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-lg font-semibold mb-2">Error</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={() => router.push('/chatbotV16/community/circles')}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Circles
          </button>
        </div>
      </div>
    );
  }

  if (!circle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto pt-16 pb-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/chatbotV16/community?circle_id=${circleId}`)}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Circle
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Manage {circle.display_name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {circle.member_count} members
                </span>
                <span>{circle.post_count} posts</span>
                {circle.is_private && <span>Private Circle</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Join Requests
              {joinRequests.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {joinRequests.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => setActiveTab('access-link')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'access-link'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LinkIcon className="w-4 h-4 inline mr-1" />
              QR Code & Link
            </button>
            
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-1" />
              Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'requests' && (
            <CircleRequestQueue
              requests={joinRequests}
              circle={circle}
              onApproveRequest={handleApproveRequest}
              onDenyRequest={handleDenyRequest}
              isLoading={loading}
              onRefresh={fetchJoinRequests}
            />
          )}

          {activeTab === 'access-link' && (
            <CircleAccessLink
              circle={circle}
              accessLink={accessLink}
              onCreateLink={handleCreateAccessLink}
              onDeactivateLink={handleDeactivateAccessLink}
            />
          )}

          {activeTab === 'settings' && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Circle Settings</h3>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">Current Settings</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div>Privacy: {circle.is_private ? 'Private' : 'Public'}</div>
                    <div>Approval Required: {circle.requires_approval ? 'Yes' : 'No'}</div>
                    <div>Member Count: {circle.member_count}</div>
                    <div>Post Count: {circle.post_count}</div>
                    <div>Created: {new Date(circle.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                
                {circle.welcome_message && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">Welcome Message</h4>
                    <p className="text-blue-800 text-sm italic">&quot;{circle.welcome_message}&quot;</p>
                  </div>
                )}

                {circle.join_questions && circle.join_questions.length > 0 && (
                  <div className="bg-yellow-50 rounded-lg p-4">
                    <h4 className="font-medium text-yellow-900 mb-2">Join Questions</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800">
                      {circle.join_questions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  Circle settings can be modified through the main circle management interface.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}