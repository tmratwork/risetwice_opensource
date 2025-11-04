// src/app/chatbotV17/intake/layout.tsx
import React from 'react';

export default function V17IntakeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use absolute positioning to escape the parent overflow:hidden constraints
  // This allows the intake form to scroll independently
  return (
    <div className="absolute inset-0 bg-gray-50 overflow-y-auto">
      {children}
    </div>
  );
}
