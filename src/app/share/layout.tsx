'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Providers } from '@/components/providers';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Check if this is a warm-handoff page (warmhandoff-v15-* pattern)
  const isWarmHandoffPage = pathname.includes('/summary/warmhandoff-v15-');
  
  // For warm-handoff pages, don't show the "Shared Insights" header
  // since the page itself will handle the V16 header
  if (isWarmHandoffPage) {
    return (
      <Providers>
        {children}
      </Providers>
    );
  }
  
  // For other share pages, show the original "Shared Insights" header
  return (
    <Providers>
      <main className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <header className="bg-white dark:bg-gray-800 py-4 px-6 shadow-md mb-6">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <img src="/livingBooks.svg" alt="Living Books" className="h-10 w-auto" />
              <h1 className="ml-2 text-lg font-medium text-gray-900 dark:text-gray-100">Shared Insights</h1>
            </div>
          </div>
        </header>
        {children}
      </main>
    </Providers>
  );
}