// src/app/s2/layout.tsx
// S2 Case Simulation Layout

"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { ClientHeader } from '@/components/client-header';
// Import V16 CSS styles to match chatbotV16 appearance
import '../chatbotV16/chatbotV16.css';
import '../chatbotV16/chatbotV15.css';

// Note: metadata export removed due to "use client" directive
// This will need to be handled differently if SEO metadata is required

export default function S2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="v16-layout-root">
        {/* Header Row - exact same as chatbotV17 */}
        <div className="header-row">
          <ClientHeader />
        </div>

        {/* Main Content Row - exact same as chatbotV17 */}
        <div className="main-content-row">
          <div style={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch'
          }}>
            {children}
          </div>
        </div>

        {/* Footer Row - empty for S2 but maintaining structure */}
        <div className="footer-row">
          {/* S2 doesn't need footer nav, but keeping the row for consistent layout */}
        </div>
      </div>
    </AuthProvider>
  );
}