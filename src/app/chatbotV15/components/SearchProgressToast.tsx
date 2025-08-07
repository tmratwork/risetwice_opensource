// src/app/chatbotV15/components/SearchProgressToast.tsx

"use client";

import { useState, useEffect, useCallback } from 'react';

interface SearchProgressState {
  isVisible: boolean;
  searchId: string | null;
  requestId: string | null;
  query: string;
  location: string;
  resourceType: string;
  currentStatus: string;
  progress: number;
  isComplete: boolean;
}

const INITIAL_STATE: SearchProgressState = {
  isVisible: false,
  searchId: null,
  requestId: null,
  query: '',
  location: '',
  resourceType: '',
  currentStatus: '',
  progress: 0,
  isComplete: false
};

const STATUS_MESSAGES = [
  'Starting web search...',
  'Analyzing search terms...',
  'Searching websites...',
  'Processing search results...',
  'Extracting resource information...',
  'Filtering results by location...',
  'Organizing resources found...',
  'Search complete!'
];

export default function SearchProgressToast() {
  const [state, setState] = useState<SearchProgressState>(INITIAL_STATE);

  // Calculate progress based on status updates
  useEffect(() => {
    if (!state.isVisible || state.isComplete) return;

    // Update progress based on current status keywords
    const status = state.currentStatus.toLowerCase();
    let newProgress = 0;

    if (status.includes('connecting') || status.includes('starting')) newProgress = 1;
    else if (status.includes('analyzing') || status.includes('processing')) newProgress = 3;
    else if (status.includes('parsing') || status.includes('extracting')) newProgress = 5;
    else if (status.includes('organizing') || status.includes('found')) newProgress = 7;

    setState(prev => ({ ...prev, progress: Math.max(prev.progress, newProgress) }));
  }, [state.currentStatus, state.isVisible, state.isComplete]);

  // Listen for search start events
  const handleSearchStart = useCallback((event: CustomEvent) => {
    const { searchId, requestId, query, location, resourceType } = event.detail;

    console.log(`[toast] ===== SEARCH TOAST STARTING =====`);
    console.log(`[toast] Received search start event:`, event.detail);

    const initialStatus = location
      ? `Searching for ${resourceType || 'resources'} in ${location}...`
      : `Searching for ${resourceType || 'resources'}...`;

    setState({
      isVisible: true,
      searchId,
      requestId,
      query: query || '',
      location: location || '',
      resourceType: resourceType || 'resources',
      currentStatus: initialStatus,
      progress: 0,
      isComplete: false
    });

    console.log(`[toast] ✅ Toast now visible with initial status: "${initialStatus}"`);
  }, []);

  // Listen for search status updates
  const handleSearchUpdate = useCallback((event: CustomEvent) => {
    const { searchId, status } = event.detail;

    console.log(`[toast] 📡 Received status update:`, status);

    setState(prev => {
      if (prev.searchId !== searchId) {
        console.log(`[toast] ⚠️ Ignoring update for different search ID`);
        return prev;
      }

      return {
        ...prev,
        currentStatus: status
      };
    });
  }, []);

  // Listen for search completion events
  const handleSearchComplete = useCallback((event: CustomEvent) => {
    const { searchId, success, resultCount, error } = event.detail;

    console.log(`[toast] ===== SEARCH TOAST COMPLETING =====`);
    console.log(`[toast] Received completion event:`, event.detail);

    setState(prev => {
      if (prev.searchId !== searchId) {
        console.log(`[toast] ⚠️ Ignoring completion for different search ID`);
        return prev;
      }

      const finalStatus = success
        ? `Found ${resultCount || 0} resources!`
        : `Search error: ${error || 'Unknown error'}`;

      console.log(`[toast] ✅ Updating toast with final status: "${finalStatus}"`);

      return {
        ...prev,
        currentStatus: finalStatus,
        isComplete: true,
        progress: STATUS_MESSAGES.length - 1
      };
    });

    // Auto-hide after 3 seconds
    setTimeout(() => {
      console.log(`[toast] 🚫 Auto-hiding toast after completion`);
      setState(INITIAL_STATE);
    }, 3000);
  }, []);

  // Setup event listeners
  useEffect(() => {
    const startHandler = (e: Event) => handleSearchStart(e as CustomEvent);
    const updateHandler = (e: Event) => handleSearchUpdate(e as CustomEvent);
    const completeHandler = (e: Event) => handleSearchComplete(e as CustomEvent);

    console.log(`[toast] 🎧 Setting up toast event listeners`);
    window.addEventListener('show_search_toast', startHandler);
    window.addEventListener('search_toast_update', updateHandler);
    window.addEventListener('search_toast_complete', completeHandler);

    return () => {
      console.log(`[toast] 🚫 Cleaning up toast event listeners`);
      window.removeEventListener('show_search_toast', startHandler);
      window.removeEventListener('search_toast_update', updateHandler);
      window.removeEventListener('search_toast_complete', completeHandler);
    };
  }, [handleSearchStart, handleSearchUpdate, handleSearchComplete]);

  if (!state.isVisible) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            {!state.isComplete ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            ) : (
              <div className="rounded-full h-4 w-4 bg-green-500 mr-2 flex items-center justify-center">
                <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Resource Search
            </span>
          </div>
          <button
            onClick={() => setState(INITIAL_STATE)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Status Message */}
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
          {state.currentStatus}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{
              width: `${((state.progress + 1) / STATUS_MESSAGES.length) * 100}%`
            }}
          ></div>
        </div>

        {/* Search Details */}
        {(state.query || state.location) && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {state.location && <div>Location: {state.location}</div>}
            {state.query && <div>Query: {state.query}</div>}
          </div>
        )}
      </div>
    </div>
  );
}