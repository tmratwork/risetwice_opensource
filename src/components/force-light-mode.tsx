'use client';

import { useEffect } from 'react';

export function ForceLightMode() {
  useEffect(() => {
    // Force light mode on client mount
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.setAttribute('data-theme', 'light');

    // Clear any dark mode preference from localStorage
    try {
      localStorage.removeItem('theme');
      localStorage.setItem('theme', 'light');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return null;
}
