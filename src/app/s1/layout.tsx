// src/app/s1/layout.tsx
// S1 Layout with Authentication Provider (following V16 pattern)

"use client";

import React from 'react';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

// S1 Authentication User ID Sync (following V16 pattern)
function S1AuthUserIdSync() {
  const { user, loading, firebaseAvailable } = useAuth();

  React.useEffect(() => {
    if (!loading) {
      // Store authenticated user ID for S1 sessions
      if (user && firebaseAvailable) {
        localStorage.setItem('s1UserId', user.uid);
        console.log('[S1-AUTH] Set Firebase auth user ID:', user.uid);
      } else {
        // Clear userId if not logged in or Firebase unavailable
        localStorage.removeItem('s1UserId');
        if (!firebaseAvailable) {
          console.log('[S1-AUTH] Firebase unavailable - cleared userId, S1 will use fallback');
        } else {
          console.log('[S1-AUTH] No authenticated user, cleared userId');
        }
      }
    }
  }, [user, loading, firebaseAvailable]);

  return null;
}

export default function S1Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Header with auth status */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  S1 Therapy Training
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <AuthStatus />
              </div>
            </div>
          </div>
        </header>

        {/* S1 Authentication sync */}
        <S1AuthUserIdSync />
        
        {/* Main content */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}

// Auth status component (following V16 pattern)
function AuthStatus() {
  const { user, loading, firebaseAvailable, signInWithGoogle, signOut } = useAuth();

  if (loading) {
    return <div className="text-sm text-gray-500">Loading...</div>;
  }

  if (!firebaseAvailable) {
    return (
      <div className="text-sm text-orange-600">
        Firebase unavailable - using fallback mode
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center space-x-3">
        <span className="text-sm text-gray-700">
          {user.email || user.displayName || 'Authenticated'}
        </span>
        <button
          onClick={signOut}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700"
    >
      Sign In
    </button>
  );
}