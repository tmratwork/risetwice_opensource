'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { EllipsisVertical } from 'lucide-react';
import BugReportModal from './BugReportModal';
import { useTheme } from '@/contexts/theme-context';

interface MobileFooterNavProps {
  onToggleDebugPanel?: () => void;
  showDebugPanel?: boolean;
}

export function MobileFooterNav({ onToggleDebugPanel, showDebugPanel }: MobileFooterNavProps = {}) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  return (
    <nav className="bg-[#131314] border-t border-gray-800 flex justify-around items-center px-4 py-3">
      <Link
        href="/chatbotV16"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV16' || pathname.startsWith('/chatbotV16/') ? 'text-white' : 'text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
        </svg>
        <span>AI Companion</span>
      </Link>

      <Link
        href="/chatbotV17"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV17' || pathname.startsWith('/chatbotV17/') ? 'text-white' : 'text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <path d="M12 7v6" />
          <path d="M9 10h6" />
        </svg>
        <span>Therapy Match</span>
      </Link>

      {/* Menu overflow button */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex flex-col items-center text-xs text-gray-400 hover:text-white"
          aria-label="Menu"
        >
          <EllipsisVertical size={24} />
        </button>

        {/* Dropdown menu */}
        {isMenuOpen && (
          <>
            {/* Backdrop to close menu */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Menu content */}
            <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1b] border border-gray-700 rounded-lg shadow-lg min-w-48 z-50">
              <div className="py-2">
                {/* Theme Toggle */}
                <div className="px-4 py-2 hover:bg-gray-700 cursor-pointer" onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                  setIsMenuOpen(false);
                }}>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    {theme === 'dark' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-300">
                        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                        <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </div>
                </div>

                {/* Bug Report Button */}
                <div className="px-4 py-2 hover:bg-gray-700 cursor-pointer" onClick={() => {
                  setIsBugReportModalOpen(true);
                  setIsMenuOpen(false);
                }}>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-flag">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" x2="4" y1="22" y2="15" />
                    </svg>
                    <span>Send Feedback</span>
                  </div>
                </div>

                {/* Debug Panel Toggle */}
                {onToggleDebugPanel && (
                  <button
                    onClick={() => {
                      onToggleDebugPanel();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-3"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4" />
                      <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" />
                      <path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3" />
                      <path d="M13 12h3" />
                      <path d="M5 12h3" />
                    </svg>
                    {showDebugPanel ? 'Hide Debug Panel' : 'Show Debug Panel'}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bug Report Modal */}
      {isBugReportModalOpen && (
        <BugReportModal
          onClose={() => setIsBugReportModalOpen(false)}
        />
      )}
    </nav>
  );
}