"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { ClientHeader } from '@/components/client-header';
import { MobileFooterNavV18 } from '../chatbotV18/components/MobileFooterNavV18';
import '../chatbotV18/chatbotV16.css';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="v16-layout-root">
        {/* Header Row */}
        <div className="header-row">
          <ClientHeader />
        </div>

        {/* Main Content Row */}
        <div className="main-content-row">
          {children}
        </div>

        {/* Footer Row */}
        <div className="footer-row">
          <MobileFooterNavV18 />
        </div>
      </div>
    </AuthProvider>
  );
}
