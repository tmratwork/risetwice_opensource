// src/app/dashboard/layout.tsx
// Dashboard layout with ThemeProvider and Footer

"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { MobileFooterNavV18 } from '@/app/chatbotV18/components/MobileFooterNavV18';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      {/* Main Content */}
      {children}

      {/* Fixed Footer - Conditional based on deployment */}
      {process.env.NEXT_PUBLIC_FOOTER_TYPE !== 'none' && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <MobileFooterNavV18 />
        </div>
      )}
    </AuthProvider>
  );
}