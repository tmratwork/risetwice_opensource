// src/components/BugReportModal.tsx
"use client";

import { useState, useEffect } from 'react';
import { useWebRTCStore } from '@/stores/webrtc-store';

interface BugReportModalProps {
  onClose: () => void;
  messageId?: string | null;
  feedbackType?: 'thumbs_up' | 'thumbs_down' | null;
}

// We'll capture all console logs in a circular buffer
class LogBuffer {
  private logs: { level: string; message: string; timestamp: string }[] = [];
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.interceptConsole();
  }

  addLog(level: string, ...args: unknown[]) {
    const message = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Handle circular references and non-serializable objects
          return JSON.stringify(arg, (key, value) => {
            // Skip circular references and functions
            if (typeof value === 'function') return '[Function]';
            if (typeof value === 'object' && value !== null) {
              // Simple circular reference detection
              try {
                JSON.stringify(value);
                return value;
              } catch {
                return '[Circular Reference]';
              }
            }
            return value;
          }, 2);
        } catch {
          // If JSON serialization still fails, use a safer string conversion
          if (arg instanceof Error) {
            return `Error: ${arg.message}`;
          }
          return '[Object]';
        }
      }
      return String(arg);
    }).join(' ');

    this.logs.push({
      level,
      message,
      timestamp: new Date().toISOString()
    });

    // Keep buffer size limited
    if (this.logs.length > this.maxSize) {
      this.logs.shift();
    }
  }

  getLogs() {
    return [...this.logs];
  }

  interceptConsole() {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = (...args) => {
      this.addLog('log', ...args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      this.addLog('warn', ...args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      this.addLog('error', ...args);
      originalError.apply(console, args);
    };

    console.info = (...args) => {
      this.addLog('info', ...args);
      originalInfo.apply(console, args);
    };
  }
}

// Define WindowWithBuffers interface to properly type window global extensions
interface WindowWithBuffers extends Window {
  __logBuffer?: LogBuffer;
  __webrtcState?: Record<string, unknown>;
  __audioQueueState?: Record<string, unknown>;
  __sessionId?: string;
  __conversationId?: string | null;
}

// Initialize the log buffer (singleton)
let logBuffer: LogBuffer | undefined;
if (typeof window !== 'undefined') {
  const win = window as WindowWithBuffers;
  if (!win.__logBuffer) {
    win.__logBuffer = new LogBuffer();
  }
  logBuffer = win.__logBuffer;
}

export default function BugReportModal({ onClose, messageId, feedbackType }: BugReportModalProps) {
  const [message, setMessage] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // New feedback fields
  const [thumbsUp, setThumbsUp] = useState(false);
  const [thumbsDown, setThumbsDown] = useState(false);
  const [lessOfFeedback, setLessOfFeedback] = useState('');
  const [moreOfFeedback, setMoreOfFeedback] = useState('');
  const [allowConversationAccess, setAllowConversationAccess] = useState(true);

  // Get current conversationId from webrtc store
  const conversationId = useWebRTCStore(state => state.conversationId);

  // Auto-fill thumbs up/down based on feedback type
  useEffect(() => {
    if (feedbackType === 'thumbs_up') {
      setThumbsUp(true);
      setThumbsDown(false);
    } else if (feedbackType === 'thumbs_down') {
      setThumbsUp(false);
      setThumbsDown(true);
    }
  }, [feedbackType]);

  // Get WebRTC state from window global
  const getWebRTCState = (): Record<string, unknown> => {
    if (typeof window !== 'undefined') {
      const win = window as WindowWithBuffers;
      return win.__webrtcState || {};
    }
    return {};
  };

  // Get audio queue state from window global
  const getAudioQueueState = (): Record<string, unknown> => {
    if (typeof window !== 'undefined') {
      const win = window as WindowWithBuffers;
      return win.__audioQueueState || {};
    }
    return {};
  };

  // Define Navigator with connection API
  interface NavigatorWithConnection extends Navigator {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  }

  const getBrowserInfo = (): Record<string, unknown> => {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      vendor: navigator.vendor,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
        pixelDepth: window.screen.pixelDepth
      },
      connection: ((navigator as NavigatorWithConnection).connection)
        ? {
          effectiveType: (navigator as NavigatorWithConnection).connection?.effectiveType,
          downlink: (navigator as NavigatorWithConnection).connection?.downlink,
          rtt: (navigator as NavigatorWithConnection).connection?.rtt,
          saveData: (navigator as NavigatorWithConnection).connection?.saveData
        }
        : 'Connection API not available'
    };
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = message;
    document.body.appendChild(toast);

    // Add styles if they don't exist
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.innerHTML = `
        .toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #333;
          color: white;
          padding: 12px 24px;
          border-radius: 4px;
          z-index: 10000;
          box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          opacity: 0;
          transition: opacity 0.3s;
          animation: fadeInOut 3s forwards;
        }
        .toast-success {
          background-color: #4CAF50;
        }
        .toast-error {
          background-color: #F44336;
        }
        @keyframes fadeInOut {
          0% { opacity: 0; }
          10% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    // Remove after animation
    setTimeout(() => {
      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
      }
    }, 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const userId = localStorage.getItem('userId') || 'anonymous';
      const win = window as WindowWithBuffers;
      const sessionId = win.__sessionId || `session-${Date.now()}`;

      // Get logs from the buffer
      const logs = logBuffer ? logBuffer.getLogs() : [];

      // Get browser info
      const browserInfo = getBrowserInfo();

      // Get WebRTC state
      const webrtcState = getWebRTCState();

      // Get audio queue state
      const audioQueueState = getAudioQueueState();

      // Prepare the report data
      const reportData = {
        user_id: userId,
        message,
        contact_phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        logs,
        browser_info: browserInfo,
        session_id: sessionId,
        webrtc_state: webrtcState,
        audio_queue_state: audioQueueState,
        conversation_id: conversationId || null,
        // New feedback fields
        message_id: messageId || null,
        feedback_type: thumbsUp && thumbsDown ? 'mixed' : thumbsUp ? 'thumbs_up' : thumbsDown ? 'thumbs_down' : 'general',
        thumbs_up: thumbsUp,
        thumbs_down: thumbsDown,
        less_of_feedback: lessOfFeedback.trim() || null,
        more_of_feedback: moreOfFeedback.trim() || null,
        allow_conversation_access: allowConversationAccess
      };

      // Submit to the API route
      const response = await fetch('/api/v11/save-bug-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error submitting bug report:', errorData);
        setSubmissionStatus('error');
        showToast('Failed to submit feedback', 'error');
      } else {
        console.log('Bug report submitted successfully');
        setSubmissionStatus('success');
        showToast('Feedback submitted successfully', 'success');

        // Immediately close the modal and show toast instead
        onClose();
      }
    } catch (err) {
      console.error('Error in bug report submission:', err);
      setSubmissionStatus('error');
      showToast('Failed to submit feedback', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="bug-report-modal-overlay" onClick={onClose}>
      <div className="bug-report-modal" onClick={e => e.stopPropagation()}>
        <div className="bug-report-modal-header">
          <h2>Feedback</h2>
          <button
            className="bug-report-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="bug-report-form">
          {/* Feedback checkboxes */}
          <div className="bug-report-form-group">
            <div className="feedback-checkboxes">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={thumbsUp}
                  onChange={(e) => setThumbsUp(e.target.checked)}
                />
                <span className="checkbox-text">👍 Thumbs up</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={thumbsDown}
                  onChange={(e) => setThumbsDown(e.target.checked)}
                />
                <span className="checkbox-text">👎 Thumbs down</span>
              </label>
            </div>
          </div>

          {/* Additional feedback fields */}
          <div className="bug-report-form-group">
            <label htmlFor="less-of-feedback">What would you like less of next time?</label>
            <textarea
              id="less-of-feedback"
              value={lessOfFeedback}
              onChange={(e) => setLessOfFeedback(e.target.value)}
              placeholder="e.g., too many questions, too much breathing advice..."
              rows={2}
            />
          </div>

          <div className="bug-report-form-group">
            <label htmlFor="more-of-feedback">What would you like more of next time?</label>
            <textarea
              id="more-of-feedback"
              value={moreOfFeedback}
              onChange={(e) => setMoreOfFeedback(e.target.value)}
              placeholder="e.g., more specific advice, more encouraging tone..."
              rows={2}
            />
          </div>

          <div className="bug-report-form-group">
            <label htmlFor="bug-message">Additional details:</label>
            <textarea
              id="bug-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="eg. The audio cut out..."
              rows={5}
            />
          </div>

          {/* Disclosure checkbox */}
          <div className="bug-report-form-group">
            <label className="checkbox-label disclosure-checkbox">
              <input
                type="checkbox"
                checked={allowConversationAccess}
                onChange={(e) => setAllowConversationAccess(e.target.checked)}
              />
              <span className="checkbox-text">I allow the development team to see this session&rsquo;s full conversation history. This greatly helps us improve our AI&rsquo;s responses.</span>
            </label>
          </div>

          <div className="bug-report-contact-section">
            <h3>Optional: Contact Information</h3>
            <p className="bug-report-contact-explanation">
              To fix the issue, we may need to follow up with questions about your feedback and invite you to test fixes.
              Please provide your contact information below. This is completely optional.
            </p>

            <div className="bug-report-form-group">
              <label htmlFor="contact-email">Email:</label>
              <input
                type="email"
                id="contact-email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="your-email@example.com"
              />
            </div>

            <div className="bug-report-form-group">
              <label htmlFor="contact-phone">Phone:</label>
              <input
                type="tel"
                id="contact-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          <div className="bug-report-info-text">
            <p>Thank you for taking the time.</p>
          </div>

          {submissionStatus === 'success' && (
            <div className="bug-report-success">
              Thank you! Your feedback has been uploaded.
            </div>
          )}

          {submissionStatus === 'error' && (
            <div className="bug-report-error">
              There was an error submitting your report. Please try again.
            </div>
          )}

          <div className="bug-report-form-actions">
            <button
              type="button"
              className="bug-report-button-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bug-report-button-submit"
              disabled={isSubmitting || (message.trim() === '' && !thumbsUp && !thumbsDown && lessOfFeedback.trim() === '' && moreOfFeedback.trim() === '')}
            >
              {isSubmitting ? 'Uploading...' : 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}