// file: src/app/chatbotV16/community/layout.tsx

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Community - Risetwice.com',
  description: 'Connect, share, and support',
};

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}