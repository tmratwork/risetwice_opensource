'use client';

import { useState } from 'react';
import { Check, X, Mail, MessageSquare, Clock, User } from 'lucide-react';

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

interface CircleJoinRequestCardProps {
  request: JoinRequest;
  circle: {
    name: string;
    display_name: string;
    join_questions?: string[];
  };
  onApprove: (requestId: string, options: {
    adminResponse?: string;
    notificationMethod: 'email' | 'sms' | 'none';
    adminNotes?: string;
  }) => Promise<void>;
  onDeny: (requestId: string, options: {
    adminResponse?: string;
    notificationMethod: 'email' | 'sms' | 'none';
    adminNotes?: string;
  }) => Promise<void>;
  isProcessing?: boolean;
}

export default function CircleJoinRequestCard({
  request,
  circle,
  onApprove,
  onDeny,
  isProcessing = false,
}: CircleJoinRequestCardProps) {
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [decision, setDecision] = useState<'approve' | 'deny' | null>(null);
  const [adminResponse, setAdminResponse] = useState('');
  const [notificationMethod, setNotificationMethod] = useState<'email' | 'sms' | 'none'>('none');
  const [adminNotes, setAdminNotes] = useState('');

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDecisionClick = (newDecision: 'approve' | 'deny') => {
    setDecision(newDecision);
    setShowDecisionForm(true);
    
    // Auto-select notification method if user provided contact info
    if (request.notification_email && !request.notification_phone) {
      setNotificationMethod('email');
    } else if (!request.notification_email && request.notification_phone) {
      setNotificationMethod('sms');
    } else if (request.notification_email && request.notification_phone) {
      setNotificationMethod('email'); // Default to email if both available
    }
  };

  const handleSubmitDecision = async () => {
    if (!decision) return;

    const options = {
      adminResponse: adminResponse.trim() || undefined,
      notificationMethod,
      adminNotes: adminNotes.trim() || undefined,
    };

    if (decision === 'approve') {
      await onApprove(request.id, options);
    } else {
      await onDeny(request.id, options);
    }

    // Reset form
    setShowDecisionForm(false);
    setDecision(null);
    setAdminResponse('');
    setNotificationMethod('none');
    setAdminNotes('');
  };

  const getNotificationOptions = () => {
    const options = [{ value: 'none', label: 'No notification' }];
    
    if (request.notification_email) {
      options.push({ value: 'email', label: `Email (${request.notification_email})` });
    }
    
    if (request.notification_phone) {
      options.push({ value: 'sms', label: `Text message (${request.notification_phone})` });
    }
    
    return options;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">
              User {request.requester_id.slice(-8)}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              {formatDate(request.created_at)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {request.notification_email && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </div>
          )}
          {request.notification_phone && (
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <MessageSquare className="w-4 h-4" />
              <span>SMS</span>
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      {request.message && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-900 mb-1">Message:</h4>
          <p className="text-gray-700 text-sm">{request.message}</p>
        </div>
      )}

      {/* Answers to Custom Questions */}
      {request.answers && request.answers.length > 0 && circle.join_questions && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Responses to your questions:</h4>
          {request.answers.map((answer, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-3">
              <div className="text-sm font-medium text-gray-700 mb-1">
                {circle.join_questions?.[index] || `Question ${index + 1}`}
              </div>
              <div className="text-sm text-gray-600">{answer}</div>
            </div>
          ))}
        </div>
      )}

      {/* Contact Information */}
      {(request.notification_email || request.notification_phone) && (
        <div className="bg-blue-50 rounded-lg p-3">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Contact Information:</h4>
          <div className="space-y-1 text-sm">
            {request.notification_email && (
              <div className="flex items-center gap-2 text-blue-700">
                <Mail className="w-4 h-4" />
                {request.notification_email}
              </div>
            )}
            {request.notification_phone && (
              <div className="flex items-center gap-2 text-blue-700">
                <MessageSquare className="w-4 h-4" />
                {request.notification_phone}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {!showDecisionForm && request.status === 'pending' && (
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => handleDecisionClick('approve')}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Approve
          </button>
          
          <button
            onClick={() => handleDecisionClick('deny')}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
            Deny
          </button>
        </div>
      )}

      {/* Decision Form */}
      {showDecisionForm && decision && (
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <h4 className="font-medium text-gray-900">
            {decision === 'approve' ? 'Approve Request' : 'Deny Request'}
          </h4>

          {/* Notification Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How to notify the user:
            </label>
            <div className="space-y-2">
              {getNotificationOptions().map((option) => (
                <label key={option.value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="notification-method"
                    value={option.value}
                    checked={notificationMethod === option.value}
                    onChange={(e) => setNotificationMethod(e.target.value as 'email' | 'sms' | 'none')}
                    className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Response Message */}
          {notificationMethod !== 'none' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message to user (Optional):
              </label>
              <textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                rows={3}
                placeholder={decision === 'approve' ? 
                  "Welcome to the circle! Looking forward to having you join our community." :
                  "Thank you for your interest. Unfortunately, we're unable to accept your request at this time."
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          )}

          {/* Admin Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Private notes (for your records):
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this decision..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmitDecision}
              disabled={isProcessing}
              className={`px-4 py-2 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                decision === 'approve' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isProcessing ? 'Processing...' : `Confirm ${decision === 'approve' ? 'Approval' : 'Denial'}`}
            </button>
            
            <button
              onClick={() => setShowDecisionForm(false)}
              disabled={isProcessing}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Status Badge */}
      {request.status !== 'pending' && (
        <div className="pt-2">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            request.status === 'approved' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {request.status === 'approved' ? 'Approved' : 'Denied'}
          </span>
        </div>
      )}
    </div>
  );
}