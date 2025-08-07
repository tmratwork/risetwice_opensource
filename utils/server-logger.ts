import fs from 'fs';
import path from 'path';

interface ServerLogEntry {
  timestamp?: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: 'HANDOFF' | 'SESSION' | 'AUDIO' | 'API' | 'ERROR';
  operation: string;
  correlationId?: string;
  conversationId?: string;
  specialistType?: string;
  sessionId?: string;
  data?: Record<string, unknown>;
}

/**
 * Server-side logger for triage specialist AI handoffs
 * Logs to logs/triageSpecialistAI.log
 */
export function logTriageHandoffServer(entry: ServerLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.ENABLE_TRIAGE_SPECIALIST_LOGS !== 'true') {
      return;
    }

    const logEntry = {
      timestamp: entry.timestamp || new Date().toISOString(),
      level: entry.level,
      category: entry.category,
      operation: entry.operation,
      correlationId: entry.correlationId,
      conversationId: entry.conversationId,
      specialistType: entry.specialistType,
      sessionId: entry.sessionId,
      data: entry.data || {}
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    
    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Append to triageSpecialistAI.log
    const logFilePath = path.join(logsDir, 'triageSpecialistAI.log');
    fs.appendFileSync(logFilePath, logLine);
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[SERVER-LOGGER] Failed to write to log file:', error);
    console.log('[SERVER-LOGGER] Original log entry:', entry);
  }
}

/**
 * Helper function to create correlation IDs for tracking operations across multiple API calls
 */
export function createCorrelationId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Helper function to create handoff-specific correlation IDs
 */
export function generateHandoffCorrelationId(): string {
  return 'handoff_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2);
}