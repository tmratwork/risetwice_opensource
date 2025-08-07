'use client';

import { useState, useRef } from 'react';
import { RefreshCw, ExternalLink, Settings } from 'lucide-react';
import QRCodeGenerator from './QRCodeGenerator';
import CircleShareButtons from './CircleShareButtons';
import CircleFlyer from './CircleFlyer';

interface AccessLink {
  id: string;
  access_token: string;
  usage_count: number;
  max_uses?: number;
  expires_at?: string;
  created_at: string;
}

interface CircleAccessLinkProps {
  circle: {
    id: string;
    name: string;
    display_name: string;
    description?: string;
    welcome_message?: string;
  };
  accessLink: AccessLink | null;
  onCreateLink: (options: { maxUses?: number; expiresAt?: string }) => void;
  onDeactivateLink: () => void;
  isLoading?: boolean;
}

export default function CircleAccessLink({
  circle,
  accessLink,
  onCreateLink,
  onDeactivateLink,
  isLoading = false,
}: CircleAccessLinkProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxUses, setMaxUses] = useState<number | undefined>();
  const [expiresIn, setExpiresIn] = useState<number | undefined>();
  const [showFlyer, setShowFlyer] = useState(false);
  
  const qrCodeRef = useRef<HTMLDivElement>(null);

  const joinUrl = accessLink 
    ? `${window.location.origin}/chatbotV16/community/circles/join/${accessLink.access_token}`
    : '';

  const handleCreateLink = () => {
    const options: { maxUses?: number; expiresAt?: string } = {};
    
    if (maxUses && maxUses > 0) {
      options.maxUses = maxUses;
    }
    
    if (expiresIn && expiresIn > 0) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresIn);
      options.expiresAt = expiresAt.toISOString();
    }
    
    onCreateLink(options);
  };

  const formatExpiryDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = accessLink?.expires_at && new Date(accessLink.expires_at) < new Date();
  const isMaxedOut = accessLink?.max_uses && accessLink.usage_count >= accessLink.max_uses;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Circle Access Link & QR Code
        </h3>

        {!accessLink ? (
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Create a shareable link and QR code for this circle. Students can scan the QR code or visit the link to request to join.
            </p>

            <div className="space-y-4">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                <Settings className="w-4 h-4" />
                Advanced Options
              </button>

              {showAdvanced && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Uses (Optional)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxUses || ''}
                      onChange={(e) => setMaxUses(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="Unlimited"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Limit how many people can use this link
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expires In (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={expiresIn || ''}
                      onChange={(e) => setExpiresIn(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="Never expires"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Link will stop working after this many days
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleCreateLink}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ExternalLink className="w-4 h-4" />
                {isLoading ? 'Creating...' : 'Generate Access Link'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Link Status */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-green-900">Active Access Link</h4>
                  <p className="text-sm text-green-700">
                    Used {accessLink.usage_count} time{accessLink.usage_count !== 1 ? 's' : ''}
                    {accessLink.max_uses && ` of ${accessLink.max_uses} max`}
                    {accessLink.expires_at && ` • Expires ${formatExpiryDate(accessLink.expires_at)}`}
                  </p>
                </div>
                <button
                  onClick={onDeactivateLink}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Deactivate
                </button>
              </div>

              {(isExpired || isMaxedOut) && (
                <div className="mt-2 text-sm text-red-600">
                  {isExpired && 'This link has expired.'}
                  {isMaxedOut && 'This link has reached its maximum uses.'}
                </div>
              )}
            </div>

            {/* QR Code and Link */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">QR Code</h4>
                <div ref={qrCodeRef}>
                  <QRCodeGenerator
                    value={joinUrl}
                    size={200}
                    className="mx-auto"
                  />
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Share Link</h4>
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <code className="text-sm text-gray-700 break-all">{joinUrl}</code>
                </div>

                <CircleShareButtons
                  joinUrl={joinUrl}
                  circleName={circle.display_name}
                  circleDescription={circle.description}
                  qrCodeRef={qrCodeRef}
                  onPrintFlyer={() => setShowFlyer(true)}
                />
              </div>
            </div>

            {/* Generate New Link */}
            <div className="border-t border-gray-200 pt-4">
              <button
                onClick={handleCreateLink}
                disabled={isLoading}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Generate New Link
              </button>
              <p className="text-xs text-gray-500 mt-1">
                This will deactivate the current link and create a new one
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Flyer Modal */}
      {showFlyer && accessLink && (
        <CircleFlyer
          circle={circle}
          joinUrl={joinUrl}
          qrCodeValue={joinUrl}
          onClose={() => setShowFlyer(false)}
        />
      )}
    </div>
  );
}