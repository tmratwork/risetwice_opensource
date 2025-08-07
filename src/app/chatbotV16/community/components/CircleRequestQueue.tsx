'use client';

import { useState } from 'react';
import { Users, Clock, CheckCircle, XCircle, Filter } from 'lucide-react';
import CircleJoinRequestCard from './CircleJoinRequestCard';

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

interface CircleRequestQueueProps {
  requests: JoinRequest[];
  circle: {
    id: string;
    name: string;
    display_name: string;
    join_questions?: string[];
  };
  onApproveRequest: (requestId: string, options: {
    adminResponse?: string;
    notificationMethod: 'email' | 'sms' | 'none';
    adminNotes?: string;
  }) => Promise<void>;
  onDenyRequest: (requestId: string, options: {
    adminResponse?: string;
    notificationMethod: 'email' | 'sms' | 'none';
    adminNotes?: string;
  }) => Promise<void>;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export default function CircleRequestQueue({
  requests,
  circle,
  onApproveRequest,
  onDenyRequest,
  isLoading = false,
  onRefresh,
}: CircleRequestQueueProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'denied'>('pending');
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set());

  const filteredRequests = requests.filter(request => {
    if (statusFilter === 'all') return true;
    return request.status === statusFilter;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;
  const deniedCount = requests.filter(r => r.status === 'denied').length;

  const handleApprove = async (requestId: string, options: {
    adminResponse?: string;
    notificationMethod: 'email' | 'sms' | 'none';
    adminNotes?: string;
  }) => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    try {
      await onApproveRequest(requestId, options);
      onRefresh?.();
    } finally {
      setProcessingRequests(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleDeny = async (requestId: string, options: {
    adminResponse?: string;
    notificationMethod: 'email' | 'sms' | 'none';
    adminNotes?: string;
  }) => {
    setProcessingRequests(prev => new Set(prev).add(requestId));
    try {
      await onDenyRequest(requestId, options);
      onRefresh?.();
    } finally {
      setProcessingRequests(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Join Requests</h2>
          <p className="text-gray-600 text-sm">
            Manage requests to join {circle.display_name}
          </p>
        </div>
        
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-2 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{pendingCount}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{approvedCount}</div>
              <div className="text-sm text-gray-600">Approved</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{deniedCount}</div>
              <div className="text-sm text-gray-600">Denied</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-gray-900">{requests.length}</div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filter:</span>
        </div>
        
        <div className="flex items-center gap-2">
          {[
            { value: 'pending', label: 'Pending', count: pendingCount },
            { value: 'approved', label: 'Approved', count: approvedCount },
            { value: 'denied', label: 'Denied', count: deniedCount },
            { value: 'all', label: 'All', count: requests.length },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value as 'pending' | 'approved' | 'denied' | 'all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === filter.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Loading requests...</div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500">
              {statusFilter === 'pending' 
                ? 'No pending requests'
                : statusFilter === 'all'
                ? 'No requests yet'
                : `No ${statusFilter} requests`
              }
            </div>
            {statusFilter === 'pending' && requests.length > 0 && (
              <button
                onClick={() => setStatusFilter('all')}
                className="text-blue-600 hover:text-blue-700 text-sm mt-2"
              >
                View all requests
              </button>
            )}
          </div>
        ) : (
          filteredRequests.map((request) => (
            <CircleJoinRequestCard
              key={request.id}
              request={request}
              circle={circle}
              onApprove={handleApprove}
              onDeny={handleDeny}
              isProcessing={processingRequests.has(request.id)}
            />
          ))
        )}
      </div>

      {/* Priority Note */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <div className="text-sm text-yellow-800">
              <span className="font-medium">
                {pendingCount} request{pendingCount !== 1 ? 's' : ''} awaiting your review.
              </span>
              <span className="ml-1">
                Students may be checking back to see if their request status has changed.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}