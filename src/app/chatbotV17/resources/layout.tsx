import React from 'react';

export default function ResourcesV17Layout({
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