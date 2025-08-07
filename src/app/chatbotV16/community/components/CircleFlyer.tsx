'use client';

import { X, Printer } from 'lucide-react';
import QRCodeGenerator from './QRCodeGenerator';

interface CircleFlyerProps {
  circle: {
    name: string;
    display_name: string;
    description?: string;
    welcome_message?: string;
  };
  joinUrl: string;
  qrCodeValue: string;
  onClose: () => void;
}

export default function CircleFlyer({
  circle,
  joinUrl,
  qrCodeValue,
  onClose,
}: CircleFlyerProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header - Hidden in print */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900">Circle Flyer</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Flyer Content */}
        <div className="p-8 print:p-6">
          <div className="text-center space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900 print:text-2xl">
                Join Our Circle
              </h1>
              <h2 className="text-xl text-blue-600 font-semibold">
                {circle.display_name}
              </h2>
            </div>

            {/* Description */}
            {circle.description && (
              <div className="bg-gray-50 rounded-lg p-4 print:bg-gray-100">
                <p className="text-gray-700 text-lg leading-relaxed">
                  {circle.description}
                </p>
              </div>
            )}

            {/* QR Code */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Scan to Join
              </h3>
              <div className="flex justify-center">
                <QRCodeGenerator
                  value={qrCodeValue}
                  size={180}
                  className="border-2 border-gray-300"
                />
              </div>
              <p className="text-sm text-gray-600">
                Scan this QR code with your phone&apos;s camera
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-4 text-left bg-blue-50 rounded-lg p-4 print:bg-blue-100">
              <h3 className="text-lg font-semibold text-gray-900">
                How to Join:
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-700">
                <li>Open your phone&apos;s camera app</li>
                <li>Point it at the QR code above</li>
                <li>Tap the notification that appears</li>
                <li>Fill out the short request form</li>
                <li>Wait for approval from the circle admin</li>
              </ol>
            </div>

            {/* Alternative Link */}
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900">
                Or visit this link:
              </h4>
              <div className="bg-gray-100 rounded p-2 break-all text-sm font-mono">
                {joinUrl}
              </div>
            </div>

            {/* Welcome Message */}
            {circle.welcome_message && (
              <div className="bg-green-50 rounded-lg p-4 print:bg-green-100">
                <h4 className="font-semibold text-green-900 mb-2">
                  Welcome Message:
                </h4>
                <p className="text-green-800 italic">
                  &quot;{circle.welcome_message}&quot;
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="text-xs text-gray-500 border-t border-gray-200 pt-4">
              <p>
                This is a private support circle. Your request to join will be reviewed by the circle administrator.
                All conversations are confidential and supportive.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:hidden {
            display: none !important;
          }
          .fixed .bg-white {
            position: static !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .fixed .bg-white * {
            visibility: visible;
          }
          .print\\:p-6 {
            padding: 1.5rem !important;
          }
          .print\\:text-2xl {
            font-size: 1.5rem !important;
            line-height: 2rem !important;
          }
          .print\\:bg-gray-100 {
            background-color: #f3f4f6 !important;
          }
          .print\\:bg-blue-100 {
            background-color: #dbeafe !important;
          }
          .print\\:bg-green-100 {
            background-color: #dcfce7 !important;
          }
        }
      `}</style>
    </div>
  );
}