// src/components/SynchronizedAudioPlayer.tsx
// Synchronized dual audio player with stereo panning (AI in left ear, patient in right ear)

'use client';

import React, { useRef, useState, useEffect } from 'react';

interface SynchronizedAudioPlayerProps {
  patientAudioUrl: string;
  aiAudioUrl: string;
}

export const SynchronizedAudioPlayer: React.FC<SynchronizedAudioPlayerProps> = ({
  patientAudioUrl,
  aiAudioUrl
}) => {
  const patientAudioRef = useRef<HTMLAudioElement>(null);
  const aiAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const patientSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const aiSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const patientPannerRef = useRef<StereoPannerNode | null>(null);
  const aiPannerRef = useRef<StereoPannerNode | null>(null);
  const isInitializedRef = useRef(false); // Use ref to persist across re-renders

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [patientVolume, setPatientVolume] = useState(1.0);
  const [aiVolume, setAiVolume] = useState(0.7); // AI slightly quieter by default
  const [isStereoEnabled, setIsStereoEnabled] = useState(true);

  // Initialize Web Audio API for stereo panning
  useEffect(() => {
    if (!patientAudioRef.current || !aiAudioRef.current || isInitializedRef.current) return;

    const initAudio = async () => {
      try {
        console.log('[sync_player] 🎵 Initializing Web Audio API...');

        const patientEl = patientAudioRef.current;
        const aiEl = aiAudioRef.current;
        if (!patientEl || !aiEl) return;

        // Wait for both audio elements to load metadata
        await Promise.all([
          new Promise((resolve) => {
            if (patientEl.readyState >= 1) resolve(true);
            else patientEl.addEventListener('loadedmetadata', () => resolve(true), { once: true });
          }),
          new Promise((resolve) => {
            if (aiEl.readyState >= 1) resolve(true);
            else aiEl.addEventListener('loadedmetadata', () => resolve(true), { once: true });
          })
        ]);

        console.log('[sync_player] ✅ Both audio elements loaded');

        // Create AudioContext
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        console.log('[sync_player] ✅ AudioContext created, state:', audioContext.state);

        // Create source nodes from audio elements
        const patientSource = audioContext.createMediaElementSource(patientEl);
        const aiSource = audioContext.createMediaElementSource(aiEl);
        patientSourceRef.current = patientSource;
        aiSourceRef.current = aiSource;
        console.log('[sync_player] ✅ Media element sources created');

        // Create stereo panner nodes
        const patientPanner = audioContext.createStereoPanner();
        const aiPanner = audioContext.createStereoPanner();
        patientPannerRef.current = patientPanner;
        aiPannerRef.current = aiPanner;

        // Create gain nodes for volume control
        const patientGain = audioContext.createGain();
        const aiGain = audioContext.createGain();
        patientGain.gain.value = patientVolume;
        aiGain.gain.value = aiVolume;
        console.log('[sync_player] ✅ Panner and gain nodes created');

        // Set initial panning: AI left (-1), Patient right (+1)
        if (isStereoEnabled) {
          aiPanner.pan.value = -1; // Left ear
          patientPanner.pan.value = 1; // Right ear
          console.log('[sync_player] 🎧 Stereo mode: AI left, Patient right');
        } else {
          aiPanner.pan.value = 0; // Center
          patientPanner.pan.value = 0; // Center
          console.log('[sync_player] 🔊 Mono mode: Both centered');
        }

        // Connect the audio graph: source -> panner -> gain -> destination
        patientSource.connect(patientPanner);
        patientPanner.connect(patientGain);
        patientGain.connect(audioContext.destination);

        aiSource.connect(aiPanner);
        aiPanner.connect(aiGain);
        aiGain.connect(audioContext.destination);

        console.log('[sync_player] ✅ Audio graph connected');

        // Store gain nodes for volume updates
        (patientPannerRef.current as any).gainNode = patientGain;
        (aiPannerRef.current as any).gainNode = aiGain;

        isInitializedRef.current = true;
        console.log('[sync_player] ✅ Web Audio API initialized successfully');
      } catch (error) {
        console.error('[sync_player] ❌ Failed to initialize Web Audio API:', error);
      }
    };

    initAudio();

    return () => {
      // Don't reset isInitializedRef in cleanup to prevent double-init from React Strict Mode
      // The ref persists across re-mounts, preventing createMediaElementSource from being called twice
      if (audioContextRef.current) {
        console.log('[sync_player] 🧹 Cleaning up AudioContext');
        audioContextRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientAudioUrl, aiAudioUrl]); // Re-initialize when URLs change

  // Update stereo panning when toggle changes
  useEffect(() => {
    if (!patientPannerRef.current || !aiPannerRef.current) return;

    if (isStereoEnabled) {
      aiPannerRef.current.pan.value = -1; // Left ear
      patientPannerRef.current.pan.value = 1; // Right ear
    } else {
      aiPannerRef.current.pan.value = 0; // Center
      patientPannerRef.current.pan.value = 0; // Center
    }
  }, [isStereoEnabled]);

  // Update volume when sliders change
  useEffect(() => {
    if (patientPannerRef.current) {
      const gainNode = (patientPannerRef.current as any).gainNode as GainNode;
      if (gainNode) gainNode.gain.value = patientVolume;
    }
  }, [patientVolume]);

  useEffect(() => {
    if (aiPannerRef.current) {
      const gainNode = (aiPannerRef.current as any).gainNode as GainNode;
      if (gainNode) gainNode.gain.value = aiVolume;
    }
  }, [aiVolume]);

  // Update duration when metadata loads
  useEffect(() => {
    const patientAudio = patientAudioRef.current;
    const aiAudio = aiAudioRef.current;

    const updateDuration = () => {
      if (patientAudio && aiAudio) {
        // Use the longer of the two durations
        const maxDuration = Math.max(patientAudio.duration, aiAudio.duration);
        setDuration(maxDuration);
      }
    };

    if (patientAudio) {
      patientAudio.addEventListener('loadedmetadata', updateDuration);
    }
    if (aiAudio) {
      aiAudio.addEventListener('loadedmetadata', updateDuration);
    }

    return () => {
      if (patientAudio) {
        patientAudio.removeEventListener('loadedmetadata', updateDuration);
      }
      if (aiAudio) {
        aiAudio.removeEventListener('loadedmetadata', updateDuration);
      }
    };
  }, [patientAudioUrl, aiAudioUrl]);

  // Update current time during playback
  useEffect(() => {
    const patientAudio = patientAudioRef.current;
    if (!patientAudio) return;

    const updateTime = () => {
      setCurrentTime(patientAudio.currentTime);
    };

    patientAudio.addEventListener('timeupdate', updateTime);
    return () => {
      patientAudio.removeEventListener('timeupdate', updateTime);
    };
  }, []);

  // Synchronized play
  const handlePlay = async () => {
    const patientAudio = patientAudioRef.current;
    const aiAudio = aiAudioRef.current;
    if (!patientAudio || !aiAudio) return;

    try {
      console.log('[sync_player] ▶️ Play button clicked');
      console.log('[sync_player] AudioContext state before resume:', audioContextRef.current?.state);

      // Resume AudioContext if suspended (required by some browsers)
      if (audioContextRef.current?.state === 'suspended') {
        console.log('[sync_player] 🔓 Resuming suspended AudioContext...');
        await audioContextRef.current.resume();
        console.log('[sync_player] ✅ AudioContext resumed, new state:', audioContextRef.current?.state);
      }

      console.log('[sync_player] 🎬 Starting playback of both audio elements...');

      // Play both simultaneously
      await Promise.all([
        patientAudio.play(),
        aiAudio.play()
      ]);

      console.log('[sync_player] ✅ Both audio elements playing');
      console.log('[sync_player] Patient audio paused?', patientAudio.paused, 'currentTime:', patientAudio.currentTime, 'volume:', patientAudio.volume);
      console.log('[sync_player] AI audio paused?', aiAudio.paused, 'currentTime:', aiAudio.currentTime, 'volume:', aiAudio.volume);

      // Check gain node values
      const patientGainNode = (patientPannerRef.current as any)?.gainNode as GainNode;
      const aiGainNode = (aiPannerRef.current as any)?.gainNode as GainNode;
      console.log('[sync_player] Patient gain value:', patientGainNode?.gain.value);
      console.log('[sync_player] AI gain value:', aiGainNode?.gain.value);
      console.log('[sync_player] Patient panner value:', patientPannerRef.current?.pan.value);
      console.log('[sync_player] AI panner value:', aiPannerRef.current?.pan.value);

      setIsPlaying(true);
    } catch (error) {
      console.error('[sync_player] ❌ Error playing audio:', error);
    }
  };

  // Synchronized pause
  const handlePause = () => {
    const patientAudio = patientAudioRef.current;
    const aiAudio = aiAudioRef.current;
    if (!patientAudio || !aiAudio) return;

    patientAudio.pause();
    aiAudio.pause();
    setIsPlaying(false);
  };

  // Synchronized seek
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const patientAudio = patientAudioRef.current;
    const aiAudio = aiAudioRef.current;
    if (!patientAudio || !aiAudio) return;

    const newTime = parseFloat(e.target.value);
    patientAudio.currentTime = newTime;
    aiAudio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      {/* Hidden audio elements */}
      <audio ref={patientAudioRef} src={patientAudioUrl} preload="metadata" crossOrigin="anonymous" />
      <audio ref={aiAudioRef} src={aiAudioUrl} preload="metadata" crossOrigin="anonymous" />

      {/* Stereo mode info */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 000 12.728" />
            </svg>
            <span className="text-sm font-medium text-blue-800">
              {isStereoEnabled ? '🎧 Stereo Mode: AI (Left Ear) • Patient (Right Ear)' : '🔊 Mono Mode: Both Centered'}
            </span>
          </div>
          <button
            onClick={() => setIsStereoEnabled(!isStereoEnabled)}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {isStereoEnabled ? 'Switch to Mono' : 'Switch to Stereo'}
          </button>
        </div>
        {isStereoEnabled && (
          <p className="text-xs text-blue-700 mt-2">
            Best experienced with headphones. AI voice will play in your left ear, patient voice in your right ear.
          </p>
        )}
      </div>

      {/* Play/Pause button */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          {isPlaying ? (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Pause
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Play Combined Recording
            </>
          )}
        </button>

        <div className="text-gray-700 font-medium">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Progress bar */}
      <input
        type="range"
        min="0"
        max={duration || 0}
        value={currentTime}
        onChange={handleSeek}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-4"
        style={{
          background: `linear-gradient(to right, #2563eb 0%, #2563eb ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`
        }}
      />

      {/* Volume controls */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Patient Volume (Right Ear)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={patientVolume}
            onChange={(e) => setPatientVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-gray-600 mt-1">{Math.round(patientVolume * 100)}%</div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            AI Volume (Left Ear)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={aiVolume}
            onChange={(e) => setAiVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="text-xs text-gray-600 mt-1">{Math.round(aiVolume * 100)}%</div>
        </div>
      </div>
    </div>
  );
};
