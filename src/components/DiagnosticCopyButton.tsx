'use client';

import { useState } from 'react';

interface DiagnosticCopyButtonProps {
  textToCopy: string;
}

export const DiagnosticCopyButton = ({ textToCopy }: DiagnosticCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 bg-gray-200 hover:bg-gray-300 rounded text-xs text-gray-800 transition"
      title="Copy to clipboard"
    >
      {isCopied ? 'Copied!' : 'Copy'}
    </button>
  );
};