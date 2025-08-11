// Mobile app types adapted from V16 web app

export interface User {
  uid: string;
  email?: string;
  displayName?: string;
  isAnonymous: boolean;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isFinal: boolean;
  status?: 'speaking' | 'processing' | 'final' | 'thinking';
  specialist?: string;
}

export interface TriageSession {
  sessionId: string;
  currentSpecialist: string | null;
  conversationId: string | null;
  contextSummary?: string;
  isHandoffPending: boolean;
}

export interface AIPrompt {
  id: string;
  type: string;
  content: string;
  voice_settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ResourceLocatorContext {
  source: string;
  timestamp: number;
  mode: string;
  selectedResource: {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    functionName: string;
    category: string;
    parameters: Record<string, unknown>;
  };
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface WebRTCStoreState {
  isConnected: boolean;
  connectionState: ConnectionState;
  isPreparing: boolean;
  currentVolume: number;
  audioLevel: number;
  isAudioPlaying: boolean;
  isThinking: boolean;
  isMuted: boolean;
  isAudioOutputMuted: boolean;
  conversation: ConversationMessage[];
  triageSession: TriageSession | null;
  resourceLocatorContext: ResourceLocatorContext | null;
}

export interface ChatMode {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  specialist?: string;
}

export interface NavigationProps {
  navigation: any;
  route: any;
}

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

export interface ConnectionConfig {
  url: string;
  apiKey: string;
  model: string;
  voice: string;
  instructions: string;
  functions?: any[];
}