// V16 Greeting Instructions Logging Utility
export function logGreetingInstructions(location: string, data: Record<string, string | number | boolean | null>) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    location,
    data
  };
  
  console.log(`[V16_GREETING_LOG][${location}]`, JSON.stringify(logEntry, null, 2));
  
  // Also store in localStorage for debugging
  const existingLogs = JSON.parse(localStorage.getItem('v16_greeting_logs') || '[]');
  existingLogs.push(logEntry);
  
  // Keep only last 50 entries
  if (existingLogs.length > 50) {
    existingLogs.splice(0, existingLogs.length - 50);
  }
  
  localStorage.setItem('v16_greeting_logs', JSON.stringify(existingLogs));
}

export function getGreetingLogs() {
  return JSON.parse(localStorage.getItem('v16_greeting_logs') || '[]');
}

export function clearGreetingLogs() {
  localStorage.removeItem('v16_greeting_logs');
}