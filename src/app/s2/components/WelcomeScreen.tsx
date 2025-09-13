// src/app/s2/components/WelcomeScreen.tsx
// Welcome screen for S2 Case Simulation

"use client";

import React from 'react';

interface WelcomeScreenProps {
  onNext: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-16" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
          RiseTwice Therapy Match
        </h1>
        
        <h2 className="text-2xl mb-8" style={{ color: 'var(--text-secondary)' }}>
          Ensuring a better fit from day one
        </h2>
        
        <p className="text-lg mb-12 leading-relaxed max-w-4xl" style={{ color: 'var(--text-secondary)' }}>
          Welcome! This onboarding process will help you create a <strong>Personalized AI Preview</strong>—an 
          interactive, voice-cloned sample of your communication style that allows potential patients to 
          find the right provider fit with confidence. In the next 15 minutes, you will be asked to provide 
          some basic information, describe your ideal patient, and record a brief session that we&apos;ll use 
          to capture the essence of your practice.
        </p>
        
        <button
          onClick={onNext}
          className="control-button primary large-button"
        >
          Get Started
          <svg className="ml-2 -mr-1 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;