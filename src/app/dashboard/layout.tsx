// src/app/dashboard/layout.tsx
// Dashboard layout with ThemeProvider

"use client";

import { AuthProvider } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </AuthProvider>
  );
}