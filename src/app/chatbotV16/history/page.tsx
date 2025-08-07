"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

interface ConversationSummary {
  id: string;
  created_at: string;
  last_activity_at: string;
  current_specialist: string;
  message_count: number;
  first_message_preview: string;
  duration_minutes: number;
}

export default function ConversationHistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comprehensive CSS Grid diagnostic functions
  const logCSSProperties = () => {
    try {
      // const computed = getComputedStyle(element);
    // console.log(`[layout-css] ${elementName}-${phase}: display=${computed.display}, gridTemplateRows=${computed.gridTemplateRows}, height=${computed.height}, minHeight=${computed.minHeight}, maxHeight=${computed.maxHeight}, overflow=${computed.overflow}, flex=${computed.flex}, flexDirection=${computed.flexDirection}`);
    } catch {
    // console.log(`[layout-css] ${elementName}-${phase}: ERROR=${e}`);
    }
  };

  const logContentBreakdown = () => {
    try {
      const contentDiv = document.querySelector('.main-content-row > div'); // The actual content
      const allChildren = contentDiv?.children || [];
      // let totalChildHeight = 0;

      Array.from(allChildren).forEach(() => {
        // const height = (child as HTMLElement).offsetHeight;
        // totalChildHeight += height;
    // console.log(`[layout-content] ${phase}: child-${i} height=${height}, class=${child.className}`);
      });

    // console.log(`[layout-content] ${phase}: totalChildHeight=${totalChildHeight}, containerHeight=${(contentDiv as HTMLElement)?.offsetHeight}`);
    } catch {
    // console.log(`[layout-content] ${phase}: ERROR=${e}`);
    }
  };

  const logCSSRules = () => {
    try {
      const rules: string[] = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            // if ((rule as CSSStyleRule).selectorText && element.matches((rule as CSSStyleRule).selectorText)) {
            //   rules.push(`${(rule as CSSStyleRule).selectorText}: ${(rule as CSSStyleRule).style.cssText}`);
            // }
            void rule;
          }
          void rules;
        } catch {
          // Cross-origin stylesheet, skip
    // console.log("error: ", _e)
        }
      }
    // console.log(`[layout-css-rules] ${elementName}-${phase}: matchingRules=${JSON.stringify(rules)}`);
    } catch {
    // console.log(`[layout-css-rules] ${elementName}-${phase}: ERROR=${e}`);
    }
  };

  const logDOMStructure = () => {
    try {
      const root = document.querySelector('.v11-layout-root');
      if (root) {
        // const structure = {
        //   childCount: root.children.length,
        //   heights: Array.from(root.children).map(child => ({
        //     className: child.className,
        //     height: (child as HTMLElement).offsetHeight,
        //     scrollHeight: (child as HTMLElement).scrollHeight
        //   }))
        // };
    // console.log(`[layout-dom] ${phase}: structure=${JSON.stringify(structure)}`);
      }
    } catch {
    // console.log(`[layout-dom] ${phase}: ERROR=${e}`);
    }
  };

  const logGridBehavior = () => {
    try {
      const root = document.querySelector('.v11-layout-root');
      const mainContent = document.querySelector('.main-content-row');

      if (root && mainContent) {
    // console.log(`[layout-grid] ${phase}: rootDisplay=${getComputedStyle(root).display}, rootHeight=${(root as HTMLElement).offsetHeight}, shouldBe=${window.innerHeight}`);
    // console.log(`[layout-grid] ${phase}: mainContentDisplay=${getComputedStyle(mainContent).display}, actualHeight=${(mainContent as HTMLElement).offsetHeight}, scrollHeight=${(mainContent as HTMLElement).scrollHeight}`);
    // console.log(`[layout-grid] ${phase}: isGridWorking=${(root as HTMLElement).offsetHeight <= window.innerHeight + 10}`);
      }
    } catch {
    // console.log(`[layout-grid] ${phase}: ERROR=${e}`);
    }
  };

  const logContentOverflow = () => {
    try {
      const mainContent = document.querySelector('.main-content-row');
      const content = mainContent?.querySelector('div'); // First child div

      if (mainContent && content) {
    // console.log(`[layout-overflow] ${phase}: containerHeight=${(mainContent as HTMLElement).offsetHeight}, contentHeight=${(content as HTMLElement)?.scrollHeight}, isOverflowing=${(content as HTMLElement)?.scrollHeight > (mainContent as HTMLElement).offsetHeight}`);
    // console.log(`[layout-overflow] ${phase}: hasScrollbar=${(mainContent as HTMLElement).scrollHeight > (mainContent as HTMLElement).clientHeight}, scrollTop=${(mainContent as HTMLElement).scrollTop}`);
      }
    } catch {
    // console.log(`[layout-overflow] ${phase}: ERROR=${e}`);
    }
  };

  const runComprehensiveDiagnostics = () => {
    // const timestamp = Date.now();
    // console.log(`[layout-comprehensive] ConversationHistoryPage: phase=${phase}, timestamp=${timestamp}`);

    const gridRoot = document.querySelector('.v11-layout-root');
    const mainContent = document.querySelector('.main-content-row');
    const footer = document.querySelector('.footer-row');

    // 1. CSS Properties
    if (gridRoot) logCSSProperties();
    if (mainContent) logCSSProperties();
    if (footer) logCSSProperties();

    // 2. Grid Behavior
    logGridBehavior();

    // 3. DOM Structure
    logDOMStructure();

    // 4. Content Breakdown
    logContentBreakdown();

    // 5. Content Overflow
    logContentOverflow();

    // 6. CSS Rules
    if (gridRoot) logCSSRules();
    if (mainContent) logCSSRules();
    if (footer) logCSSRules();

    // Legacy measurements for comparison
    if (gridRoot) {
    // console.log(`[layout-measurements] v11-layout-root: height=${gridRoot.getBoundingClientRect().height}, scrollHeight=${(gridRoot as HTMLElement).scrollHeight}`);
    }
    if (mainContent) {
    // console.log(`[layout-measurements] main-content-row: height=${mainContent.getBoundingClientRect().height}, scrollHeight=${(mainContent as HTMLElement).scrollHeight}, scrollTop=${(mainContent as HTMLElement).scrollTop}`);
    }
    if (footer) {
      // const rect = footer.getBoundingClientRect();
    // console.log(`[layout-footer] ConversationHistoryPage: top=${rect.top}, bottom=${rect.bottom}, viewportHeight=${window.innerHeight}, visible=${rect.bottom <= window.innerHeight}`);
    }
    // console.log(`[layout-measurements] window: innerHeight=${window.innerHeight}, documentScrollTop=${document.documentElement.scrollTop}`);
  };

  useEffect(() => {
    // console.log(`[layout-lifecycle] ConversationHistoryPage: state=mounting, timestamp=${Date.now()}`);

    // 1. Initial measurement after mount but before any data operations
    setTimeout(() => runComprehensiveDiagnostics(), 100);

    // Scroll logging
    const handleScroll = () => {
    // console.log(`[layout-scroll] ConversationHistoryPage: documentScrollTop=${document.documentElement.scrollTop}, timestamp=${Date.now()}`);
    };

    const handleMainContentScroll = () => {
      const mainContent = document.querySelector('.main-content-row');
      if (mainContent) {
    // console.log(`[layout-scroll] ConversationHistoryPage: main-content-row scrollTop=${(mainContent as HTMLElement).scrollTop}, timestamp=${Date.now()}`);
      }
    };

    document.addEventListener('scroll', handleScroll);
    const mainContent = document.querySelector('.main-content-row');
    if (mainContent) {
      mainContent.addEventListener('scroll', handleMainContentScroll);
    }

    return () => {
      document.removeEventListener('scroll', handleScroll);
      if (mainContent) {
        mainContent.removeEventListener('scroll', handleMainContentScroll);
      }
    };
  }, []);

  useEffect(() => {
    // console.log(`[layout-lifecycle] ConversationHistoryPage: state=auth-check, userUid=${user?.uid}, authLoading=${authLoading}, timestamp=${Date.now()}`);

    if (!user?.uid) {
      setLoading(false);
    // console.log(`[layout-lifecycle] ConversationHistoryPage: state=no-user-early-return, timestamp=${Date.now()}`);
      setTimeout(() => runComprehensiveDiagnostics(), 100);
      return;
    }

    const fetchConversationHistory = async () => {
    // console.log(`[layout-lifecycle] ConversationHistoryPage: state=fetch-start, timestamp=${Date.now()}`);

      // 2. Before data fetch measurement
      runComprehensiveDiagnostics();

      try {
        const response = await fetch(`/api/v16/conversation-history?userId=${user.uid}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error('Failed to fetch conversation history');
        }

        const conversationsData = data.conversations || [];
        setConversations(conversationsData);

    // console.log(`[layout-lifecycle] ConversationHistoryPage: state=data-loaded, conversationsCount=${conversationsData.length}, timestamp=${Date.now()}`);

        // 3. After data loaded measurement - critical for identifying when layout breaks
        setTimeout(() => runComprehensiveDiagnostics(), 100);

      } catch (error) {
    // console.error('[HISTORY] Error fetching conversation history:', error);
        setError((error as Error).message);
    // console.log(`[layout-lifecycle] ConversationHistoryPage: state=error, error=${(error as Error).message}, timestamp=${Date.now()}`);
        setTimeout(() => runComprehensiveDiagnostics(), 100);
      } finally {
        setLoading(false);
    // console.log(`[layout-lifecycle] ConversationHistoryPage: state=fetch-complete, timestamp=${Date.now()}`);
        setTimeout(() => runComprehensiveDiagnostics(), 100);
      }
    };

    fetchConversationHistory();
  }, [user?.uid]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading conversation history...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <h1 className="text-xl mb-4">Please sign in to view conversation history</h1>
          <Link href="/chatbotV16" className="text-blue-400 hover:text-blue-300 underline">
            Back to Chat
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#131314] text-white">
        <div className="text-center">
          <h1 className="text-xl mb-4 text-red-400">Error loading conversation history</h1>
          <p className="mb-4 text-gray-300">{error}</p>
          <Link href="/chatbotV16" className="text-blue-400 hover:text-blue-300 underline">
            Back to Chat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#131314] text-white">
      <div className="max-w-4xl mx-auto p-6 pt-20">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Conversation History</h1>
          <Link href="/chatbotV16" className="text-blue-400 hover:text-blue-300 underline">
            Back to Chat
          </Link>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">No conversations found</p>
            <Link href="/chatbotV16" className="text-blue-400 hover:text-blue-300 underline">
              Start your first conversation
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/chatbotV16/history/${conversation.id}`}
                className="block bg-gray-800 hover:bg-gray-700 rounded-lg p-6 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm text-gray-400">
                        {formatDate(conversation.last_activity_at)}
                      </span>
                      <span className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded border border-gray-600">
                        {conversation.current_specialist}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">
                      {conversation.first_message_preview}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-400 ml-4">
                    <div>{conversation.message_count} messages</div>
                    <div>{formatDuration(conversation.duration_minutes)}</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Click to view full conversation
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}