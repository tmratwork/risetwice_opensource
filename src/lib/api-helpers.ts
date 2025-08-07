/**
 * API utility functions for consistent behavior across endpoints
 */

/**
 * Gets the appropriate API base URL based on environment
 * Forces localhost in development mode regardless of API_BASE_URL setting
 */
export function getApiBaseUrl(): string {
  // Force localhost in development mode
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  
  // In production, use the configured API_BASE_URL or fall back to localhost
  return process.env.API_BASE_URL || 'http://localhost:3000';
}