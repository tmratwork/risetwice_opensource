// src/app/s2/layout.tsx
// S2 Case Simulation Layout

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'S2 Case Simulation - RiseTwice',
  description: 'AI-powered therapy case simulation and practice platform',
};

export default function S2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}