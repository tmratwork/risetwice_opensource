import fs from 'fs';
import path from 'path';

interface ServerLogEntry {
  timestamp?: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  category: string;
  operation: string;
  correlationId?: string;
  userId?: string;
  conversationId?: string;
  specialistType?: string;
  data?: Record<string, unknown>;
  error?: string;
}

interface ProgressLogEntry {
  timestamp?: string;
  level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG';
  category: string;
  operation: string;
  requestId: string;
  userId?: string;
  stage?: string;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Server-side logger for triage specialist AI handoff system
 * Logs to logs/triageSpecialistAI.log with structured format
 */
export function logTriageHandoffServer(entry: ServerLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_TRIAGE_HANDOFF_LOGS !== 'true') {
      return;
    }

    // Skip file logging in production due to read-only filesystem
    if (process.env.NODE_ENV !== 'production') {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Format log entry
      const logLine = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      }) + '\n';

      // Append to log file
      const logFile = path.join(logsDir, 'triageSpecialistAI.log');
      fs.appendFileSync(logFile, logLine);
    }

    // Always log to console with prefix
    const consoleMessage = `[triageAI][handoff] ${entry.level}: ${entry.operation}`;
    console.log(consoleMessage, {
      correlationId: entry.correlationId,
      conversationId: entry.conversationId,
      specialistType: entry.specialistType,
      data: entry.data,
      error: entry.error
    });
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[triageAI][handoff] ERROR: Failed to write to log file', error);
    console.log('[triageAI][handoff] FALLBACK:', entry);
  }
}

/**
 * Generate correlation ID for tracking handoff operations
 */
export function generateHandoffCorrelationId(): string {
  return `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Server-side logger for user memory/profile context
 * Logs to logs/userMemory.log with structured format
 */
export function logUserMemoryServer(entry: ServerLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_USER_MEMORY_LOGS !== 'true') {
      return;
    }

    // Skip file logging in production due to read-only filesystem
    if (process.env.NODE_ENV !== 'production') {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Format log entry
      const logLine = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      }) + '\n';

      // Append to log file
      const logFile = path.join(logsDir, 'userMemory.log');
      fs.appendFileSync(logFile, logLine);
    }

    // Always log to console with prefix
    const consoleMessage = `[user_memory] ${entry.level}: ${entry.operation}`;
    console.log(consoleMessage, {
      userId: entry.userId,
      conversationId: entry.conversationId,
      specialistType: entry.specialistType,
      data: entry.data,
      error: entry.error
    });
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[user_memory] ERROR: Failed to write to log file', error);
    console.log('[user_memory] FALLBACK:', entry);
  }
}

/**
 * Server-side logger for memory refresh operations
 * Logs to logs/memoryRefresh.log with structured format
 */
export function logMemoryRefreshServer(entry: ServerLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_MEMORY_REFRESH_LOGS !== 'true') {
      return;
    }

    // Skip file logging in production due to read-only filesystem
    if (process.env.NODE_ENV !== 'production') {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Format log entry
      const logLine = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      }) + '\n';

      // Append to log file
      const logFile = path.join(logsDir, 'memoryRefresh.log');
      fs.appendFileSync(logFile, logLine);
    }

    // Always log to console with prefix
    const consoleMessage = `[memory_refresh] ${entry.level}: ${entry.operation}`;
    console.log(consoleMessage, {
      userId: entry.userId,
      conversationId: entry.conversationId,
      data: entry.data,
      error: entry.error
    });
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[memory_refresh] ERROR: Failed to write to log file', error);
    console.log('[memory_refresh] FALLBACK:', entry);
  }
}

/**
 * Server-side logger for V16 memory processing operations
 * Logs to logs/v16Memory.log with structured format
 */
export function logV16MemoryServer(entry: ServerLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_V16_MEMORY_LOGS !== 'true') {
      return;
    }

    // Ensure logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Format log entry
    const logLine = JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString()
    }) + '\n';

    // Append to log file
    const logFile = path.join(logsDir, 'v16Memory.log');
    fs.appendFileSync(logFile, logLine);

    // Also log to console with prefix
    const consoleMessage = `[v16_memory] ${entry.level}: ${entry.operation}`;
    console.log(consoleMessage, {
      userId: entry.userId,
      conversationId: entry.conversationId,
      data: entry.data,
      error: entry.error
    });
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[v16_memory] ERROR: Failed to write to log file', error);
    console.log('[v16_memory] FALLBACK:', entry);
  }
}

/**
 * Server-side logger for warm handoff operations
 * Logs to logs/warmHandoff.log with structured format
 */
export function logWarmHandoffServer(entry: ServerLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_WARM_HANDOFF_LOGS !== 'true') {
      return;
    }

    // Skip file logging in production due to read-only filesystem
    if (process.env.NODE_ENV !== 'production') {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Format log entry
      const logLine = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      }) + '\n';

      // Append to log file
      const logFile = path.join(logsDir, 'warmHandoff.log');
      fs.appendFileSync(logFile, logLine);
    }

    // Always log to console with prefix
    const consoleMessage = `[warm_handoff] ${entry.level}: ${entry.operation}`;
    console.log(consoleMessage, {
      userId: entry.userId,
      conversationId: entry.conversationId,
      data: entry.data,
      error: entry.error
    });
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[warm_handoff] ERROR: Failed to write to log file', error);
    console.log('[warm_handoff] FALLBACK:', entry);
  }
}

/**
 * Server-side logger for multilingual support operations
 * Logs to logs/multilingualSupport.log with structured format
 */
export function logMultilingualSupportServer(entry: ServerLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS !== 'true') {
      return;
    }

    // Skip file logging in production due to read-only filesystem
    if (process.env.NODE_ENV !== 'production') {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Format log entry
      const logLine = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      }) + '\n';

      // Append to log file
      const logFile = path.join(logsDir, 'multilingualSupport.log');
      fs.appendFileSync(logFile, logLine);
    }

    // Always log to console with prefix
    const consoleMessage = `[multilingual_support] ${entry.level}: ${entry.operation}`;
    console.log(consoleMessage, {
      userId: entry.userId,
      conversationId: entry.conversationId,
      data: entry.data,
      error: entry.error
    });
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[multilingual_support] ERROR: Failed to write to log file', error);
    console.log('[multilingual_support] FALLBACK:', entry);
  }
}

/**
 * Server-side logger for progress updates
 * Logs to logs/progressUpdates.log with structured format
 */
export function logProgressUpdateServer(entry: ProgressLogEntry): void {
  try {
    // Check if logging is enabled via environment variable
    if (process.env.NEXT_PUBLIC_ENABLE_PROGRESS_UPDATE_LOGS !== 'true') {
      return;
    }

    // Skip file logging in production due to read-only filesystem
    if (process.env.NODE_ENV !== 'production') {
      // Ensure logs directory exists
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Format log entry
      const logLine = JSON.stringify({
        ...entry,
        timestamp: entry.timestamp || new Date().toISOString()
      }) + '\n';

      // Append to log file
      const logFile = path.join(logsDir, 'progressUpdates.log');
      fs.appendFileSync(logFile, logLine);
    }

    // Always log to console with prefix
    const consoleMessage = `[progress_update] ${entry.level}: ${entry.operation}`;
    console.log(consoleMessage, {
      requestId: entry.requestId,
      userId: entry.userId,
      stage: entry.stage,
      message: entry.message,
      data: entry.data,
      error: entry.error
    });
  } catch (error) {
    // Fallback to console if file logging fails
    console.error('[progress_update] ERROR: Failed to write to log file', error);
    console.log('[progress_update] FALLBACK:', entry);
  }
}