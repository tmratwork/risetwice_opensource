'use client';

import React, { useEffect, useState } from 'react';

interface AudioWaveAnimationProps {
  isConnected: boolean;
}

const AudioWaveAnimation: React.FC<AudioWaveAnimationProps> = ({ isConnected }) => {
  const [bars, setBars] = useState<number[]>([0.3, 0.5, 0.7, 0.5, 0.3, 0.5, 0.7, 0.5]);

  useEffect(() => {
    if (!isConnected) return;

    // Animate bars with random heights to simulate audio activity
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 0.8 + 0.2));
    }, 150);

    return () => clearInterval(interval);
  }, [isConnected]);

  return (
    <div className="audio-wave-display">
      {bars.map((height, index) => (
        <div
          key={index}
          className="audio-wave-bar"
          style={{
            height: `${height * 100}%`,
            transition: 'height 0.15s ease-in-out',
          }}
        />
      ))}
    </div>
  );
};

export default AudioWaveAnimation;
