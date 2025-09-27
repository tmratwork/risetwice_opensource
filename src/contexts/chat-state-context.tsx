'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Therapist {
  id: string;
  fullName: string;
  title: string;
  degrees: string[];
  primaryLocation: string;
  personalStatement?: string;
  mentalHealthSpecialties?: string[];
  treatmentApproaches?: string[];
  profilePhotoUrl?: string;
  yearsOfExperience?: string;
  languagesSpoken?: string[];
  genderIdentity?: string;
}

interface ChatStateContextType {
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  selectedTherapist: Therapist | null;
  setSelectedTherapist: (therapist: Therapist | null) => void;
}

const ChatStateContext = createContext<ChatStateContextType | undefined>(undefined);

interface ChatStateProviderProps {
  children: ReactNode;
}

export function ChatStateProvider({ children }: ChatStateProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState<Therapist | null>(null);

  const value: ChatStateContextType = {
    isConnected,
    setIsConnected,
    selectedTherapist,
    setSelectedTherapist,
  };

  return (
    <ChatStateContext.Provider value={value}>
      {children}
    </ChatStateContext.Provider>
  );
}

export function useChatState() {
  const context = useContext(ChatStateContext);
  if (context === undefined) {
    throw new Error('useChatState must be used within a ChatStateProvider');
  }
  return context;
}