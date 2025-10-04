'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Provider {
  id: string;
  full_name: string;
  title: string;
  profile_photo_url: string | null;
}

export default function ProviderPhotosPage() {
  const { isAdmin, loading: authLoading, error: authError } = useAdminAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadMessages, setUploadMessages] = useState<Record<string, { type: 'success' | 'error', message: string }>>({});

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/providers');

      if (!response.ok) {
        throw new Error('Failed to fetch providers');
      }

      const data = await response.json();

      if (data.success) {
        setProviders(data.providers);
      } else {
        throw new Error(data.error || 'Failed to fetch providers');
      }
    } catch (err) {
      console.error('[ProviderPhotos] Error fetching providers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchProviders();
    }
  }, [isAdmin, fetchProviders]);

  // Handle file upload
  const handleFileUpload = async (providerId: string, file: File) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setUploadMessages({
        ...uploadMessages,
        [providerId]: { type: 'error', message: 'Invalid file type. Please upload JPG, PNG, or WebP.' }
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadMessages({
        ...uploadMessages,
        [providerId]: { type: 'error', message: 'File too large. Maximum size is 5MB.' }
      });
      return;
    }

    try {
      setUploadingId(providerId);
      setUploadProgress({ ...uploadProgress, [providerId]: 0 });
      setUploadMessages({ ...uploadMessages, [providerId]: { type: 'success', message: 'Uploading...' } });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('providerId', providerId);

      const response = await fetch('/api/admin/upload-provider-photo', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadMessages({
          ...uploadMessages,
          [providerId]: { type: 'success', message: 'Photo uploaded successfully!' }
        });

        // Update provider in local state
        setProviders(prev =>
          prev.map(p => p.id === providerId ? { ...p, profile_photo_url: data.photoUrl } : p)
        );

        // Clear message after 3 seconds
        setTimeout(() => {
          setUploadMessages(prev => {
            const newMessages = { ...prev };
            delete newMessages[providerId];
            return newMessages;
          });
        }, 3000);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('[ProviderPhotos] Upload error:', err);
      setUploadMessages({
        ...uploadMessages,
        [providerId]: {
          type: 'error',
          message: err instanceof Error ? err.message : 'Upload failed'
        }
      });
    } finally {
      setUploadingId(null);
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[providerId];
        return newProgress;
      });
    }
  };

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Verifying admin access...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if there was an issue checking permissions
  if (authError) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">
                Authentication Error
              </h2>
              <p className="text-red-600 dark:text-red-300 mb-4">{authError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied for non-admin users
  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8">
              <div className="mb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                  <ExternalLink className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-200 mb-3">
                Admin Access Required
              </h2>
              <p className="text-blue-600 dark:text-blue-300 mb-2">
                This page requires administrator privileges.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pt-24">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Provider Photos</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Upload profile photos for therapist providers
            </p>
          </div>
          <Link
            href="/admin/s2"
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            <span>Back to S2 Admin</span>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading providers...</p>
          </div>
        </div>
      )}

      {/* Provider Grid */}
      {!loading && providers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
            >
              {/* Provider Info */}
              <div className="mb-4">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-1">
                  {provider.full_name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{provider.title}</p>
              </div>

              {/* Current Photo */}
              <div className="mb-4">
                {provider.profile_photo_url ? (
                  <img
                    src={provider.profile_photo_url}
                    alt={provider.full_name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <p className="text-gray-400 dark:text-gray-500">No photo</p>
                  </div>
                )}
              </div>

              {/* Upload Form */}
              <div>
                <label
                  htmlFor={`file-${provider.id}`}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Upload New Photo
                </label>
                <input
                  id={`file-${provider.id}`}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(provider.id, file);
                    }
                  }}
                  disabled={uploadingId === provider.id}
                  className="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  JPG, PNG or WebP (Max 5MB)
                </p>
              </div>

              {/* Upload Progress */}
              {uploadingId === provider.id && uploadProgress[provider.id] !== undefined && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress[provider.id]}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Upload Messages */}
              {uploadMessages[provider.id] && (
                <div
                  className={`mt-3 p-2 rounded-lg text-sm ${
                    uploadMessages[provider.id].type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                      : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                  }`}
                >
                  {uploadMessages[provider.id].message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && providers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No providers found</p>
        </div>
      )}
    </div>
  );
}
