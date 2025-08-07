/**
 * Enhanced logging system for thinking state monitoring
 * Provides structured, filterable logs for beta testing and diagnostics
 */

import audioLogger from './audio-logger';

// Log categories with distinct prefixes for easy filtering
export const LOG_CATEGORIES = {
  WARNING: 'TSM-WARNING',    // For warning threshold crossed
  ERROR: 'TSM-ERROR',        // For error threshold crossed
  STATE: 'TSM-STATE',        // For thinking state changes
  NEAR_MISS: 'TSM-NEAR-MISS', // For almost triggering a warning
  THRESHOLD: 'TSM-THRESHOLD', // For threshold configuration
  RECOVERY: 'TSM-RECOVERY',   // For recovery actions
  STARTUP: 'TSM-STARTUP',     // For initialization events
  DEBUG: 'TSM-DEBUG'          // For detailed debug information
};

// Log levels for different verbosity settings
export enum LogLevel {
  NONE = 0,    // No logging
  ERROR = 1,   // Only errors
  WARNING = 2, // Errors and warnings
  INFO = 3,    // Errors, warnings, and important state changes
  DEBUG = 4,   // All information including debug details
  VERBOSE = 5  // Maximum verbosity with all possible details
}

// Default configuration
const DEFAULT_CONFIG = {
  consoleEnabled: true,
  logLevel: LogLevel.INFO,
  includeTimestamps: true,
  includeDurations: true,
  includeThresholds: true,
  colorizeConsole: true,
  persistToAudioLogger: true
};

let config = { ...DEFAULT_CONFIG };

/**
 * Initialize the enhanced logging system
 * @param options Configuration options for logging
 */
export function initializeLogging(options: Partial<typeof DEFAULT_CONFIG> = {}) {
  config = { ...DEFAULT_CONFIG, ...options };
  
  log(LOG_CATEGORIES.STARTUP, `Enhanced thinking state logging initialized (level: ${LogLevel[config.logLevel]})`, {
    config,
    timestamp: Date.now()
  });
}

/**
 * Main logging function with structured format
 * @param category Log category (from LOG_CATEGORIES)
 * @param message Message to log
 * @param data Additional data to include (optional)
 * @param level Log level for this message
 */
// Define a type for log data
export type LogData = Record<string, unknown>;

export function log(
  category: string, 
  message: string, 
  data: LogData = {}, 
  level: LogLevel = LogLevel.INFO
) {
  // Skip if logging is disabled or below current level
  if (!config.consoleEnabled || level > config.logLevel) {
    return;
  }

  // Prepare timestamp if enabled
  const timestamp = config.includeTimestamps ? new Date().toISOString() : '';
  
  // Prepare duration info if available and enabled
  const duration = data.duration as number | undefined;
  const durationText = config.includeDurations && typeof duration === 'number' ? 
    `[${(duration / 1000).toFixed(1)}s]` : '';
  
  // Prepare threshold info if available and enabled
  const thresholds = data.thresholds as { warningThresholdMs?: number, errorThresholdMs?: number } | undefined;
  const thresholdText = config.includeThresholds && thresholds && 
    typeof thresholds.warningThresholdMs === 'number' && 
    typeof thresholds.errorThresholdMs === 'number' ? 
    `[w:${(thresholds.warningThresholdMs / 1000).toFixed(1)}s|e:${(thresholds.errorThresholdMs / 1000).toFixed(1)}s]` : '';
  
  // Format the log entry with consistent structure
  const logPrefix = `[${category}]${timestamp ? ` ${timestamp}` : ''}${durationText ? ` ${durationText}` : ''}${thresholdText ? ` ${thresholdText}` : ''}`;
  
  // Determine color based on category if colorization is enabled
  let consoleMethod = console.log;
  let stylePrefix = '';
  
  if (config.colorizeConsole) {
    if (category === LOG_CATEGORIES.ERROR) {
      consoleMethod = console.error;
      stylePrefix = '%c';
      data.style = 'color: #FF3333; font-weight: bold';
    } else if (category === LOG_CATEGORIES.WARNING) {
      consoleMethod = console.warn;
      stylePrefix = '%c';
      data.style = 'color: #FFAA00; font-weight: bold';
    } else if (category === LOG_CATEGORIES.NEAR_MISS) {
      stylePrefix = '%c';
      data.style = 'color: #B3AA00';
    } else if (category === LOG_CATEGORIES.RECOVERY) {
      stylePrefix = '%c';
      data.style = 'color: #00AA00';
    } else if (category === LOG_CATEGORIES.STATE) {
      stylePrefix = '%c';
      data.style = 'color: #3399FF';
    }
  }
  
  // Add persistent logging through audioLogger if enabled
  if (config.persistToAudioLogger) {
    audioLogger.logDiagnostic('thinking-state-log', {
      category,
      message,
      data,
      level,
      timestamp: Date.now()
    });
  }
  
  // Output to console with appropriate styling
  if (stylePrefix && data.style) {
    consoleMethod(`${stylePrefix}${logPrefix} ${message}`, data.style, data);
  } else {
    consoleMethod(`${logPrefix} ${message}`, data);
  }
}

/**
 * Log a warning threshold event
 * @param message Warning message
 * @param data Additional data
 */
export function logWarning(message: string, data: LogData = {}) {
  log(LOG_CATEGORIES.WARNING, message, data, LogLevel.WARNING);
}

/**
 * Log an error threshold event
 * @param message Error message
 * @param data Additional data
 */
export function logError(message: string, data: LogData = {}) {
  log(LOG_CATEGORIES.ERROR, message, data, LogLevel.ERROR);
}

/**
 * Log a thinking state change
 * @param message State change description
 * @param data Additional data
 */
export function logStateChange(message: string, data: LogData = {}) {
  log(LOG_CATEGORIES.STATE, message, data, LogLevel.INFO);
}

/**
 * Log a near-miss event (almost reached threshold)
 * @param message Near-miss description
 * @param data Additional data
 */
export function logNearMiss(message: string, data: LogData = {}) {
  log(LOG_CATEGORIES.NEAR_MISS, message, data, LogLevel.DEBUG);
}

/**
 * Log detailed debug information
 * @param message Debug message
 * @param data Additional data
 */
export function logDebug(message: string, data: LogData = {}) {
  log(LOG_CATEGORIES.DEBUG, message, data, LogLevel.DEBUG);
}

/**
 * Log extremely detailed verbose information
 * @param message Verbose message
 * @param data Additional data
 */
export function logVerbose(message: string, data: LogData = {}) {
  log(LOG_CATEGORIES.DEBUG, message, data, LogLevel.VERBOSE);
}

/**
 * Log a recovery action
 * @param message Recovery description
 * @param data Additional data
 */
export function logRecovery(message: string, data: LogData = {}) {
  log(LOG_CATEGORIES.RECOVERY, message, data, LogLevel.INFO);
}

/**
 * Create a timing logger for measuring durations
 * @param category Log category to use
 * @param operation Name of operation being timed
 * @returns Object with finish function to complete timing
 */
/**
 * Interface for timing finish additional data
 */
export interface TimingData extends LogData {
  [key: string]: unknown;
}

/**
 * Create a timing logger for measuring durations
 * @param category Log category to use
 * @param operation Name of operation being timed
 */
export function startTiming(category: string, operation: string) {
  const startTime = performance.now();
  logDebug(`Starting ${operation}`, { startTime });
  
  return {
    finish: (additionalData: TimingData = {}) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      log(category, `${operation} completed`, {
        ...additionalData,
        duration,
        startTime,
        endTime
      });
      
      return duration;
    }
  };
}

/**
 * Get current enhanced logging configuration
 */
export function getLoggingConfig() {
  return { ...config };
}

/**
 * Update enhanced logging configuration
 * @param newConfig New configuration options (partial)
 */
export function updateLoggingConfig(newConfig: Partial<typeof DEFAULT_CONFIG>) {
  const oldConfig = { ...config };
  config = { ...config, ...newConfig };
  
  logDebug('Logging configuration updated', {
    oldConfig,
    newConfig,
    resultingConfig: config
  });
  
  return config;
}

export default {
  initialize: initializeLogging,
  log,
  logWarning,
  logError,
  logStateChange,
  logNearMiss,
  logDebug,
  logVerbose,
  logRecovery,
  startTiming,
  getConfig: getLoggingConfig,
  updateConfig: updateLoggingConfig,
  categories: LOG_CATEGORIES,
  levels: LogLevel
};