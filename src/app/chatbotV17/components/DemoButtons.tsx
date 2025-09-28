// src/app/chatbotV17/components/DemoButtons.tsx
// AI Preview Demo Buttons - Separate component for easy removal/transfer

"use client";

import React from 'react';

interface DemoButtonsProps {
  onDemoStart: (voiceId: string, promptAppend: string, doctorName: string) => void;
  isPreparing: boolean;
}

export function DemoButtons({ onDemoStart, isPreparing }: DemoButtonsProps) {
  return (
    <div className="demo-buttons-container mb-6">
    </div>
  );
}

