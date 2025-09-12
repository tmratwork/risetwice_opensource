// src/app/s2/components/WelcomeScreen.tsx
// Welcome screen for S2 Case Simulation

"use client";

import React from 'react';

interface WelcomeScreenProps {
  onNext: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl font-bold text-gray-900">🌱 RiseTwice</span>
              </div>
            </div>
            <nav className="flex space-x-8">
              <a href="#" className="text-gray-500 hover:text-gray-900">For Providers</a>
              <a href="#" className="text-gray-500 hover:text-gray-900">For Clients</a>
              <a href="#" className="text-gray-900 font-medium">Log In</a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Welcome to RiseTwice Therapy Match
          </h1>
          
          <p className="text-lg text-gray-600 mb-12 leading-relaxed">
            We&apos;re excited to have you join our network of therapists. This 
            onboarding process will help us gather the information we 
            need to match you with clients seeking support. Let&apos;s get 
            started!
          </p>
          
          <button
            onClick={onNext}
            className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 transition-colors duration-200 shadow-lg"
          >
            Get Started
            <svg className="ml-2 -mr-1 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
};

export default WelcomeScreen;