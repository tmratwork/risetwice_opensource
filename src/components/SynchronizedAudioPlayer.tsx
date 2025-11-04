// src/components/SynchronizedAudioPlayer.tsx
// Synchronized dual audio player with stereo panning (AI in left ear, patient in right ear)

'use client';

import React, { useRef, useState, useEffect } from 'react';

// Module-level singleton to prevent multiple audio graph creation (survives React Strict Mode remounts)
let globalAudioContext: AudioContext | null = null;
let globalPatientSource: MediaElementAudioSourceNode | null = null;
let globalAiSource: MediaElementAudioSourceNode | null = null;
let globalPatientPanner: StereoPannerNode | null = null;
let globalAiPanner: StereoPannerNode | null = null;
let globalPatientGain: GainNode | null = null;
let globalAiGain: GainNode | null = null;

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
  const patientGainRef = useRef<GainNode | null>(null);
  const aiGainRef = useRef<GainNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [patientVolume, setPatientVolume] = useState(1.0);
  const [aiVolume, setAiVolume] = useState(0.5); // AI quieter by default
  const [isStereoEnabled, setIsStereoEnabled] = useState(false); // Disabled by default for debugging
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Initialize Web Audio API for stereo panning
  useEffect(() => {
    // HARD STOP if already initialized at module level (survives React Strict Mode remounts)
    if (globalAudioContext) {
      console.log('[sync_player] ⏭️ Skipping initialization - module-level singleton exists');
      // Store refs to existing nodes so this component instance can access them
      audioContextRef.current = globalAudioContext;
      patientSourceRef.current = globalPatientSource;
      aiSourceRef.current = globalAiSource;
      patientPannerRef.current = globalPatientPanner;
      aiPannerRef.current = globalAiPanner;
      patientGainRef.current = globalPatientGain;
      aiGainRef.current = globalAiGain;
      return;
    }

    // IMMEDIATELY claim the singleton spot (before any other work)
    // This prevents the second parallel effect from proceeding
    const AudioContextConstructor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    globalAudioContext = new AudioContextConstructor();
    audioContextRef.current = globalAudioContext;

    console.log('[sync_player] 🎵 Initializing Web Audio API (FIRST AND ONLY TIME)...');

    const patientAudio = patientAudioRef.current;
    const aiAudio = aiAudioRef.current;

    if (!patientAudio || !aiAudio) {
      console.log('[sync_player] ❌ Audio elements not ready');
      return;
    }

    // Wait for audio elements to load
    const loadPromises = [
      new Promise((resolve) => {
        if (patientAudio.readyState >= 2) resolve(null);
        else patientAudio.addEventListener('loadeddata', () => resolve(null), { once: true });
      }),
      new Promise((resolve) => {
        if (aiAudio.readyState >= 2) resolve(null);
        else aiAudio.addEventListener('loadeddata', () => resolve(null), { once: true });
      })
    ];

    Promise.all(loadPromises).then(() => {
      console.log('[sync_player] ✅ Both audio elements loaded');

      // Set audio element volumes to 1.0 (GainNode controls volume)
      patientAudio.volume = 1.0;
      aiAudio.volume = 1.0;
      console.log('[sync_player] ✅ Audio element volumes set to 1.0 (GainNode controls volume)');

      // Enable pitch preservation for playback speed changes (prevents chipmunk effect)
      patientAudio.preservesPitch = true;
      aiAudio.preservesPitch = true;
      console.log('[sync_player] ✅ Pitch preservation enabled');

      // Use the ALREADY CREATED globalAudioContext
      const audioContext = globalAudioContext!;
      console.log('[sync_player] ✅ AudioContext created, state:', audioContext.state);

      // Create media sources - THIS CAN ONLY BE DONE ONCE PER ELEMENT
      const patientSource = audioContext.createMediaElementSource(patientAudio);
      const aiSource = audioContext.createMediaElementSource(aiAudio);
      console.log('[sync_player] ✅ Media element sources created');

      // Create panner and gain nodes
      const patientPanner = audioContext.createStereoPanner();
      const aiPanner = audioContext.createStereoPanner();
      const patientGain = audioContext.createGain();
      const aiGain = audioContext.createGain();
      console.log('[sync_player] ✅ Panner and gain nodes created');

      // Configure stereo panning based on initial state
      if (isStereoEnabled) {
        patientPanner.pan.value = 1;  // Full right
        aiPanner.pan.value = -1;      // Full left
        console.log('[sync_player] 🎧 Stereo mode: AI left, Patient right');
      } else {
        patientPanner.pan.value = 0;  // Center
        aiPanner.pan.value = 0;       // Center
        console.log('[sync_player] 🎧 Mono mode: Both centered');
      }

      // Set initial gains
      patientGain.gain.value = (patientVolume * patientVolume * patientVolume) * 4;
      aiGain.gain.value = (aiVolume * aiVolume * aiVolume) * 4;

      // Connect the audio graph
      patientSource.connect(patientPanner);
      patientPanner.connect(patientGain);
      patientGain.connect(audioContext.destination);

      aiSource.connect(aiPanner);
      aiPanner.connect(aiGain);
      aiGain.connect(audioContext.destination);

      console.log('[sync_player] ✅ Audio graph connected');

      // Debug connection counts
      console.log('[sync_player] 🔍 Connection diagnostics:');
      console.log('[sync_player] Patient source numberOfOutputs:', patientSource.numberOfOutputs);
      console.log('[sync_player] Patient panner numberOfOutputs:', patientPanner.numberOfOutputs);
      console.log('[sync_player] Patient gain numberOfOutputs:', patientGain.numberOfOutputs);
      console.log('[sync_player] AI source numberOfOutputs:', aiSource.numberOfOutputs);
      console.log('[sync_player] AI panner numberOfOutputs:', aiPanner.numberOfOutputs);
      console.log('[sync_player] AI gain numberOfOutputs:', aiGain.numberOfOutputs);
      console.log('[sync_player] Expected: all values should be 1. If >1, there are duplicate connections!');

      // Store in module-level globals
      globalPatientSource = patientSource;
      globalAiSource = aiSource;
      globalPatientPanner = patientPanner;
      globalAiPanner = aiPanner;
      globalPatientGain = patientGain;
      globalAiGain = aiGain;

      // Store in component refs
      patientSourceRef.current = patientSource;
      aiSourceRef.current = aiSource;
      patientPannerRef.current = patientPanner;
      aiPannerRef.current = aiPanner;
      patientGainRef.current = patientGain;
      aiGainRef.current = aiGain;

      console.log('[sync_player] ✅ Web Audio API initialized successfully (singleton created)');
    });

    // NO CLEANUP - module-level singleton must persist to prevent recreating multiple audio graphs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once ever

  // Update stereo panning when toggle changes
  useEffect(() => {
    if (!patientPannerRef.current || !aiPannerRef.current) {
      console.log('[sync_player] ⏸️ Panner refs not ready yet');
      return;
    }

    if (isStereoEnabled) {
      aiPannerRef.current.pan.value = -1; // Left ear
      patientPannerRef.current.pan.value = 1; // Right ear
      console.log('[sync_player] 🎧 Switched to STEREO mode');
    } else {
      aiPannerRef.current.pan.value = 0; // Center
      patientPannerRef.current.pan.value = 0; // Center
      console.log('[sync_player] 🎧 Switched to MONO mode');
    }
  }, [isStereoEnabled]);

  // Update volume when sliders change
  // Use exponential curve for more dramatic volume control (perceived loudness is logarithmic)
  // Allow amplification up to 400% (gain value of 4.0)
  useEffect(() => {
    if (patientGainRef.current) {
      const rawVolume = patientVolume;
      const calculatedGain = (rawVolume * rawVolume * rawVolume) * 4;
      patientGainRef.current.gain.value = calculatedGain;

      console.log('[sync_player] 🎚️ Patient volume slider changed:');
      console.log('[sync_player]   Slider value:', rawVolume);
      console.log('[sync_player]   Calculated gain:', calculatedGain);
      console.log('[sync_player]   Actual gain.value:', patientGainRef.current.gain.value);
    }
  }, [patientVolume]);

  useEffect(() => {
    if (aiGainRef.current) {
      const rawVolume = aiVolume;
      const calculatedGain = (rawVolume * rawVolume * rawVolume) * 4;
      aiGainRef.current.gain.value = calculatedGain;

      console.log('[sync_player] 🎚️ AI volume slider changed:');
      console.log('[sync_player]   Slider value:', rawVolume);
      console.log('[sync_player]   Calculated gain:', calculatedGain);
      console.log('[sync_player]   Actual gain.value:', aiGainRef.current.gain.value);
    }
  }, [aiVolume]);

  // Update playback speed when slider changes
  useEffect(() => {
    const patientAudio = patientAudioRef.current;
    const aiAudio = aiAudioRef.current;

    if (patientAudio && aiAudio) {
      patientAudio.playbackRate = playbackSpeed;
      aiAudio.playbackRate = playbackSpeed;
      console.log('[sync_player] ⚡ Playback speed changed to:', playbackSpeed);
    }
  }, [playbackSpeed]);

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
      console.log('[sync_player] Patient gain value:', patientGainRef.current?.gain.value);
      console.log('[sync_player] AI gain value:', aiGainRef.current?.gain.value);
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
          <span className="text-sm font-medium text-blue-800">
            {isStereoEnabled ? 'Stereo Mode: AI (Left Ear) • Patient (Right Ear)' : 'Mono Mode: Both Centered'}
          </span>
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

      {/* Playback speed control */}
      <div className="pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Playback Speed: {playbackSpeed.toFixed(2)}x
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setPlaybackSpeed(0.75)}
              className={`px-2 py-1 text-xs rounded ${playbackSpeed === 0.75 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              0.75x
            </button>
            <button
              onClick={() => setPlaybackSpeed(1.0)}
              className={`px-2 py-1 text-xs rounded ${playbackSpeed === 1.0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              1x
            </button>
            <button
              onClick={() => setPlaybackSpeed(1.25)}
              className={`px-2 py-1 text-xs rounded ${playbackSpeed === 1.25 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              1.25x
            </button>
            <button
              onClick={() => setPlaybackSpeed(1.5)}
              className={`px-2 py-1 text-xs rounded ${playbackSpeed === 1.5 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              1.5x
            </button>
            <button
              onClick={() => setPlaybackSpeed(2.0)}
              className={`px-2 py-1 text-xs rounded ${playbackSpeed === 2.0 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
            >
              2x
            </button>
          </div>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.05"
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Volume controls */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            AI Volume (Left Ear)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={aiVolume}
            onChange={(e) => setAiVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Patient Volume (Right Ear)
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={patientVolume}
            onChange={(e) => setPatientVolume(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
