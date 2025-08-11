"use client";

import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/auth-context';

interface MemoryData {
  id: string;
  user_id: string;
  generated_at: string;
  memory_content: Record<string, unknown>;
  conversation_count: number;
  message_count: number;
}

interface WarmHandoffData {
  id: string;
  user_id: string;
  generated_at: string;
  handoff_content: string;
  source_memory_id: string;
}

export default function V16MemoryPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [warmHandoffData, setWarmHandoffData] = useState<WarmHandoffData | null>(null);
  const [memoryPanelExpanded, setMemoryPanelExpanded] = useState(true);
  const [handoffPanelExpanded, setHandoffPanelExpanded] = useState(true);

  // Processing states
  const [memoryProcessing, setMemoryProcessing] = useState(false);
  const [handoffProcessing, setHandoffProcessing] = useState(false);

  // Memory processing stats (like V15 insights)
  const [memoryStats, setMemoryStats] = useState<{
    totalConversations: number;
    alreadyProcessed: number;
    unprocessedFound: number;
    conversationsProcessed: number;
    skippedTooShort: number;
    hasMore: boolean;
    remainingConversations: number;
    lastBatchProcessed?: string;
    qualityConversationsInBatch?: number;
  } | null>(null);

  // Processing step tracking
  const [currentProcessingStep, setCurrentProcessingStep] = useState<string>('');


  // Clear memory states
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearInProgress, setClearInProgress] = useState(false);

  // Copy to clipboard state
  const [copySuccess, setCopySuccess] = useState(false);

  // Fetch existing memory data
  const fetchMemoryData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token:', tokenErr);
      }

      const response = await fetch(`/api/v16/get-memory?userId=${user?.uid || ''}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.memory) {
          setMemoryData(data.memory);
        }
      } else if (response.status === 404) {
        // No memory data yet, this is expected for new users
        console.log('No memory data found - need to generate first');
        setMemoryData(null);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch memory data');
      }
    } catch (err) {
      console.error('Error fetching memory data:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Job polling state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobPollingInterval, setJobPollingInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  // Generate "What AI Remembers" data using asynchronous job queue
  const generateMemoryData = async () => {
    if (!user) return;

    try {
      setMemoryProcessing(true);
      setError(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token:', tokenErr);
      }

      console.log(`[v16_memory_ui] Starting asynchronous memory processing`);

      // Create memory processing job - no offset needed, backend finds next unprocessed conversations
      const response = await fetch('/api/v16/memory-jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user?.uid || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create memory processing job');
      }

      const jobData = await response.json();
      console.log('[v16_memory_ui] Job created:', jobData);

      if (jobData.success && jobData.job) {
        setCurrentJobId(jobData.job.id);

        // Update initial stats
        setMemoryStats({
          totalConversations: jobData.job.totalConversations,
          alreadyProcessed: 0,
          unprocessedFound: jobData.job.totalConversations,
          conversationsProcessed: 0,
          skippedTooShort: 0,
          hasMore: jobData.job.totalConversations > 0,
          remainingConversations: jobData.job.totalConversations
        });

        // Start polling for job status
        startJobPolling(jobData.job.id);
      } else {
        throw new Error(jobData.error || 'Failed to create memory processing job');
      }
    } catch (err) {
      console.error('Error creating memory processing job:', err);
      setError(err instanceof Error ? err.message : String(err));
      setMemoryProcessing(false);
    }
  };

  // Poll job status until completion
  const startJobPolling = (jobId: string) => {
    console.log(`[v16_memory_ui] Starting job status polling for job: ${jobId}`);

    // Clear any existing polling interval
    if (jobPollingInterval) {
      console.log(`[v16_memory_ui] Clearing existing polling interval`);
      clearInterval(jobPollingInterval);
      setJobPollingInterval(null);
    }

    // Store interval reference locally to avoid closure issues
    let localInterval: ReturnType<typeof setInterval> | null = null;

    const pollJob = async () => {
      try {
        console.log(`[v16_memory_ui] 🔄 Polling job status for: ${jobId}`);

        const response = await fetch(`/api/v16/memory-jobs/status?jobId=${jobId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch job status');
        }

        const statusData = await response.json();
        console.log('[v16_memory_ui] Job status update:', statusData);
        console.log(`[v16_memory_ui] Job ${jobId} current status: ${statusData.job?.status}, progress: ${statusData.job?.progressPercentage}%`);

        if (statusData.success && statusData.job) {
          const job = statusData.job;

          // Extract current processing step from job details
          const processingStep = job.processingDetails?.currentStep || '';
          setCurrentProcessingStep(processingStep);

          // Update progress
          setMemoryStats(prev => prev ? {
            ...prev,
            conversationsProcessed: job.processedConversations,
            remainingConversations: Math.max(0, job.totalConversations - job.processedConversations),
            hasMore: job.status === 'processing' || job.progressPercentage < 100
          } : null);

          console.log(`[v16_memory_ui] Job ${jobId} - Status: ${job.status}, Progress: ${job.progressPercentage}%`);

          if (job.status === 'completed') {
            // Job completed successfully
            console.log(`[v16_memory_ui] Job ${jobId} completed successfully`);

            // Extract quality conversation count from job processing details
            const qualityConversationsInBatch = job.processingDetails?.qualityConversationsProcessed ||
              job.processingDetails?.qualityConversationsFound ||
              0;

            console.log(`[v16_memory_ui] Quality conversations in completed batch: ${qualityConversationsInBatch}`);

            // Update final stats with quality conversation information
            setMemoryStats(prev => prev ? {
              ...prev,
              conversationsProcessed: job.processedConversations,
              remainingConversations: Math.max(0, job.totalConversations - job.processedConversations),
              hasMore: job.progressPercentage < 100,
              qualityConversationsInBatch: qualityConversationsInBatch,
              lastBatchProcessed: new Date().toLocaleString()
            } : null);

            // IMMEDIATELY stop polling first to prevent race conditions
            console.log(`[v16_memory_ui] 🛑 STOPPING POLLING for completed job: ${jobId}`);
            console.log(`[v16_memory_ui] Local interval:`, localInterval);
            console.log(`[v16_memory_ui] State interval:`, jobPollingInterval);

            // Clear local interval (this prevents future polling)
            if (localInterval) {
              clearInterval(localInterval);
              localInterval = null;
              console.log(`[v16_memory_ui] ✅ Local interval cleared`);
            }

            // Clear state interval for consistency
            if (jobPollingInterval) {
              clearInterval(jobPollingInterval);
              setJobPollingInterval(null);
              console.log(`[v16_memory_ui] ✅ State interval cleared`);
            }

            // Update state immediately to stop polling
            setCurrentJobId(null);
            setMemoryProcessing(false);
            setCurrentProcessingStep('');
            console.log(`[v16_memory_ui] ✅ State reset - jobId and processing cleared`);

            // CRITICAL: Fetch updated memory data after job completion
            console.log(`[v16_memory_ui] 🔄 Fetching updated memory data after job completion`);
            fetchMemoryData();

            // Return early to prevent any further processing in this poll cycle
            return;


          } else if (job.status === 'failed') {
            // Job failed
            console.error(`[v16_memory_ui] Job ${jobId} failed:`, job.errorMessage);

            // Stop polling
            if (localInterval) {
              clearInterval(localInterval);
              localInterval = null;
            }
            if (jobPollingInterval) {
              clearInterval(jobPollingInterval);
              setJobPollingInterval(null);
            }

            setCurrentJobId(null);
            setMemoryProcessing(false);
            setCurrentProcessingStep('');
            setError(job.errorMessage || 'Memory processing job failed');

          } else if (job.status === 'processing') {
            // Job is still processing - continue polling
            console.log(`[v16_memory_ui] Job ${jobId} processing - ${job.progressPercentage}% complete`);
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
        setError(err instanceof Error ? err.message : String(err));

        // Stop polling on error
        if (localInterval) {
          clearInterval(localInterval);
          localInterval = null;
        }
        if (jobPollingInterval) {
          clearInterval(jobPollingInterval);
          setJobPollingInterval(null);
        }

        setCurrentJobId(null);
        setMemoryProcessing(false);
        setCurrentProcessingStep('');
      }
    };

    // Poll immediately, then every 2 seconds
    pollJob();
    localInterval = setInterval(pollJob, 2000);
    setJobPollingInterval(localInterval);
  };

  // Cleanup polling on component unmount
  useEffect(() => {
    return () => {
      if (jobPollingInterval) {
        clearInterval(jobPollingInterval);
      }
    };
  }, [jobPollingInterval]);

  // Generate warm handoff based on memory data
  const generateWarmHandoff = async () => {
    if (!user || !memoryData) return;

    try {
      setHandoffProcessing(true);
      setError(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token:', tokenErr);
      }

      const response = await fetch('/api/v16/generate-warm-handoff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user?.uid || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.handoff) {
          setWarmHandoffData(data.handoff);
        } else {
          throw new Error(data.error || 'Failed to generate warm handoff');
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate warm handoff');
      }
    } catch (err) {
      console.error('Error generating warm handoff:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setHandoffProcessing(false);
    }
  };

  // Clear what AI remembers (delete all memory data)
  const clearMemoryData = async () => {
    if (!user) return;

    try {
      setClearInProgress(true);
      setError(null);

      let idToken = '';
      try {
        idToken = await user?.getIdToken() || '';
      } catch (tokenErr) {
        console.error('Error getting user ID token:', tokenErr);
      }

      console.log(`[v16_memory] Clearing all memory data for user: ${user.uid}`);

      const response = await fetch('/api/v16/clear-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          userId: user?.uid || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[v16_memory] Memory cleared successfully:', data);

        // Reset all state
        setMemoryData(null);
        setWarmHandoffData(null);
        setMemoryStats(null);
        setShowClearConfirm(false);

        // Refresh to confirm empty state
        await fetchMemoryData();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear memory data');
      }
    } catch (err) {
      console.error('Error clearing memory data:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearInProgress(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    if (user) {
      fetchMemoryData();
    }
  }, [user, fetchMemoryData]);

  // Render memory content
  const renderMemoryContent = (content: Record<string, unknown>) => {
    if (!content || Object.keys(content).length === 0) {
      return (
        <div className="text-gray-700 dark:text-gray-400 italic py-2">
          No memory data available yet.
        </div>
      );
    }

    // Helper function to render individual memory items
    const renderMemoryItem = (item: unknown, index: number): ReactNode => {
      if (typeof item === 'string') {
        return <div key={index} className="mb-2">{item}</div>;
      }

      if (typeof item === 'object' && item !== null) {
        const itemObj = item as Record<string, unknown>;
        return (
          <div key={index} className="mb-4 bg-gray-50 dark:bg-gray-800 p-3 rounded border">
            {/* Main content */}
            {itemObj.content && typeof itemObj.content === 'string' ? (
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                {itemObj.content as ReactNode}
              </p>
            ) : null}
            {itemObj.insight && typeof itemObj.insight === 'string' ? (
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                {itemObj.insight as ReactNode}
              </p>
            ) : null}
            {itemObj.pattern && typeof itemObj.pattern === 'string' ? (
              <p className="font-medium text-gray-800 dark:text-gray-200 mb-2">
                <strong>Pattern:</strong> {itemObj.pattern as ReactNode}
              </p>
            ) : null}

            {/* Metadata tags */}
            <div className="flex flex-wrap gap-2 mt-2">
              {itemObj.importance && typeof itemObj.importance === 'string' ? (
                <span className={`px-2 py-1 text-xs rounded ${itemObj.importance === 'critical' ? 'bg-red-100 text-red-800' :
                    itemObj.importance === 'high' ? 'bg-orange-100 text-orange-800' :
                      itemObj.importance === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                  }`}>
                  {itemObj.importance as ReactNode} importance
                </span>
              ) : null}
              {itemObj.confidence && (typeof itemObj.confidence === 'string' || typeof itemObj.confidence === 'number') ? (
                <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">
                  {itemObj.confidence as ReactNode}/5 confidence
                </span>
              ) : null}
              {itemObj.recency && typeof itemObj.recency === 'string' ? (
                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">
                  {itemObj.recency as ReactNode}
                </span>
              ) : null}
              {itemObj.subtype && typeof itemObj.subtype === 'string' ? (
                <span className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-800">
                  {itemObj.subtype as ReactNode}
                </span>
              ) : null}
              {itemObj.category && typeof itemObj.category === 'string' ? (
                <span className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-800">
                  {itemObj.category as ReactNode}
                </span>
              ) : null}
              {itemObj.timeframe && typeof itemObj.timeframe === 'string' ? (
                <span className="px-2 py-1 text-xs rounded bg-teal-100 text-teal-800">
                  {itemObj.timeframe as ReactNode}
                </span>
              ) : null}
              {itemObj.frequency && typeof itemObj.frequency === 'string' ? (
                <span className="px-2 py-1 text-xs rounded bg-pink-100 text-pink-800">
                  {itemObj.frequency as ReactNode}
                </span>
              ) : null}
            </div>

            {/* Additional details */}
            {itemObj.triggers && Array.isArray(itemObj.triggers) && itemObj.triggers.length > 0 ? (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                <strong>Triggers:</strong> {itemObj.triggers.filter(t => typeof t === 'string').join(', ')}
              </div>
            ) : null}
          </div>
        );
      }

      return <div key={index} className="mb-2">{JSON.stringify(item)}</div>;
    };

    return (
      <div className="space-y-6">
        {Object.entries(content)
          .filter(([key]) => key !== 'extracted_information')
          .map(([key, value]) => (
            <div key={key} className="border-l-4 border-blue-500 dark:border-blue-600 pl-4">
              <h4 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-3 capitalize">
                {key.replace(/_/g, ' ')}
              </h4>
              <div className="text-gray-700 dark:text-gray-300">
                {typeof value === 'string' ? (
                  <p>{value}</p>
                ) : Array.isArray(value) ? (
                  value.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 italic">No items in this category</p>
                  ) : (
                    <div className="space-y-2">
                      {value.map((item, index) => renderMemoryItem(item, index))}
                    </div>
                  )
                ) : (
                  <pre className="text-sm bg-gray-100 dark:bg-gray-700 p-2 rounded">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
      </div>
    );
  };

  // Main render
  if (!user) {
    return (
      <div className="container mx-auto px-4 pt-20 pb-8">
        <h1 className="text-2xl font-bold mb-6">Memory</h1>
        <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg shadow-md">
          <p className="text-red-700 dark:text-red-300">
            Authentication required. Please sign in to view memory data.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 pt-20 pb-8">
        <h1 className="text-2xl font-bold mb-6">Memory</h1>
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <p className="text-gray-700 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 pt-20 pb-8">
      <h1 className="text-2xl font-bold mb-6">Memory</h1>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 p-4 rounded-lg mb-6">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* What AI Remembers Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setMemoryPanelExpanded(!memoryPanelExpanded)}>
          <h2 className="text-xl font-semibold">What AI Remembers</h2>
          <div className="flex space-x-2 items-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // No offset needed - backend automatically finds next 10 unprocessed conversations
                generateMemoryData();
              }}
              disabled={memoryProcessing}
              className="text-blue-500 hover:text-blue-700 text-sm mr-2"
            >
              {memoryProcessing ? (currentJobId ? 'Processing...' : 'Creating Job...') : 'Generate'}
            </button>
            <span className="text-gray-700 dark:text-gray-300">{memoryPanelExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {memoryPanelExpanded && (
          <div className="mt-4">
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              This section shows what the V16 AI system has learned and remembers about you through your conversations.
              This information helps provide more personalized assistance.
            </p>

            {/* Processing Statistics - Job-based system */}
            {memoryStats && !memoryProcessing && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Last Processing Results</h4>
                <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                  <p><strong>Total conversations:</strong> {memoryStats.totalConversations}</p>
                  <p><strong>Conversations processed:</strong> {memoryStats.conversationsProcessed}</p>
                  <p><strong>Remaining to process:</strong> {memoryStats.remainingConversations}</p>
                  {memoryStats.lastBatchProcessed && (
                    <p><strong>Last batch processed:</strong> {memoryStats.lastBatchProcessed}</p>
                  )}
                  {memoryStats.qualityConversationsInBatch !== undefined && (
                    <p><strong>Quality conversations found in batch:</strong> {memoryStats.qualityConversationsInBatch}</p>
                  )}
                  {memoryStats.skippedTooShort > 0 && (
                    <p><strong>Skipped (too short):</strong> {memoryStats.skippedTooShort}</p>
                  )}
                  <p><strong>Status:</strong> <span className="text-green-700 dark:text-green-300 font-medium">
                    {(memoryStats.qualityConversationsInBatch ?? 0) > 0
                      ? `Completed successfully - ${memoryStats.qualityConversationsInBatch} conversations analyzed`
                      : 'Completed - no quality conversations in this batch'
                    }
                  </span></p>
                  {memoryStats.hasMore && (
                    <p className="text-blue-700 dark:text-blue-300 font-medium">
                      More conversations available - click &quot;Generate&quot; to continue processing
                    </p>
                  )}
                </div>
              </div>
            )}

            {memoryProcessing && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                {currentJobId ? (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                      <span className="text-blue-700 dark:text-blue-300 font-medium">
                        {currentProcessingStep || 'Processing conversations asynchronously...'}
                      </span>
                    </div>

                    {memoryStats && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400">
                          <span>Progress</span>
                          <span>{memoryStats.conversationsProcessed} / {memoryStats.totalConversations} conversations</span>
                        </div>

                        <div className="w-full bg-blue-100 dark:bg-blue-800 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{
                              width: `${memoryStats.totalConversations > 0 ? (memoryStats.conversationsProcessed / memoryStats.totalConversations) * 100 : 0}%`
                            }}
                          ></div>
                        </div>

                        {currentProcessingStep && (
                          <div className="text-xs text-blue-600 dark:text-blue-400">
                            Current: {currentProcessingStep}
                          </div>
                        )}

                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          Job ID: {currentJobId}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-blue-600 dark:text-blue-400">
                      This process runs in the background and won&apos;t timeout. You can safely navigate away and return later.
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                    <span className="text-blue-700 dark:text-blue-300">Creating memory processing job...</span>
                  </div>
                )}
              </div>
            )}

            {memoryData ? (
              <div className="space-y-4">
                {/* Last updated info */}
                <div className="border-l-2 border-blue-500 dark:border-blue-600 pl-3 py-2 mb-4">
                  <p className="text-blue-700 dark:text-blue-300 text-sm flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    Generated on: {new Date(memoryData.generated_at).toLocaleDateString()} at {new Date(memoryData.generated_at).toLocaleTimeString()}
                  </p>
                </div>

                {/* Memory content */}
                {renderMemoryContent(memoryData.memory_content)}

                {/* Stats */}
                {memoryData.conversation_count > 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-6">
                    Based on {memoryData.conversation_count} conversations and {memoryData.message_count} messages.
                  </div>
                )}

                {/* Memory Controls */}
                <div className="mt-6 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3">Memory Controls</h3>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      disabled={clearInProgress}
                    >
                      Clear Memory
                    </button>
                  </div>

                  {/* Clear confirmation dialog */}
                  {showClearConfirm && (
                    <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <p className="text-red-700 dark:text-red-300 font-medium">
                        Are you sure you want to clear what the AI remembers about you?
                      </p>
                      <p className="my-2 text-red-600 dark:text-red-400 text-sm">
                        This action cannot be undone. The AI will completely forget all personal details, preferences, and insights learned from your conversations. You can regenerate memory by processing conversations again.
                      </p>
                      <div className="flex space-x-3 mt-3">
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                          disabled={clearInProgress}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={clearMemoryData}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded"
                          disabled={clearInProgress}
                        >
                          {clearInProgress ? 'Clearing...' : 'Yes, Clear All Memory'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-700 dark:text-yellow-300">
                  No memory data available yet. Click &quot;Generate&quot; to process your conversations.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generate Warm Hand-off Section */}
      {memoryData && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setHandoffPanelExpanded(!handoffPanelExpanded)}>
            <h2 className="text-xl font-semibold">Generate Warm Hand-off</h2>
            <span className="text-gray-700 dark:text-gray-300">{handoffPanelExpanded ? '▲' : '▼'}</span>
          </div>

          {handoffPanelExpanded && (
            <div className="mt-4">
              <p className="mb-4 text-gray-700 dark:text-gray-300">
                Generate a warm handoff summary based on what the AI remembers about you.
                This creates a professional summary that can be shared with healthcare providers.
              </p>

              {handoffProcessing && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-3"></div>
                    <span className="text-blue-700 dark:text-blue-300">Generating warm handoff summary based on what AI remembers...</span>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <button
                  onClick={generateWarmHandoff}
                  disabled={handoffProcessing}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2 rounded"
                >
                  {handoffProcessing ? 'Generating...' : 'Generate Warm Hand-off'}
                </button>

                {warmHandoffData && (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="font-medium text-green-800 dark:text-green-200">Warm Handoff Generated Successfully!</span>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(warmHandoffData.handoff_content);
                            setCopySuccess(true);
                            setTimeout(() => setCopySuccess(false), 2000);
                          } catch (err) {
                            console.error('Failed to copy to clipboard:', err);
                          }
                        }}
                        className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 p-1 rounded"
                        title={copySuccess ? "Copied!" : "Copy to clipboard"}
                      >
                        {copySuccess ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                      Generated on: {new Date(warmHandoffData.generated_at).toLocaleDateString()} at {new Date(warmHandoffData.generated_at).toLocaleTimeString()}
                    </p>

                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-3">
                      <h3 className="font-medium mb-2">Handoff Summary:</h3>
                      <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {warmHandoffData.handoff_content}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}