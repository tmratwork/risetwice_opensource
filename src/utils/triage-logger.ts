import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'logs', 'triageSpecialistAI.log');

export interface TriageLogEntry {
  timestamp: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  category: 'HANDOFF' | 'API' | 'FUNCTION' | 'PROMPT' | 'DATABASE' | 'WEBRTC';
  operation: string;
  data?: Record<string, string | number | boolean | null>;
  error?: string;
  correlationId?: string;
  userId?: string;
  conversationId?: string;
  specialistType?: string;
}

export function logTriageEvent(entry: Omit<TriageLogEntry, 'timestamp'>) {
  const logEntry: TriageLogEntry = {
    ...entry,
    timestamp: new Date().toISOString()
  };

  const logLine = `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.category}] ${logEntry.operation}`;
  const details = JSON.stringify({
    ...(logEntry.data && { data: logEntry.data }),
    ...(logEntry.error && { error: logEntry.error }),
    ...(logEntry.correlationId && { correlationId: logEntry.correlationId }),
    ...(logEntry.userId && { userId: logEntry.userId }),
    ...(logEntry.conversationId && { conversationId: logEntry.conversationId }),
    ...(logEntry.specialistType && { specialistType: logEntry.specialistType })
  });

  const fullLogLine = `${logLine} ${details}\n`;

  try {
    // Check if logging is enabled via environment variable
    if (process.env.ENABLE_TRIAGE_SPECIALIST_LOGS !== 'true') {
      return;
    }

    // Ensure logs directory exists
    const logsDir = path.dirname(LOG_FILE_PATH);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Append to log file
    fs.appendFileSync(LOG_FILE_PATH, fullLogLine);
  } catch (error) {
    console.error('Failed to write to triage log file:', error);
  }
}

export function generateCorrelationId(): string {
  return `triage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}