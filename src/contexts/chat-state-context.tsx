'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ChatStateContextType {
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  selectedTherapist: any | null;
  setSelectedTherapist: (therapist: any | null) => void;
}

const ChatStateContext = createContext<ChatStateContextType | undefined>(undefined);

interface ChatStateProviderProps {
  children: ReactNode;
}

export function ChatStateProvider({ children }: ChatStateProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [selectedTherapist, setSelectedTherapist] = useState<any | null>(null);

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