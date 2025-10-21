// src/app/s2/components/WelcomeScreen.tsx
// Welcome screen for S2 Case Simulation

"use client";

import React, { useState } from 'react';

interface WelcomeScreenProps {
  onNext: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleCodeSubmit = () => {
    if (!code.trim()) {
      setErrorMessage('Please enter a code.');
      return;
    }

    // Placeholder: Show error message for any code entered
    setErrorMessage('This code does not match any patient intake recordings. Please contact the developers if you think this message is in error.');
  };

  if (showCodeInput) {
    return (
      <div className="flex-1 flex items-center justify-center px-4" style={{ backgroundColor: '#c1d7ca', paddingTop: '100px', paddingBottom: '80px' }}>
        <div className="w-full max-w-md">
          <h1 className="text-4xl font-normal mb-8 text-center" style={{ color: '#000000' }}>
            Enter Your Code
          </h1>

          <div className="bg-white rounded-2xl p-8">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Enter code"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-lg mb-4 focus:outline-none focus:border-black"
            />

            {errorMessage && (
              <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                <p className="text-red-800 font-medium">{errorMessage}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCodeInput(false);
                  setCode('');
                  setErrorMessage('');
                }}
                className="flex-1 px-6 py-3 rounded-lg font-bold text-lg border-2 border-black bg-white text-black"
              >
                Back
              </button>
              <button
                onClick={handleCodeSubmit}
                className="flex-1 px-6 py-3 rounded-lg font-bold text-lg bg-black text-white"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center px-4" style={{ backgroundColor: '#c1d7ca', paddingTop: '100px', paddingBottom: '80px' }}>
      <div className="w-full max-w-6xl">
        <h1 className="text-5xl font-normal mb-16 text-left" style={{ color: '#000000' }}>
          How it works
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-black flex items-center justify-center text-white text-2xl font-bold">
              1
            </div>
            <div className="bg-white rounded-2xl p-6 flex-1">
              <h3 className="text-xl font-bold mb-3 text-gray-900">Get Qualified Referrals</h3>
              <p className="text-gray-800 leading-relaxed">
                We notify you when a new patient, whose needs match your practice, is looking for care.
                We will also let you know if their first sessions are covered by our nonprofit fund.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-black flex items-center justify-center text-white text-2xl font-bold">
              3
            </div>
            <div className="bg-white rounded-2xl p-6 flex-1">
              <h3 className="text-xl font-bold mb-3 text-gray-900">Record Your Pitch</h3>
              <p className="text-gray-800 leading-relaxed">
                Create a free profile and record a short, private voice message to introduce yourself.
                This is your chance to make a personal connection and show why you&apos;re a good fit.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-black flex items-center justify-center text-white text-2xl font-bold">
              2
            </div>
            <div className="bg-white rounded-2xl p-6 flex-1">
              <h3 className="text-xl font-bold mb-3 text-gray-900">Review the Patient&apos;s Intake</h3>
              <p className="text-gray-800 leading-relaxed">
                Use your uniue code to listen to the patient&apos;s intake and a summary of their preferences.
                No more guesswork- you know what they&apos;re looking for upfront.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-16 h-16 rounded-full bg-black flex items-center justify-center text-white text-2xl font-bold">
              4
            </div>
            <div className="bg-white rounded-2xl p-6 flex-1">
              <h3 className="text-xl font-bold mb-3 text-gray-900">Get Chosen</h3>
              <p className="text-gray-800 leading-relaxed">
                The patient reviews all voice intros and contacts the therapist they prefer.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => setShowCodeInput(true)}
            className="px-8 py-4 rounded-lg font-bold text-xl"
            style={{ backgroundColor: '#fbbf24', color: '#000000' }}
          >
            Enter Code
          </button>
          <button
            onClick={onNext}
            className="px-8 py-4 rounded-lg font-bold text-xl bg-black text-white"
          >
            Get started without a code
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;