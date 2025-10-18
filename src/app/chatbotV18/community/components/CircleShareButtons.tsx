'use client';

import { useState } from 'react';
import { Share2, Copy, Download, Printer, CheckCircle } from 'lucide-react';

interface CircleShareButtonsProps {
  joinUrl: string;
  circleName: string;
  circleDescription?: string;
  qrCodeRef?: React.RefObject<HTMLDivElement | null>;
  onPrintFlyer?: () => void;
}

export default function CircleShareButtons({
  joinUrl,
  circleName,
  circleDescription,
  qrCodeRef,
  onPrintFlyer,
}: CircleShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeRef?.current) return;

    const svg = qrCodeRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${circleName.replace(/\s+/g, '_')}_QR_Code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handleShare = async () => {
    const shareData = {
      title: `Join ${circleName}`,
      text: circleDescription || `Join the ${circleName} circle`,
      url: joinUrl,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback to copy link
        await handleCopyLink();
      }
    } catch (error) {
      console.error('Error sharing:', error);
      await handleCopyLink();
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {/* Copy Link Button */}
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
      >
        {copied ? (
          <>
            <CheckCircle className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="w-4 h-4" />
            Copy Link
          </>
        )}
      </button>

      {/* Share Button */}
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
      >
        <Share2 className="w-4 h-4" />
        Share
      </button>

      {/* Download QR Code */}
      {qrCodeRef && (
        <button
          onClick={handleDownloadQR}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          Download QR
        </button>
      )}

      {/* Print Flyer */}
      {onPrintFlyer && (
        <button
          onClick={onPrintFlyer}
          className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
        >
          <Printer className="w-4 h-4" />
          Print Flyer
        </button>
      )}
    </div>
  );
}