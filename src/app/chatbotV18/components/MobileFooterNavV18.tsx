'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Handshake, BookUser } from 'lucide-react';

export function MobileFooterNavV18() {
  const pathname = usePathname();

  return (
    <nav className="bg-white dark:bg-[#131314] border-t border-sage-400 dark:border-gray-700 flex px-4 py-3 relative">
      <Link
        href="/chatbotV18/p1"
        className={`flex-1 flex flex-col items-center text-xs relative ${pathname === '/chatbotV18/p1' || pathname.startsWith('/chatbotV18/p1') ? 'text-green-600 dark:text-green-500 font-bold' : 'text-gray-500 dark:text-gray-400'}`}
      >
        {/* Active tab indicator line */}
        {(pathname === '/chatbotV18/p1' || pathname.startsWith('/chatbotV18/p1')) && (
          <div className="absolute -top-3 left-0 right-0 h-1 bg-green-600 dark:bg-green-500 rounded-full"></div>
        )}
        <Handshake
          size={24}
          strokeWidth={pathname === '/chatbotV18/p1' || pathname.startsWith('/chatbotV18/p1') ? 3 : 2}
          className="mb-1"
        />
        <span className="text-center">Match</span>
      </Link>

      <Link
        href="/chatbotV17"
        className={`flex-1 flex flex-col items-center text-xs relative ${pathname === '/chatbotV17' || pathname.startsWith('/chatbotV17/') ? 'text-green-600 dark:text-green-500 font-bold' : 'text-gray-500 dark:text-gray-400'}`}
      >
        {/* Active tab indicator line */}
        {(pathname === '/chatbotV17' || pathname.startsWith('/chatbotV17/')) && (
          <div className="absolute -top-3 left-0 right-0 h-1 bg-green-600 dark:bg-green-500 rounded-full"></div>
        )}
        <BookUser
          size={24}
          strokeWidth={pathname === '/chatbotV17' || pathname.startsWith('/chatbotV17/') ? 3 : 2}
          className="mb-1"
        />
        <span className="text-center">Directory</span>
      </Link>
    </nav>
  );
}
