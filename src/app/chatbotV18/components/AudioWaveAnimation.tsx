'use client';

import React, { useEffect, useState } from 'react';
import { useWebRTCStore } from '@/stores/webrtc-store';

const AudioWaveAnimation = () => {
  const [bars, setBars] = useState<number[]>([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);

  useEffect(() => {
    const animate = () => {
      const { isUserSpeaking, userAudioLevel } = useWebRTCStore.getState();

      if (isUserSpeaking) {
        // Scale up the audio level (it's 0.0-0.2, we want 0.5-1.0)
        const intensity = Math.min(userAudioLevel * 5, 1.0);
        setBars(prev => prev.map(() => {
          const random = Math.random() * 0.4 + 0.4; // 0.4-0.8
          return random * Math.max(intensity, 0.6); // minimum 0.6 for visibility
        }));
      } else {
        // Flat/low bars when not speaking - shows no audio activity
        setBars([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]);
      }
    };

    // Animate at 10fps (every 100ms)
    const animationInterval = setInterval(animate, 100);

    return () => clearInterval(animationInterval);
  }, []);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: '4px',
      height: '40px',
      width: '100%'
    }}>
      {bars.map((height, index) => (
        <div
          key={index}
          style={{
            width: '6px',
            height: `${height * 32}px`, // Max 32px (0.9 * 32 = 28.8px)
            background: '#9dbbac', // Explicit color, not CSS variable
            borderRadius: '2px',
            transition: 'height 0.1s ease-out'
          }}
        />
      ))}
    </div>
  );
};

export default AudioWaveAnimation;
