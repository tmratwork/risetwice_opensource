"use client";

import { useEffect, useState } from 'react';

export function ThemeDebug() {
  const [computedStyles, setComputedStyles] = useState<Record<string, string>>({});
  
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const styles = window.getComputedStyle(document.documentElement);
      const bgColor = styles.getPropertyValue('--background') || 'not set';
      const bgPrimary = styles.getPropertyValue('--bg-primary') || 'not set';
      const bgSecondary = styles.getPropertyValue('--bg-secondary') || 'not set';
      const actualBgColor = window.getComputedStyle(document.body).backgroundColor;
      
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      setComputedStyles({
        '--background': bgColor.trim(),
        '--bg-primary': bgPrimary.trim(),
        '--bg-secondary': bgSecondary.trim(),
        'body.backgroundColor': actualBgColor,
        'darkModeClass': isDarkMode ? 'Applied' : 'Not Applied',
        'htmlClasses': document.documentElement.className
      });
    }
  }, []);

  // Don't render on server
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className="mt-4 p-2 bg-black/50 rounded text-xs">
      <h4 className="text-sm font-semibold">Theme Variables:</h4>
      {Object.entries(computedStyles).map(([key, value]) => (
        <p key={key}>
          <span className="text-cyan-400">{key}:</span> {value}
        </p>
      ))}
    </div>
  );
}

// This standalone version can be used for debugging outside the debug panel
export function StandaloneThemeDebug() {
  const [computedStyles, setComputedStyles] = useState<Record<string, string>>({});
  
  useEffect(() => {
    // Only run on client side
    if (typeof window !== 'undefined') {
      const styles = window.getComputedStyle(document.documentElement);
      const bgColor = styles.getPropertyValue('--background') || 'not set';
      const bgPrimary = styles.getPropertyValue('--bg-primary') || 'not set';
      const bgSecondary = styles.getPropertyValue('--bg-secondary') || 'not set';
      const actualBgColor = window.getComputedStyle(document.body).backgroundColor;
      
      const isDarkMode = document.documentElement.classList.contains('dark');
      
      setComputedStyles({
        '--background': bgColor.trim(),
        '--bg-primary': bgPrimary.trim(),
        '--bg-secondary': bgSecondary.trim(),
        'body.backgroundColor': actualBgColor,
        'darkModeClass': isDarkMode ? 'Applied' : 'Not Applied',
        'htmlClasses': document.documentElement.className
      });
    }
  }, []);

  // Don't render on server
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 p-4 bg-white dark:bg-gray-800 text-black dark:text-white rounded-tr-lg shadow-lg z-50 text-xs">
      <h3 className="font-bold mb-2">Theme Debug</h3>
      <pre className="whitespace-pre-wrap">
        {Object.entries(computedStyles).map(([key, value]) => (
          `${key}: ${value}\n`
        ))}
      </pre>
    </div>
  );
}