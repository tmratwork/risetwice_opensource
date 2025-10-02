// src/app/chatbotV17/components/VoiceSettingsModal.tsx
// ElevenLabs Conversational AI Voice Settings Modal for V17

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useSearchParams } from 'next/navigation';

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VoiceSettings {
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

interface ProviderVoiceSettings {
  speed: number;
  stability: number;
  similarity: number;
  style: number;
  speaker_boost: boolean;
  model_family: string;
  language: string;
}



// Tooltip component for voice settings information
function InfoTooltip({ content, position = 'top' }: { content: string; position?: 'top' | 'bottom' }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block ml-2">
      <button
        type="button"
        className="w-4 h-4 bg-gray-400 text-white rounded-full text-xs font-bold hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onClick={(e) => {
          e.preventDefault();
          setIsVisible(!isVisible);
        }}
      >
        i
      </button>
      {isVisible && (
        <div className={`absolute right-0 w-80 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg z-[9999] ${
          position === 'top'
            ? 'bottom-full mb-2'
            : 'top-full mt-2'
        }`}>
          <div className="whitespace-normal leading-relaxed">
            {content}
          </div>
          {position === 'top' ? (
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
          ) : (
            <div className="absolute bottom-full right-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-800"></div>
          )}
        </div>
      )}
    </div>
  );
}

export function VoiceSettingsModal({ isOpen, onClose }: VoiceSettingsModalProps) {
  console.log('[VoiceSettingsModal] Rendered with isOpen:', isOpen);

  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Determine user type and settings mode
  const isProviderMode = searchParams.get('provider') === 'true';

  // Voice configuration state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    speed: 1.0,
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: false,
  });


  // Patient-specific state (playback speed only)
  const [patientPlaybackSpeed, setPatientPlaybackSpeed] = useState(1.0);

  // Load current settings when modal opens
  useEffect(() => {
    const loadCurrentSettings = async () => {
      if (!isOpen || !user?.uid) return;

      try {
        if (isProviderMode) {
          // Provider mode: Load full voice settings for their AI Preview
          setStatus('📖 Loading your AI Preview voice settings...');

          const response = await fetch(`/api/voice-settings/provider?userId=${user.uid}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const settings = data.settings;
              // Convert provider settings to modal format
              setVoiceSettings({
                speed: settings.speed,
                stability: settings.stability,
                similarity_boost: settings.similarity,
                style: settings.style,
                use_speaker_boost: settings.speaker_boost
              });
              setStatus('✅ AI Preview voice settings loaded');
            } else {
              setStatus('⚠️ Using default provider settings');
            }
          } else {
            setStatus('⚠️ Could not load AI Preview settings - using defaults');
          }
        } else {
          // Patient mode: Load only playback speed preference
          setStatus('📖 Loading your playback preferences...');

          const response = await fetch(`/api/voice-settings/patient?userId=${user.uid}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setPatientPlaybackSpeed(data.playbackSpeed);
              setStatus('✅ Playback preferences loaded');
            } else {
              setStatus('⚠️ Using default playback speed');
            }
          } else {
            setStatus('⚠️ Could not load preferences - using defaults');
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setStatus('⚠️ Using default settings');
      }
    };

    if (isOpen) {
      loadCurrentSettings();
    }
  }, [isOpen, user?.uid, isProviderMode]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';

      // Focus the modal for accessibility
      if (modalRef.current) {
        modalRef.current.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Handle backdrop click
  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const updateVoiceSetting = (key: keyof VoiceSettings, value: number | boolean) => {
    setVoiceSettings(prev => ({ ...prev, [key]: value }));
  };


  const saveSettings = async () => {
    if (!user?.uid) {
      setStatus('❌ Please sign in to save settings');
      return;
    }

    try {
      setSaving(true);

      if (isProviderMode) {
        // Provider mode: Save full voice settings to their AI Preview
        setStatus('💾 Saving AI Preview voice settings...');

        const providerSettings: ProviderVoiceSettings = {
          speed: voiceSettings.speed,
          stability: voiceSettings.stability,
          similarity: voiceSettings.similarity_boost,
          style: voiceSettings.style,
          speaker_boost: voiceSettings.use_speaker_boost,
          model_family: 'same_as_agent',
          language: 'en'
        };

        const response = await fetch('/api/voice-settings/provider', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            settings: providerSettings
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save provider voice settings');
        }

        const data = await response.json();
        if (data.success) {
          setStatus('✅ AI Preview voice settings saved! All patients will hear these settings.');
          setTimeout(() => onClose(), 2000);
        } else {
          setStatus('❌ Error saving AI Preview settings');
        }
      } else {
        // Patient mode: Save only playback speed preference
        setStatus('💾 Saving your playback preference...');

        const response = await fetch('/api/voice-settings/patient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            playbackSpeed: patientPlaybackSpeed
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save playback speed');
        }

        const data = await response.json();
        if (data.success) {
          setStatus('✅ Playback speed saved! This will apply to all AI Previews you use.');
          setTimeout(() => onClose(), 2000);
        } else {
          setStatus('❌ Error saving playback preference');
        }
      }
    } catch (error) {
      console.error('Save settings error:', error);
      setStatus('❌ Error saving settings');
    } finally {
      setSaving(false);
    }
  };


  if (!isOpen) {
    console.log('[VoiceSettingsModal] Not rendering - isOpen is false');
    return null;
  }

  console.log('[VoiceSettingsModal] Rendering modal UI');

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50"
      style={{ zIndex: 9999 }}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-y-auto m-4 w-full"
        tabIndex={-1}
        role="dialog"
        aria-labelledby="voice-settings-title"
        aria-modal="true"
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h1 id="voice-settings-title" className="text-2xl font-bold text-gray-800">
                {isProviderMode ? 'AI Preview Voice Settings' : 'Playback Settings'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isProviderMode
                  ? 'Configure the voice characteristics for your AI Preview. These settings will apply to all patients who interact with your AI Preview.'
                  : 'Adjust playback speed to your preference. This will apply to all AI Previews you interact with.'
                }
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
              aria-label="Close voice settings"
            >
              ×
            </button>
          </div>

          {status && (
            <div className={`p-3 rounded mb-4 ${
              status.includes('✅')
                ? 'bg-green-100 text-green-700'
                : status.includes('❌')
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {status}
            </div>
          )}


          {isProviderMode ? (
            /* Provider Mode: Full Voice Settings */
            <>
              {/* Voice Quality Settings */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h2 className="text-lg font-semibold mb-4 text-gray-800">🎛️ Voice Quality Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Speed Control */}
              <div className="space-y-3">
                <h3 className="text-base font-medium text-gray-800">Speed Control</h3>
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Speed: {voiceSettings.speed.toFixed(2)}x
                    <span className="text-gray-500 ml-2 text-xs">
                      {voiceSettings.speed < 1 ? '(Slower)' :
                       voiceSettings.speed > 1 ? '(Faster)' : '(Normal)'}
                    </span>
                    <InfoTooltip content="Controls how fast or slow the AI speaks. 0.7x: Much slower, deliberate speech—good for accessibility or complex topics. 1.0x: Normal conversational speed. 1.2x: Faster, more energetic speech—useful for dynamic conversations or when you want to save time." />
                  </label>
                  <input
                    type="range"
                    min="0.7"
                    max="1.2"
                    step="0.05"
                    value={voiceSettings.speed}
                    onChange={(e) => updateVoiceSetting('speed', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.7x</span>
                    <span>1.0x</span>
                    <span>1.2x</span>
                  </div>
                </div>
              </div>

              {/* Voice Quality */}
              <div className="space-y-3">
                <h3 className="text-base font-medium text-gray-800">Voice Quality</h3>

                {/* Stability */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Stability: {voiceSettings.stability.toFixed(2)}
                    <span className="text-gray-500 text-xs ml-2">(Consistency vs Expression)</span>
                    <InfoTooltip content="Controls how consistent your AI voice sounds between responses. Low values (0.0-0.4): More expressive and emotional—perfect for storytelling or dynamic conversations where you want variety, but it might sound slightly different each time. High values (0.6-1.0): Very consistent and predictable—ideal for professional settings, tutorials, or when you need the same tone every time, though it may sound somewhat monotonous." />
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={voiceSettings.stability}
                    onChange={(e) => updateVoiceSetting('stability', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Similarity */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Similarity: {voiceSettings.similarity_boost.toFixed(2)}
                    <span className="text-gray-500 text-xs ml-2">(Clarity + Enhancement)</span>
                    <InfoTooltip content="Determines how closely the AI tries to match your original cloned voice. Low values (0.0-0.4): The voice sounds cleaner and more generic—great if your original recording had background noise or imperfections. High values (0.6-1.0): Stays very faithful to your original voice's unique characteristics—perfect when you want it to sound exactly like you, but it might also replicate any quirks or artifacts from your training audio." />
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={voiceSettings.similarity_boost}
                    onChange={(e) => updateVoiceSetting('similarity_boost', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Style */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Style: {voiceSettings.style.toFixed(2)}
                    <span className="text-gray-500 text-xs ml-2">(Style Amplification)</span>
                    <InfoTooltip content="Amplifies your original speaker's natural delivery patterns and vocal characteristics. Low values (0.0): Maintains a natural, unmodified delivery. Higher values (0.3-1.0): Exaggerates your speaking style—useful for character voices or when you want a more dramatic, emphasized delivery, though it uses more processing power." />
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={voiceSettings.style}
                    onChange={(e) => updateVoiceSetting('style', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Speaker Boost */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="speaker-boost"
                    checked={voiceSettings.use_speaker_boost}
                    onChange={(e) => updateVoiceSetting('use_speaker_boost', e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor="speaker-boost" className="text-sm font-medium text-gray-700 flex items-center">
                    Speaker Boost
                    <span className="text-gray-500 text-xs ml-2">(Enhanced similarity - may increase latency)</span>
                    <InfoTooltip
                      position="bottom"
                      content="Enhanced similarity mode that makes the voice sound even more like the original speaker, but it increases processing time and may cause slight delays. Use this only when you need the highest possible voice fidelity and can tolerate the extra latency."
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          </>
          ) : (
            /* Patient Mode: Playback Speed Only */
            <div className="bg-gray-50 rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 text-gray-800">🎧 Playback Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Playback Speed: {patientPlaybackSpeed.toFixed(2)}x
                    <span className="text-gray-500 ml-2 text-xs">
                      {patientPlaybackSpeed < 1 ? '(Slower)' :
                       patientPlaybackSpeed > 1 ? '(Faster)' : '(Normal)'}
                    </span>
                    <InfoTooltip content="Adjust how fast or slow you want to hear the AI voice responses. This setting applies to all AI Previews you interact with." />
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={patientPlaybackSpeed}
                    onChange={(e) => setPatientPlaybackSpeed(parseFloat(e.target.value))}
                    className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0.5x (Much Slower)</span>
                    <span>1.0x (Normal)</span>
                    <span>2.0x (Much Faster)</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> This speed setting is just your personal preference and will override the provider&apos;s default speed setting. All other voice characteristics (tone, style, etc.) are set by each therapist.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors"
            >
              {saving ? '💾 Saving...' : isProviderMode ? '💾 Save AI Preview Settings' : '💾 Save Playback Preference'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}