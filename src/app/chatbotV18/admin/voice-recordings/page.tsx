'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { ArrowLeft, Play, Pause, Volume2, Download } from 'lucide-react';
import Link from 'next/link';
import { convertWebMToMp3, isAudioConversionSupported } from '@/utils/audio-converter';

interface AudioChunk {
  id: string;
  conversation_id: string;
  chunk_index: number;
  storage_path: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  status: string;
  signed_url: string | null;
  public_url?: string | null;
}

interface ConversationSummary {
  conversation_id: string;
  created_at: string;
  chunk_count: number;
  combined_audio_url?: string | null;
}

export default function VoiceRecordingsPage() {
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [combiningConversationId, setCombiningConversationId] = useState<string | null>(null);
  const [combineErrors, setCombineErrors] = useState<Map<string, string>>(new Map());
  const [combinedUrls, setCombinedUrls] = useState<Map<string, string>>(new Map());
  const [convertingConversationId, setConvertingConversationId] = useState<string | null>(null);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isConversionSupported] = useState(() => isAudioConversionSupported());

  // Fetch all conversations with voice recordings
  useEffect(() => {
    async function fetchConversations() {
      try {
        const response = await fetch('/api/v18/voice-recordings');
        const data = await response.json();

        if (data.success) {
          setConversations(data.conversations);

          // Pre-populate combined URLs for conversations that already have them
          const newCombinedUrls = new Map<string, string>();
          data.conversations.forEach((conv: ConversationSummary) => {
            if (conv.combined_audio_url) {
              newCombinedUrls.set(conv.conversation_id, conv.combined_audio_url);
            }
          });
          if (newCombinedUrls.size > 0) {
            setCombinedUrls(newCombinedUrls);
            console.log('[v18_voice_admin] Pre-loaded combined URLs for', newCombinedUrls.size, 'conversations');
          }
        } else {
          console.error('Failed to fetch conversations:', data.error);
        }
      } catch (error) {
        console.error('Error fetching conversations:', error);
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      fetchConversations();
    }
  }, [isAdmin]);

  const handleCombineAudio = async (conversationId: string) => {
    try {
      setCombiningConversationId(conversationId);

      // Clear any previous error for this conversation
      const newErrors = new Map(combineErrors);
      newErrors.delete(conversationId);
      setCombineErrors(newErrors);

      console.log(`[v18_voice_admin] Combining audio for conversation: ${conversationId}`);

      const response = await fetch('/api/v18/voice-combine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[v18_voice_admin] ✅ Audio combined successfully:`, result);

      // Store combined URL for this conversation
      const newUrls = new Map(combinedUrls);
      newUrls.set(conversationId, result.combined_audio_url);
      setCombinedUrls(newUrls);

    } catch (error) {
      console.error('[v18_voice_admin] Audio combination failed:', error);
      const newErrors = new Map(combineErrors);
      newErrors.set(conversationId, error instanceof Error ? error.message : 'Failed to combine audio');
      setCombineErrors(newErrors);
    } finally {
      setCombiningConversationId(null);
    }
  };

  const handleDownloadMP3 = async (conversationId: string, combinedUrl: string) => {
    try {
      setConvertingConversationId(conversationId);
      setConversionProgress(0);

      const filename = `v18-recording-${conversationId.slice(0, 8)}`;
      await convertWebMToMp3(combinedUrl, filename, (progress) => {
        setConversionProgress(progress);
      });

      console.log('[v18_voice_admin] ✅ MP3 download completed');
    } catch (error) {
      console.error('[v18_voice_admin] Conversion failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to convert audio');
    } finally {
      setConvertingConversationId(null);
      setConversionProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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

  if (!isAdmin) {
    return (
      <div className="max-w-6xl mx-auto p-6 pt-24">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-semibold text-blue-800 dark:text-blue-200 mb-3">
            Admin Access Required
          </h2>
          <p className="text-blue-600 dark:text-blue-300">
            This page requires administrator privileges.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 pt-24 pb-24 overflow-y-auto min-h-screen">
      <div className="mb-6">
        <Link
          href="/chatbotV18/admin"
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft size={20} />
          <span>Back to admin dashboard</span>
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-2">V18 Voice Recordings</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Browse and play voice recordings from V18 chatbot conversations
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No voice recordings found yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conversations.map((conversation) => {
            const conversationId = conversation.conversation_id;
            const isCombining = combiningConversationId === conversationId;
            const isConverting = convertingConversationId === conversationId;
            const combinedUrl = combinedUrls.get(conversationId);
            const error = combineErrors.get(conversationId);

            return (
              <div
                key={conversationId}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Conversation ID: {conversationId.slice(0, 8)}...
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{conversation.chunk_count} audio chunks</span>
                      <span>•</span>
                      <span>{formatDate(conversation.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center space-x-3">
                  {!combinedUrl ? (
                    <button
                      onClick={() => handleCombineAudio(conversationId)}
                      disabled={isCombining}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        isCombining
                          ? 'bg-gray-400 cursor-not-allowed text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isCombining ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Combining...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={16} />
                          <span>Combine Chunks</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-lg text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Combined</span>
                      </div>

                      {isConversionSupported && (
                        <button
                          onClick={() => handleDownloadMP3(conversationId, combinedUrl)}
                          disabled={isConverting}
                          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                            isConverting
                              ? 'bg-gray-400 cursor-not-allowed text-white'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {isConverting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Converting... {conversionProgress}%</span>
                            </>
                          ) : (
                            <>
                              <Download size={16} />
                              <span>Download MP3</span>
                            </>
                          )}
                        </button>
                      )}

                      <a
                        href={combinedUrl}
                        download={`v18-recording-${conversationId.slice(0, 8)}.webm`}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                      >
                        <Download size={16} />
                        <span>Download WebM</span>
                      </a>
                    </>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center text-red-800 dark:text-red-200 text-sm">
                      <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p>{error}</p>
                    </div>
                  </div>
                )}

                {!isConversionSupported && combinedUrl && (
                  <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      MP3 conversion not supported in this browser. Please download the WebM file.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
