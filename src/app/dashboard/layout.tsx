// src/app/dashboard/layout.tsx
// Dashboard layout with ThemeProvider and Footer

"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { MobileFooterNavV15 } from '@/app/chatbotV16/components/MobileFooterNavV15';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="dashboard-layout-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Main Content */}
          <div style={{ flex: '1' }}>
            {children}
          </div>

          {/* Footer */}
          <MobileFooterNavV15 />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}