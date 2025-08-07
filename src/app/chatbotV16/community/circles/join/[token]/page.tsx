'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Users, Shield, Clock } from 'lucide-react';
import CircleJoinRequest from '../../../components/CircleJoinRequest';

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

interface AccessLinkData {
  circle: Circle;
  accessToken: string;
  usageCount: number;
  maxUses?: number;
  expiresAt?: string;
}

export default function CircleJoinPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [accessLinkData, setAccessLinkData] = useState<AccessLinkData | null>(null);
  const [userRequest, setUserRequest] = useState<{
    id: string;
    status: 'pending' | 'approved' | 'denied';
    message?: string;
    notification_email?: string;
    notification_phone?: string;
    created_at: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // For demo purposes, using a mock user ID
  // In production, this would come from your auth system
  const userId = 'demo-user-' + Math.random().toString(36).substr(2, 9);

  const fetchAccessLinkData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v16/community/circles/access/${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load circle information');
      }

      setAccessLinkData(data);

      // Check if user already has a request for this circle
      const requestResponse = await fetch(
        `/api/v16/community/circles/${data.circle.id}/join-request?userId=${userId}`
      );
      
      if (requestResponse.ok) {
        const requestData = await requestResponse.json();
        setUserRequest(requestData.request);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessLinkData();
  }, [token]);

  const handleJoinRequest = async (requestData: {
    message?: string;
    notificationEmail?: string;
    notificationPhone?: string;
    answers?: string[];
    accessToken?: string;
  }) => {
    if (!accessLinkData) return;

    try {
      setSubmitting(true);
      const response = await fetch(`/api/v16/community/circles/access/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...requestData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit join request');
      }

      setSuccess(true);
      setUserRequest(data.joinRequest);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const getRequestStatus = () => {
    if (!userRequest) return null;
    
    switch (userRequest.status) {
      case 'pending':
        return {
          message: 'Your request is pending review',
          description: 'The circle admin will review your request and get back to you.',
          color: 'yellow',
        };
      case 'approved':
        return {
          message: 'Request approved! Welcome to the circle',
          description: 'You can now participate in this circle.',
          color: 'green',
        };
      case 'denied':
        return {
          message: 'Request was not approved',
          description: 'You can submit a new request if you\'d like.',
          color: 'red',
        };
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading circle information...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-lg font-semibold mb-2">Unable to Load Circle</div>
          <div className="text-gray-600 mb-4">{error}</div>
          <button
            onClick={() => router.push('/chatbotV16/community/circles')}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Other Circles
          </button>
        </div>
      </div>
    );
  }

  if (!accessLinkData) {
    return null;
  }

  const { circle } = accessLinkData;
  const requestStatus = getRequestStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/chatbotV16/community/circles')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Browse Other Circles
          </button>
          
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold text-gray-900">{circle.display_name}</h1>
            
            {circle.description && (
              <p className="text-lg text-gray-600 leading-relaxed">{circle.description}</p>
            )}

            {/* Circle Stats */}
            <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {circle.member_count} member{circle.member_count !== 1 ? 's' : ''}
              </div>
              
              {circle.is_private && (
                <div className="flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  Private Circle
                </div>
              )}
              
              {circle.requires_approval && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Approval Required
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Circle Rules */}
        {circle.rules && circle.rules.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Circle Guidelines</h3>
            <ul className="space-y-2">
              {circle.rules.map((rule, index) => (
                <li key={index} className="text-gray-700 text-sm flex items-start gap-2">
                  <span className="text-blue-600 font-medium">{index + 1}.</span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="text-green-800 font-semibold mb-2">Request Submitted Successfully!</div>
            <div className="text-green-700 text-sm">
              Your request to join {circle.display_name} has been submitted. 
              {userRequest?.notification_email || userRequest?.notification_phone
                ? ' You\'ll be notified when it\'s reviewed.'
                : ' Please check back later to see if your request has been approved.'
              }
            </div>
          </div>
        )}

        {/* Request Status */}
        {requestStatus && !success && (
          <div className={`border rounded-lg p-6 mb-6 ${
            requestStatus.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
            requestStatus.color === 'green' ? 'bg-green-50 border-green-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className={`font-semibold mb-2 ${
              requestStatus.color === 'yellow' ? 'text-yellow-800' :
              requestStatus.color === 'green' ? 'text-green-800' :
              'text-red-800'
            }`}>
              {requestStatus.message}
            </div>
            <div className={`text-sm ${
              requestStatus.color === 'yellow' ? 'text-yellow-700' :
              requestStatus.color === 'green' ? 'text-green-700' :
              'text-red-700'
            }`}>
              {requestStatus.description}
            </div>
          </div>
        )}

        {/* Join Request Form */}
        {!userRequest && !success && (
          <CircleJoinRequest
            circle={circle}
            accessToken={accessLinkData.accessToken}
            onSubmit={handleJoinRequest}
            isSubmitting={submitting}
          />
        )}

        {/* Resubmit Option for Denied Requests */}
        {userRequest?.status === 'denied' && !success && (
          <div className="space-y-4">
            <div className="text-center">
              <button
                onClick={() => setUserRequest(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Submit New Request
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8 p-4 bg-white rounded-lg border border-gray-200">
          <p>
            This is a private support circle. Your request will be reviewed by the circle administrator.
            All conversations are confidential and supportive.
          </p>
        </div>
      </div>
    </div>
  );
}