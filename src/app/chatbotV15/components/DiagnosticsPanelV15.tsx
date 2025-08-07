"use client";

import { useState, useEffect } from 'react';
import { X, Download, RefreshCw } from 'lucide-react';
import type { AudioServiceState, WebRTCV15Return } from '@/hooksV15/types';

interface DiagnosticsPanelV15Props {
  audioState: AudioServiceState;
  connectionState: string;
  diagnostics: WebRTCV15Return['diagnostics'];
  onClose: () => void;
}

/**
 * Diagnostics Panel for V15
 * 
 * Built-in diagnostics panel featuring:
 * - Real-time performance metrics
 * - Audio service state monitoring
 * - Event history browser
 * - Diagnostic data export
 * - Clean, organized display
 */

export function DiagnosticsPanelV15({
  audioState,
  connectionState,
  diagnostics,
  onClose
}: DiagnosticsPanelV15Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'audio' | 'events' | 'performance'>('overview');
  const [eventHistory, setEventHistory] = useState<unknown[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<unknown>({});
  const [refreshCount, setRefreshCount] = useState(0);

  // Refresh data
  const refreshData = () => {
    setEventHistory(diagnostics.getEventHistory());
    setPerformanceMetrics(diagnostics.getPerformanceMetrics());
    setRefreshCount(prev => prev + 1);
  };

  // Auto-refresh every 2 seconds
  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, [diagnostics]);

  const handleExportDiagnostics = () => {
    try {
      const data = diagnostics.exportDiagnostics();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `v15-diagnostics-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      if (process.env.ENABLE_AUDIO_LOGGER_LOGS === 'true') {
        console.error('[AudioLogger] [SYSTEM] Failed to export diagnostics:', error);
      }
    }
  };

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-3 rounded">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Connection</h4>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">State:</span>
              <span className={`capitalize ${
                connectionState === 'connected' ? 'text-green-400' :
                connectionState === 'connecting' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {connectionState}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-3 rounded">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Audio</h4>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Playing:</span>
              <span className={audioState.isPlaying ? 'text-green-400' : 'text-gray-400'}>
                {audioState.isPlaying ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Queue:</span>
              <span className="text-white">{audioState.queueLength}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Processed:</span>
              <span className="text-white">{audioState.totalChunksProcessed}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 p-3 rounded">
        <h4 className="text-sm font-medium text-gray-300 mb-2">System</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Version:</span>
            <span className="text-white">V15</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Architecture:</span>
            <span className="text-white">Unified Pipeline</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Logging:</span>
            <span className="text-green-400">[AudioLogger] Consistent</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Refresh Count:</span>
            <span className="text-white">{refreshCount}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAudioDetails = () => (
    <div className="space-y-4">
      <div className="bg-gray-800 p-3 rounded">
        <h4 className="text-sm font-medium text-gray-300 mb-2">Audio State</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Queue Length:</span>
            <span className="text-white">{audioState.queueLength}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Is Playing:</span>
            <span className={audioState.isPlaying ? 'text-green-400' : 'text-gray-400'}>
              {audioState.isPlaying ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Current Message:</span>
            <span className="text-white font-mono text-xs">
              {audioState.currentMessageId || 'None'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Context State:</span>
            <span className="text-white">{audioState.audioContextState}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Processed:</span>
            <span className="text-white">{audioState.totalChunksProcessed}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Playback:</span>
            <span className="text-white">{audioState.totalPlaybackTime.toFixed(2)}s</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEventHistory = () => (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-2">
        Recent Events ({Array.isArray(eventHistory) ? eventHistory.length : 0})
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {Array.isArray(eventHistory) && eventHistory.length > 0 ? (
          eventHistory.slice(-20).reverse().map((event, index) => {
            const e = event as Record<string, unknown>;
            return (
              <div key={index} className="bg-gray-800 p-2 rounded text-xs">
                <div className="flex justify-between items-start">
                  <span className={`font-mono ${
                    String(e.type).includes('error') ? 'text-red-400' :
                    String(e.type).includes('complete') ? 'text-green-400' :
                    'text-blue-400'
                  }`}>
                    {String(e.type)}
                  </span>
                  <span className="text-gray-400">
                    {new Date(Number(e.timestamp) || 0).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-gray-300 mt-1">
                  Message: {String(e.messageId).substring(0, 12)}...
                </div>
                {e.metadata ? (
                  <div className="text-gray-400 mt-1">
                    {JSON.stringify(e.metadata).substring(0, 60)}...
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div className="text-gray-400 text-center py-4">
            No events recorded
          </div>
        )}
      </div>
    </div>
  );

  const renderPerformance = () => {
    const metrics = performanceMetrics as Record<string, unknown>;
    
    return (
      <div className="space-y-4">
        <div className="bg-gray-800 p-3 rounded">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Performance Metrics</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Connection Time:</span>
              <span className="text-white">{Number(metrics.connectionTime) || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Audio Latency:</span>
              <span className="text-white">{Number(metrics.audioLatency) || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Message Processing:</span>
              <span className="text-white">{Number(metrics.messageProcessingTime) || 0}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Memory Usage:</span>
              <span className="text-white">
                {Math.round((Number(metrics.memoryUsage) || 0) / 1024 / 1024)}MB
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl h-3/4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">V15 Diagnostics</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshData}
              className="p-1 text-gray-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={handleExportDiagnostics}
              className="p-1 text-gray-400 hover:text-white"
              title="Export Diagnostics"
            >
              <Download size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'audio', label: 'Audio' },
            { id: 'events', label: 'Events' },
            { id: 'performance', label: 'Performance' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 overflow-auto">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'audio' && renderAudioDetails()}
          {activeTab === 'events' && renderEventHistory()}
          {activeTab === 'performance' && renderPerformance()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
          V15 • Unified Architecture • Consistent Logging • 
          Last Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}