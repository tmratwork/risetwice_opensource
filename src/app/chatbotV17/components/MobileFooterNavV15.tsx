'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import BugReportModal from '@/components/BugReportModal';

interface MobileFooterNavV15Props {
  onToggleDebugPanel?: () => void;
}

export function MobileFooterNavV15({ }: MobileFooterNavV15Props = {}) {
  const pathname = usePathname();
  const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);

  return (
    <nav className="bg-white dark:bg-[#131314] border-t border-sage-400 dark:border-gray-800 flex justify-around items-center px-4 py-3">
      <Link
        href="/chatbotV16"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV16' || pathname.startsWith('/chatbotV16/') ? 'text-sage-500 dark:text-white font-bold' : 'text-gray-700 dark:text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname === '/chatbotV16' || pathname.startsWith('/chatbotV16/') ? "3" : "2"} strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
        </svg>
        <span className="text-center">AI Companion</span>
      </Link>

      <Link
        href="/chatbotV17"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV17' || pathname.startsWith('/chatbotV17/') ? 'text-sage-500 dark:text-white font-bold' : 'text-gray-700 dark:text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname === '/chatbotV17' || pathname.startsWith('/chatbotV17/') ? "3" : "2"} strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <path d="M12 7v6" />
          <path d="M9 10h6" />
        </svg>
        <span className="text-center">Therapy Match</span>
      </Link>


      {/* Bug Report Modal */}
      {isBugReportModalOpen && (
        <BugReportModal
          onClose={() => setIsBugReportModalOpen(false)}
        />
      )}
    </nav>
  );
}