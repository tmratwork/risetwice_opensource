// src/app/dashboard/layout.tsx
// Dashboard layout with ThemeProvider and Footer

"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { MobileFooterNavV15 } from '@/app/chatbotV16/components/MobileFooterNavV15';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      {/* Main Content */}
      {children}

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <MobileFooterNavV15 />
      </div>
    </AuthProvider>
  );
}