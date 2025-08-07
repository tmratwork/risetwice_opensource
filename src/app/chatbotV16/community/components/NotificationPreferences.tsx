'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Info } from 'lucide-react';

interface NotificationPreferencesProps {
  onPreferencesChange: (preferences: {
    wantsNotification: boolean;
    email?: string;
    phone?: string;
  }) => void;
  initialPreferences?: {
    wantsNotification: boolean;
    email?: string;
    phone?: string;
  };
}

export default function NotificationPreferences({
  onPreferencesChange,
  initialPreferences,
}: NotificationPreferencesProps) {
  const [wantsNotification, setWantsNotification] = useState(
    initialPreferences?.wantsNotification ?? false
  );
  const [email, setEmail] = useState(initialPreferences?.email ?? '');
  const [phone, setPhone] = useState(initialPreferences?.phone ?? '');

  const handleWantsNotificationChange = (wants: boolean) => {
    setWantsNotification(wants);
    onPreferencesChange({
      wantsNotification: wants,
      email: wants ? email : undefined,
      phone: wants ? phone : undefined,
    });
  };

  const handleEmailChange = (newEmail: string) => {
    setEmail(newEmail);
    onPreferencesChange({
      wantsNotification,
      email: newEmail || undefined,
      phone: phone || undefined,
    });
  };

  const handlePhoneChange = (newPhone: string) => {
    setPhone(newPhone);
    onPreferencesChange({
      wantsNotification,
      email: email || undefined,
      phone: newPhone || undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">How would you like to be notified about your request?</h4>
        
        {/* Notification Choice */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="notification-choice"
              checked={wantsNotification}
              onChange={() => handleWantsNotificationChange(true)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">Send me a notification</div>
              <div className="text-sm text-gray-600">
                I&apos;d like to receive an email or text when my request is reviewed
              </div>
            </div>
          </label>

          {/* Contact Information - moved here to appear after "Send me a notification" */}
          {wantsNotification && (
            <div className="ml-7 space-y-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">
                Provide at least one way to contact you (both are optional):
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <Mail className="w-4 h-4" />
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <MessageSquare className="w-4 h-4" />
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For text message notifications
                  </p>
                </div>
              </div>
            </div>
          )}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="notification-choice"
              checked={!wantsNotification}
              onChange={() => handleWantsNotificationChange(false)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div>
              <div className="font-medium text-gray-900">No notification needed</div>
              <div className="text-sm text-gray-600">
                I&apos;ll check back to see if I&apos;ve been accepted
              </div>
            </div>
          </label>
        </div>

        {/* Guidance for no notification */}
        {!wantsNotification && (
          <div className="ml-7 p-4 bg-yellow-50 rounded-lg">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">How to check your request status:</p>
                <p>
                  Since you chose not to receive notifications, please revisit this page later to see if the 
                  <span className="font-semibold"> &quot;Join&quot; </span>
                  button has changed to 
                  <span className="font-semibold"> &quot;Enter&quot;</span>, which means you&apos;ve been accepted!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}