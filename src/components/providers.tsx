// /src/components/providers.tsx
'use client';

import { AuthProvider } from '@/contexts/auth-context';
import { UsageTrackingProvider } from '@/components/usage-tracking-provider';
import { ForceLightMode } from '@/components/force-light-mode';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <UsageTrackingProvider>
                <ForceLightMode />
                {children}
            </UsageTrackingProvider>
        </AuthProvider>
    );
}