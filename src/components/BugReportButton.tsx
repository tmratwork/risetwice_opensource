// src/components/BugReportButton.tsx
"use client";

import { useState } from 'react';
import BugReportModal from './BugReportModal';

interface BugReportButtonProps {
  className?: string;
}

export default function BugReportButton({ className = '' }: BugReportButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={`bug-report-button ${className}`}
        title="Send Feedback"
        aria-label="Send Feedback"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flag">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" x2="4" y1="22" y2="15" />
        </svg>
      </button>

      {isModalOpen && (
        <BugReportModal
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}