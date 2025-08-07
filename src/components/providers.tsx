// /src/components/providers.tsx
'use client';

import { AuthProvider } from '@/contexts/auth-context';
import { UsageTrackingProvider } from '@/components/usage-tracking-provider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <UsageTrackingProvider>
                {children}
            </UsageTrackingProvider>
        </AuthProvider>
    );
}