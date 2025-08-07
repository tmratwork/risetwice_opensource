// src/components/SmartSendDialog.tsx

"use client";

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useWebRTCStore } from '@/stores/webrtc-store';

interface SmartSendDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SmartSendDialog({ isOpen, onClose }: SmartSendDialogProps) {
  const smartSendEnabled = useWebRTCStore(state => state.smartSendEnabled);
  const setSmartSendEnabled = useWebRTCStore(state => state.setSmartSendEnabled);

  const [enabled, setEnabled] = useState(smartSendEnabled);
  const [delaySeconds, setDelaySeconds] = useState(2);

  // Smart Send logging helper
  const logSmartSend = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_SMART_SEND_LOGS === 'true') {
      console.log(`[smart_send] ${message}`, ...args);
    }
  };

  // Load delay from localStorage on mount
  useEffect(() => {
    const savedDelay = localStorage.getItem('smartSendDelay');
    if (savedDelay) {
      setDelaySeconds(Number(savedDelay));
    }
  }, []);

  // Sync with store state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setEnabled(smartSendEnabled);
    }
  }, [isOpen, smartSendEnabled]);

  const handleSave = () => {
    logSmartSend('💾 Dialog: Save button clicked', {
      oldEnabled: smartSendEnabled,
      newEnabled: enabled,
      oldDelay: Number(localStorage.getItem('smartSendDelay') || '2'),
      newDelay: delaySeconds
    });

    setSmartSendEnabled(enabled);
    localStorage.setItem('smartSendDelay', delaySeconds.toString());
    
    logSmartSend('✅ Dialog: Settings saved successfully', {
      smartSendEnabled: enabled,
      delaySeconds
    });
    
    onClose();
  };

  const handleCancel = () => {
    logSmartSend('❌ Dialog: Cancel button clicked - reverting changes', {
      originalEnabled: smartSendEnabled,
      discardedEnabled: enabled
    });
    
    setEnabled(smartSendEnabled); // Reset to original value
    onClose();
  };

  const handleEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleEscape}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Smart Sending Settings
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Explanation */}
          <div className="text-sm text-gray-600 dark:text-gray-300">
            <p className="mb-3">
              Smart Sending combines your messages fragments before sending to AI.
              Instead of sending each line immediately after you press Enter, the app sends only after you press Enter and are not typing.
            </p>
            <p className="mb-3">
              <strong>Example:</strong> Type &quot;I am&quot; → press Enter → type &quot;thinking of blue&quot; → press Enter.
              After a delay, app sends the complete message: &quot;I am thinking of blue&quot;
            </p>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center space-x-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                Enable Smart Sending
              </span>
            </label>
          </div>

          {/* Delay Setting */}
          {enabled && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Delay before sending (seconds)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white w-12 text-center">
                  {delaySeconds}s
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1s</span>
                <span>5s</span>
              </div>
            </div>
          )}

          {/* Current Status */}
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>Current Status:</strong> {enabled ? `Enabled (${delaySeconds}s delay)` : 'Disabled'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:bg-gray-600 dark:text-gray-200 dark:border-gray-500 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}