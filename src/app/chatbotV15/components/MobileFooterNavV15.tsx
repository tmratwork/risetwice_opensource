'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { EllipsisVertical, Flag, Power } from 'lucide-react';
import BugReportModal from '@/components/BugReportModal';
import { useTheme } from '@/contexts/theme-context';
import { useWebRTCStore } from '@/stores/webrtc-store';
import { optimizedAudioLogger } from '@/hooksV15/audio/optimized-audio-logger';

interface MobileFooterNavV15Props {
  onToggleDebugPanel?: () => void;
}

export function MobileFooterNavV15({ }: MobileFooterNavV15Props = {}) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Access V15 Zustand WebRTC store
  const isConnected = useWebRTCStore(state => state.isConnected);
  const disconnect = useWebRTCStore(state => state.disconnect);
  const sendMessage = useWebRTCStore(state => state.sendMessage);
  const addConversationMessage = useWebRTCStore(state => state.addConversationMessage);

  // Check if we're on the V15 chat page
  const isOnV15ChatPage = pathname === '/chatbotV15';

  // Show end session only when on V15 chat page AND connected
  const showEndSession = isOnV15ChatPage && isConnected;

  // End session handler - identical logic to the original button
  const handleEndSession = async () => {
    try {
      console.log('[END-SESSION-DEBUG] 📱 MENU END SESSION - End session menu item clicked');
      console.log('[END-SESSION-DEBUG] 🆚 This is different from VERBAL end session path');
      console.log('[zustand-webrtc] 🔚 End session menu item clicked');
      optimizedAudioLogger.logUserAction('end_session_clicked');

      // First approach: Ask AI to end gracefully like V11
      console.log("[connection] 🔚 End button clicked - sending message to AI to end session");
      console.log('[END-SESSION-DEBUG] 📱 MENU PATH: Sending regular message, no special end session state');

      // Add end session message to conversation immediately
      const endMessageObj = {
        id: `user-end-${Date.now()}`,
        role: "user" as const,
        text: "Please end this session now.",
        timestamp: new Date().toISOString(),
        isFinal: true,
        status: "final" as const
      };

      addConversationMessage(endMessageObj);

      // V15 GREENFIELD: Trust event-driven audio completion system
      // Send end session message to AI - let audio completion handle disconnect
      const success = sendMessage("Please end this session now.");

      if (success) {
        console.log("[connection] 🔚 End session request sent to AI - waiting for natural goodbye completion");
        console.log('[END-SESSION-DEBUG] 📱 MENU PATH: Using simple 10-second timeout backup (no silence detection)');
        optimizedAudioLogger.info('session', 'end_session_request_sent', {
          method: 'event_driven_audio_completion',
          timeout: 'backup_timeout_added'
        });

        // BACKUP: Add timeout to ensure disconnect happens even if AI flow fails
        setTimeout(async () => {
          if (isConnected) {
            console.log("[connection] ⏰ End session timeout - forcing disconnect");
            console.log('[END-SESSION-DEBUG] 📱 MENU PATH: 10-second timeout triggered - forcing disconnect');
            optimizedAudioLogger.warn('session', 'end_session_timeout_disconnect', {
              reason: 'ai_completion_flow_timeout'
            });
            await disconnect();
          } else {
            console.log('[END-SESSION-DEBUG] 📱 MENU PATH: Already disconnected when timeout fired');
          }
        }, 10000); // 10 second backup timeout

      } else {
        // Only fallback on actual send failure
        console.log("[connection] 🔚 Message send failed - disconnecting immediately");
        console.log('[END-SESSION-DEBUG] 📱 MENU PATH: Message send failed - immediate disconnect');
        await disconnect();
      }

    } catch (error) {
      console.error('[END-SESSION-DEBUG] ❌ MENU PATH: End session failed:', error);
      optimizedAudioLogger.error('webrtc', 'disconnect_failed', error as Error);
      // Fallback to direct disconnect on error
      await disconnect();
    }

    // Close the menu after handling
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-[#131314] border-t border-gray-800 flex justify-around items-center px-4 py-3">
      <Link
        href="/chatbotV15"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV15' ? 'text-white' : 'text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
          <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
        </svg>
        <span className="text-center">Let&rsquo;s Talk</span>
      </Link>

      <Link
        href="/chatbotV15/resources"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV15/resources' ? 'text-white' : 'text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <path d="M12 7v6" />
          <path d="M9 10h6" />
        </svg>
        <span className="text-center">Resources</span>
      </Link>

      <Link
        href="/chatbotV15/mental-health"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV15/mental-health' ? 'text-white' : 'text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
          <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
          <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
          <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
          <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
          <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
          <path d="M6 18a4 4 0 0 1-1.967-.516" />
          <path d="M19.967 17.484A4 4 0 0 1 18 18" />
        </svg>
        <span className="text-center">Mental Health</span>
      </Link>

      <Link
        href="/chatbotV15/future-pathways"
        className={`flex flex-col items-center text-xs ${pathname === '/chatbotV15/future-pathways' ? 'text-white' : 'text-gray-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1">
          <path d="M12 16v5" />
          <path d="M16 14v7" />
          <path d="M20 10v11" />
          <path d="m22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15" />
          <path d="M4 18v3" />
          <path d="M8 14v7" />
        </svg>
        <span className="text-center">Future Pathways</span>
      </Link>

      {/* Menu overflow button */}
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="flex flex-col items-center text-xs text-gray-400 hover:text-white"
          aria-label="Menu"
        >
          <EllipsisVertical size={24} />
        </button>

        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Menu */}
            <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1b] border border-gray-700 rounded-lg shadow-lg min-w-[140px] z-50">
              <div className="py-1">
                {/* Light Mode / Dark Mode Toggle */}
                <div className="px-4 py-2 hover:bg-gray-700 cursor-pointer" onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                  setIsMenuOpen(false);
                }}>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    {theme === 'dark' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-300">
                        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                        <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                  </div>
                </div>

                {/* Send Feedback */}
                <div className="px-4 py-2 hover:bg-gray-700 cursor-pointer" onClick={() => {
                  setIsBugReportModalOpen(true);
                  setIsMenuOpen(false);
                }}>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <Flag size={16} />
                    <span>Send Feedback</span>
                  </div>
                </div>

                {/* DEBUG PANEL TOGGLE - REMOVED FOR ALPHA TESTING
                    Diagnostics not yet implemented with real data.
                    Will add back when/if performance monitoring is needed.
                    
                {onToggleDebugPanel && (
                  <div className="px-4 py-2 hover:bg-gray-700 cursor-pointer" onClick={() => {
                    onToggleDebugPanel();
                    setIsMenuOpen(false);
                  }}>
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>{showDebugPanel ? 'Hide' : 'Show'} Diagnostics</span>
                    </div>
                  </div>
                )}
                */}

                {/* End Session - only show on V15 chat page when connected - BOTTOM OF MENU */}
                {showEndSession && (
                  <>
                    {/* Separator */}
                    <div className="border-t border-gray-700 my-1" />
                    <div className="px-4 py-2 hover:bg-gray-700 cursor-pointer" onClick={handleEndSession}>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Power size={16} />
                        <span>End Session</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bug Report Modal */}
      {isBugReportModalOpen && (
        <BugReportModal
          onClose={() => setIsBugReportModalOpen(false)}
        />
      )}
    </nav>
  );
}