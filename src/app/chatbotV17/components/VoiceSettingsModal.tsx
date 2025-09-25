// src/app/chatbotV17/components/VoiceSettingsModal.tsx
// ElevenLabs Conversational AI Voice Settings Modal for V17

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useElevenLabsStore } from '@/stores/elevenlabs-store';

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


const MODEL_FAMILIES = [
  { id: 'same_as_agent', name: 'Same as Agent Default' },
  { id: 'flash', name: 'Flash (Fastest)' },
  { id: 'turbo', name: 'Turbo (Balanced)' },
  { id: 'multilingual', name: 'Multilingual (Highest Quality)' },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
];

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
  const store = useElevenLabsStore();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Voice configuration state
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    speed: 1.0,
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: false,
  });

  const [modelFamily, setModelFamily] = useState('same_as_agent');
  const [language, setLanguage] = useState('en');

  // Load current settings when modal opens
  useEffect(() => {
    const loadCurrentSettings = async () => {
      if (!isOpen) return;

      try {
        if (store.agentId) {
          // Load from active agent
          setStatus('📖 Loading agent settings...');

          const response = await fetch(`/api/v17/voice-settings?agent_id=${store.agentId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setVoiceSettings(data.voice_settings);
              setModelFamily(data.model_family || 'same_as_agent');
              setLanguage(data.language || 'en');
              setStatus('✅ Agent settings loaded successfully');
            }
          } else {
            setStatus('⚠️ Using default settings');
          }
        } else {
          // Load from localStorage preferences
          setStatus('📖 Loading saved preferences...');

          const savedPreferences = localStorage.getItem('v17_voice_preferences');
          if (savedPreferences) {
            try {
              const preferences = JSON.parse(savedPreferences);
              setVoiceSettings(preferences.voice_settings);
              setModelFamily(preferences.model_family || 'same_as_agent');
              setLanguage(preferences.language || 'en');
              setStatus('✅ Saved preferences loaded successfully');
            } catch (parseError) {
              console.error('Failed to parse saved preferences:', parseError);
              setStatus('⚠️ Using default settings');
            }
          } else {
            setStatus('💡 No saved preferences found - using defaults');
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
  }, [isOpen, store.agentId]);

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
    try {
      setSaving(true);

      if (store.agentId) {
        // Save to active agent
        setStatus('💾 Saving voice settings to active agent...');

        const response = await fetch('/api/v17/voice-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: store.agentId,
            voice_settings: voiceSettings,
            model_family: modelFamily,
            language: language
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save voice settings');
        }

        setStatus('✅ Voice settings saved to active agent successfully!');
      } else {
        // Save to localStorage as preferences
        setStatus('💾 Saving voice preferences...');

        const preferences = {
          voice_settings: voiceSettings,
          model_family: modelFamily,
          language: language,
          saved_at: new Date().toISOString()
        };

        localStorage.setItem('v17_voice_preferences', JSON.stringify(preferences));
        setStatus('✅ Voice preferences saved! They will be applied when you start a conversation.');

        // Close modal after saving preferences
        setTimeout(() => {
          onClose();
        }, 1500); // Give user time to see the success message
      }
    } catch (error) {
      console.error('Save settings error:', error);
      setStatus('❌ Error saving settings');
    } finally {
      setSaving(false);
    }
  };


  if (!isOpen) return null;

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
                Advanced Voice Settings
              </h1>
              <p className="text-gray-600 mt-1">
                Customize your ElevenLabs conversational AI voice
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


          {/* Voice Quality Settings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">🎛️ Voice Quality Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Speed Control */}
              <div className="space-y-3">
                <h3 className="text-base font-medium text-gray-800">⚡ Speed Control</h3>
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
                <h3 className="text-base font-medium text-gray-800">🎯 Voice Quality</h3>

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

          {/* Model and Language Settings */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">🔧 Model & Language Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Model Family */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Model Family</label>
                <select
                  value={modelFamily}
                  onChange={(e) => setModelFamily(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-800"
                >
                  {MODEL_FAMILIES.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">Language</label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg text-gray-800"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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
              {saving ? '💾 Saving...' : store.agentId ? '💾 Save Settings' : '💾 Save as Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}