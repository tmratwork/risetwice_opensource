'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import NotificationPreferences from './NotificationPreferences';

interface CircleJoinRequestProps {
  circle: {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    welcome_message?: string;
    join_questions?: string[];
  };
  accessToken?: string;
  onSubmit: (data: {
    message?: string;
    notificationEmail?: string;
    notificationPhone?: string;
    answers?: string[];
    accessToken?: string;
  }) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export default function CircleJoinRequest({
  circle,
  accessToken,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CircleJoinRequestProps) {
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState<string[]>(
    circle.join_questions?.map(() => '') || []
  );
  const [notificationPrefs, setNotificationPrefs] = useState({
    wantsNotification: false,
    email: '',
    phone: '',
  });

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: {
      message?: string;
      accessToken?: string;
      notificationEmail?: string;
      notificationPhone?: string;
      answers?: string[];
    } = {
      message: message.trim() || undefined,
      accessToken,
    };

    if (notificationPrefs.wantsNotification) {
      if (notificationPrefs.email) {
        data.notificationEmail = notificationPrefs.email;
      }
      if (notificationPrefs.phone) {
        data.notificationPhone = notificationPrefs.phone;
      }
    }

    if (answers.some(answer => answer.trim())) {
      data.answers = answers.filter(answer => answer.trim());
    }

    await onSubmit(data);
  };

  const canSubmit = !isSubmitting && (
    !notificationPrefs.wantsNotification || 
    notificationPrefs.email || 
    notificationPrefs.phone
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Request to Join {circle.display_name}
            </h3>
            {circle.description && (
              <p className="text-gray-600 mt-2">{circle.description}</p>
            )}
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Welcome Message */}
        {circle.welcome_message && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">From the Circle Admin:</h4>
            <p className="text-blue-800 italic">&quot;{circle.welcome_message}&quot;</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Custom Questions */}
          {circle.join_questions && circle.join_questions.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Questions from the admin:</h4>
              {circle.join_questions.map((question, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {question}
                  </label>
                  <textarea
                    value={answers[index]}
                    onChange={(e) => handleAnswerChange(index, e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Your answer..."
                  />
                </div>
              ))}
            </div>
          )}

          {/* General Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Why would you like to join this circle? (Optional)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              This helps the admin understand your interest in joining
            </p>
          </div>

          {/* Notification Preferences */}
          <NotificationPreferences
            onPreferencesChange={(prefs) => setNotificationPrefs({
              wantsNotification: prefs.wantsNotification,
              email: prefs.email || '',
              phone: prefs.phone || '',
            })}
          />

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4">
            <p className="text-xs text-gray-500">
              Your request will be reviewed by the circle administrator. 
              All information is kept confidential.
            </p>
            
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>

          {/* Validation Error */}
          {notificationPrefs.wantsNotification && !notificationPrefs.email && !notificationPrefs.phone && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              Please provide either an email address or phone number to receive notifications.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}