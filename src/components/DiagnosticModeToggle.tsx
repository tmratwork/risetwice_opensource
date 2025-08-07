// src/components/DiagnosticModeToggle.tsx
'use client';

import { useState, useEffect } from 'react';

interface DiagnosticModeToggleProps {
  onToggle: (enabled: boolean) => void;
}

export const DiagnosticModeToggle = ({ onToggle }: DiagnosticModeToggleProps) => {
  const [enabled, setEnabled] = useState(false);

  // Check for URL parameter or localStorage setting on mount
  useEffect(() => {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const diagnosticParam = urlParams.get('diagnostic');
    
    // Check localStorage
    const storedSetting = localStorage.getItem('livingBooks_diagnosticMode');
    
    // Determine if diagnostic mode should be enabled
    const shouldEnable = 
      diagnosticParam === 'true' || 
      storedSetting === 'true';
    
    setEnabled(shouldEnable);
    onToggle(shouldEnable);
    
    // If URL parameter is present, update localStorage
    if (diagnosticParam === 'true' || diagnosticParam === 'false') {
      localStorage.setItem('livingBooks_diagnosticMode', diagnosticParam);
    }
  }, [onToggle]);

  const handleToggle = () => {
    const newState = !enabled;
    setEnabled(newState);
    localStorage.setItem('livingBooks_diagnosticMode', newState.toString());
    onToggle(newState);
  };

  return (
    <div className="flex items-center justify-between bg-gray-200 p-3 rounded-lg mb-4 border border-gray-300">
      <span className="text-sm font-medium text-gray-800">Diagnostic Mode</span>
      <button
        onClick={handleToggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          enabled ? 'bg-blue-600' : 'bg-gray-400'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};