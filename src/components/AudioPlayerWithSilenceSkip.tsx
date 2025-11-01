// src/components/AudioPlayerWithSilenceSkip.tsx
// Audio player with automatic silence skipping for provider intake recordings

'use client';

import { useEffect, useRef, useState } from 'react';

interface SilenceSegment {
  start: number;
  end: number;
}

interface AudioPlayerWithSilenceSkipProps {
  audioUrl: string;
  filePath: string;
  bucketName?: string;
  onAnalysisComplete?: (segmentCount: number) => void;
}

export const AudioPlayerWithSilenceSkip = ({
  audioUrl,
  filePath,
  bucketName = 'audio-recordings',
  onAnalysisComplete
}: AudioPlayerWithSilenceSkipProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [silenceSegments, setSilenceSegments] = useState<SilenceSegment[]>([]);
  const [analysisState, setAnalysisState] = useState<'idle' | 'loading' | 'analyzing' | 'ready' | 'error'>('idle');
  const [autoSkipEnabled, setAutoSkipEnabled] = useState(true);
  const [skippedCount, setSkippedCount] = useState(0);
  const isSeekingRef = useRef(false);
  const lastSkipTimeRef = useRef(0);
  const hasSkippedOpeningSilenceRef = useRef(false);

  // Load silence analysis on mount
  useEffect(() => {
    loadSilenceAnalysis();
  }, [filePath, bucketName]);

  // Reset skip flag when audio URL changes (new signed URL)
  useEffect(() => {
    hasSkippedOpeningSilenceRef.current = false;
    console.log('[audio_player] 🔄 Audio URL changed, reset skip flag');
  }, [audioUrl]);

  const loadSilenceAnalysis = async () => {
    try {
      setAnalysisState('loading');

      // First check if analysis exists in database
      const checkResponse = await fetch(
        `/api/provider/get-silence-analysis?file_path=${encodeURIComponent(filePath)}&bucket_name=${encodeURIComponent(bucketName)}`
      );

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();

        if (checkData.success && checkData.analysis) {
          // Analysis exists - use it
          console.log('[audio_player] ✅ Loaded cached analysis:', {
            segments: checkData.analysis.silence_segments?.length || 0,
            duration: checkData.analysis.duration_seconds
          });
          setSilenceSegments(checkData.analysis.silence_segments || []);
          setAnalysisState('ready');
          onAnalysisComplete?.(checkData.analysis.silence_segments?.length || 0);
          return;
        }
      }

      // No analysis exists - trigger it now
      setAnalysisState('analyzing');

      const analyzeResponse = await fetch('/api/provider/analyze-silence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          bucketName
        })
      });

      const analyzeData = await analyzeResponse.json();

      if (analyzeData.success) {
        setSilenceSegments(analyzeData.silenceSegments || []);
        setAnalysisState('ready');
        onAnalysisComplete?.(analyzeData.silenceSegments?.length || 0);
      } else {
        console.warn('[audio_player] ⚠️ Silence analysis failed (FFmpeg unavailable) - playing without silence skip:', analyzeData.error);
        // Gracefully degrade - play audio without silence skipping
        setAnalysisState('ready');
        setSilenceSegments([]);
        onAnalysisComplete?.(0);
      }

    } catch (error) {
      console.warn('[audio_player] ⚠️ Silence analysis unavailable - playing without silence skip:', error);
      // Gracefully degrade - play audio without silence skipping
      setAnalysisState('ready');
      setSilenceSegments([]);
      onAnalysisComplete?.(0);
    }
  };

  // Auto-skip silence segments during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !autoSkipEnabled || silenceSegments.length === 0) {
      console.log('[audio_player] Skip handler NOT active:', {
        hasAudio: !!audio,
        autoSkipEnabled,
        segmentCount: silenceSegments.length
      });
      return;
    }

    console.log('[audio_player] ✅ Skip handler ACTIVE with', silenceSegments.length, 'segments');

    const handleTimeUpdate = () => {
      // Prevent skip actions while seeking
      if (isSeekingRef.current) return;

      const currentTime = audio.currentTime;

      // Check if current time is within any silence segment
      const silenceSegment = silenceSegments.find(
        segment => currentTime >= segment.start && currentTime < segment.end
      );

      if (silenceSegment) {
        // Prevent duplicate skips for the same segment
        if (Math.abs(silenceSegment.end - lastSkipTimeRef.current) < 0.1) {
          return;
        }

        console.log('[audio_player] ⏭️ Skipping silence:', {
          from: currentTime.toFixed(2),
          to: silenceSegment.end.toFixed(2),
          duration: (silenceSegment.end - silenceSegment.start).toFixed(2) + 's'
        });

        // Set seeking flag to prevent loop
        isSeekingRef.current = true;
        lastSkipTimeRef.current = silenceSegment.end;

        // Skip to end of silence segment
        const targetTime = silenceSegment.end;
        audio.currentTime = targetTime;
        console.log('[audio_player] 🔄 TimeUpdate skip executed, set currentTime to:', targetTime.toFixed(2));

        // Verify it actually worked
        setTimeout(() => {
          const actualTime = audio.currentTime;
          console.log('[audio_player] ✅ Verification - currentTime after timeupdate skip:', actualTime.toFixed(2));

          if (Math.abs(actualTime - targetTime) > 1) {
            console.error('[audio_player] ❌ TimeUpdate skip FAILED - currentTime did not change!');
            console.error('[audio_player] ❌ Expected:', targetTime.toFixed(2), 'Got:', actualTime.toFixed(2));
            console.error('[audio_player] ❌ This WebM file appears to have NO seekable keyframes');
            console.error('[audio_player] ❌ The file needs to be re-encoded with proper keyframes for seeking to work');
          } else {
            console.log('[audio_player] ✅ TimeUpdate skip SUCCESS');
            setSkippedCount(prev => prev + 1);
          }

          isSeekingRef.current = false;
        }, 50);
      }
    };

    const handleSeeking = () => {
      console.log('[audio_player] 🔄 SEEKING event - currentTime:', audio.currentTime.toFixed(2));
      isSeekingRef.current = true;
    };

    const handleSeeked = () => {
      console.log('[audio_player] ✅ SEEKED event - currentTime:', audio.currentTime.toFixed(2));
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 50);
    };

    const handlePlay = () => {
      console.log('[audio_player] ▶️ PLAY event fired:', {
        currentTime: audio.currentTime.toFixed(2),
        hasSkipped: hasSkippedOpeningSilenceRef.current,
        segmentCount: silenceSegments.length
      });
      // Let play proceed normally - we'll skip in the 'playing' event
    };

    const handlePlaying = () => {
      console.log('[audio_player] 🎬 PLAYING event fired:', {
        currentTime: audio.currentTime.toFixed(2),
        hasSkipped: hasSkippedOpeningSilenceRef.current
      });

      // Check if we need to skip opening silence
      if (hasSkippedOpeningSilenceRef.current) {
        console.log('[audio_player] ⏸️ Already skipped opening silence');
        return;
      }

      if (audio.currentTime >= 1) {
        console.log('[audio_player] ⏸️ Not at start (currentTime >= 1)');
        return;
      }

      // Find opening silence: segment that starts near 0 and is long (> 5 seconds)
      const openingSilenceSegment = silenceSegments.find(
        segment => segment.start < 1 && segment.end > 5
      );

      if (openingSilenceSegment) {
        console.log('[audio_player] 🚀 Attempting to skip opening silence:', {
          from: audio.currentTime.toFixed(2),
          to: openingSilenceSegment.end.toFixed(2)
        });

        isSeekingRef.current = true;

        // Attempt to seek during playback
        audio.currentTime = openingSilenceSegment.end;

        // Verify the seek actually happened - only set ref if it worked
        setTimeout(() => {
          console.log('[audio_player] ✅ Current position after seek attempt:', audio.currentTime.toFixed(2));
          if (audio.currentTime >= 5) {
            // Seek succeeded!
            hasSkippedOpeningSilenceRef.current = true;
            lastSkipTimeRef.current = openingSilenceSegment.end;
            setSkippedCount(prev => prev + 1);
            console.log('[audio_player] ✅ Seek succeeded in playing event');
          } else {
            // Seek failed - leave ref as false so timeupdate handler can catch it
            console.log('[audio_player] ⚠️ Seek failed - WebM file may lack keyframes. Timeupdate handler will catch it.');
          }
          isSeekingRef.current = false;
        }, 100);
      } else {
        console.log('[audio_player] ⚠️ No opening silence segment found');
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
    };
  }, [silenceSegments, autoSkipEnabled]);

  const toggleAutoSkip = () => {
    setAutoSkipEnabled(prev => !prev);
  };

  return (
    <div className="space-y-3">
      {/* Analysis Status */}
      {analysisState === 'analyzing' && (
        <div className="flex items-center text-blue-600 text-sm">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Analyzing audio for optimal playback...
        </div>
      )}

      {/* Audio Player */}
      <div>
        <audio
          ref={audioRef}
          controls
          className="w-full"
          preload="auto"
          key={audioUrl}
        >
          <source src={audioUrl} type="audio/webm" />
          Your browser does not support the audio element.
        </audio>
        <p className="text-sm text-gray-600 mt-1">
          Note: Audio is in WebM format. If playback fails, please use Chrome or Firefox.
        </p>
      </div>

      {/* Controls */}
      {analysisState === 'ready' && silenceSegments.length > 0 && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoSkip}
              className={`px-3 py-1 rounded-lg transition-colors ${
                autoSkipEnabled
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {autoSkipEnabled ? '✓ Auto-skip ON' : 'Auto-skip OFF'}
            </button>
            <span className="text-gray-600">
              {silenceSegments.length} silent gaps detected
            </span>
          </div>

          {skippedCount > 0 && autoSkipEnabled && (
            <span className="text-blue-600">
              Skipped {skippedCount} gap{skippedCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {analysisState === 'ready' && silenceSegments.length === 0 && (
        <div className="text-sm text-gray-600">
          ✓ No significant silent gaps detected
        </div>
      )}
    </div>
  );
};
