'use client';

import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
  className?: string;
}

export default function QRCodeGenerator({
  value,
  size = 256,
  level = 'M',
  includeMargin = true,
  className = '',
}: QRCodeGeneratorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div 
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="text-gray-500 text-sm">Loading QR Code...</div>
      </div>
    );
  }

  return (
    <div className={`bg-white p-4 rounded-lg shadow-sm ${className}`}>
      <QRCodeSVG
        value={value}
        size={size}
        level={level}
        includeMargin={includeMargin}
        className="border border-gray-200 rounded"
      />
    </div>
  );
}