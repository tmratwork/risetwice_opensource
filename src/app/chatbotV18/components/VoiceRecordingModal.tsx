'use client';

import React, { useEffect, useState } from 'react';

interface VoiceRecordingModalProps {
  isRecording: boolean;
  onCancel: () => void;
  onSend: () => void;
  duration: number; // in seconds
}

const VoiceRecordingModal: React.FC<VoiceRecordingModalProps> = ({
  isRecording,
  onCancel,
  onSend,
  duration
}) => {
  const [bars, setBars] = useState<number[]>([0.3, 0.5, 0.7, 0.5, 0.3, 0.5, 0.7, 0.5, 0.3, 0.5]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 0.7 + 0.3));
    }, 150);

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) return null;

  return (
    <div className="voice-recording-overlay">
      <div className="voice-recording-container">
        {/* Cancel Button */}
        <button
          className="voice-cancel-button"
          onClick={onCancel}
          aria-label="Cancel recording"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Audio Wave Animation */}
        <div className="voice-wave-section">
          <div className="voice-wave-bars">
            {bars.map((height, index) => (
              <div
                key={index}
                className="voice-wave-bar"
                style={{
                  height: `${height * 32}px`,
                }}
              />
            ))}
          </div>
          <span className="voice-timer">{formatTime(duration)}</span>
        </div>

        {/* Send Button */}
        <button
          className="voice-send-button"
          onClick={onSend}
          aria-label="Send message"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VoiceRecordingModal;
