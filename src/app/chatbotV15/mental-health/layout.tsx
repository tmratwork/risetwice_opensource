import React from 'react';

export default function MentalHealthV15Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      {/* Remove MobileFooterNavV15 - it's already in parent layout */}
    </>
  );
}