'use client';

import React, { useState, useRef, useEffect } from 'react';

export type ReactionType = 'care' | 'hugs' | 'helpful' | 'strength' | 'relatable' | 'thoughtful' | 'growth' | 'grateful';

interface ReactionCounts {
  care: number;
  hugs: number;
  helpful: number;
  strength: number;
  relatable: number;
  thoughtful: number;
  growth: number;
  grateful: number;
}

interface ReactionButtonsProps {
  reactions: ReactionCounts;
  userReaction?: ReactionType;
  onReaction: (reactionType: ReactionType) => void;
  disabled?: boolean;
}

const reactionConfig = {
  care: {
    emoji: '💜',
    label: 'Care',
    tooltip: 'Show care and support',
    color: 'hover:bg-purple-900/30 data-[active=true]:bg-purple-900/50 data-[active=true]:text-purple-300'
  },
  hugs: {
    emoji: '🤗',
    label: 'Hugs',
    tooltip: 'Send virtual hugs',
    color: 'hover:bg-orange-900/30 data-[active=true]:bg-orange-900/50 data-[active=true]:text-orange-300'
  },
  helpful: {
    emoji: '✨',
    label: 'Helpful',
    tooltip: 'Mark as helpful advice',
    color: 'hover:bg-yellow-900/30 data-[active=true]:bg-yellow-900/50 data-[active=true]:text-yellow-300'
  },
  strength: {
    emoji: '👏',
    label: 'Strength',
    tooltip: 'Acknowledge courage and strength',
    color: 'hover:bg-green-900/30 data-[active=true]:bg-green-900/50 data-[active=true]:text-green-300'
  },
  relatable: {
    emoji: '🎯',
    label: 'Relatable',
    tooltip: 'I\'ve been there too',
    color: 'hover:bg-blue-900/30 data-[active=true]:bg-blue-900/50 data-[active=true]:text-blue-300'
  },
  thoughtful: {
    emoji: '💭',
    label: 'Thoughtful',
    tooltip: 'This made me think',
    color: 'hover:bg-indigo-900/30 data-[active=true]:bg-indigo-900/50 data-[active=true]:text-indigo-300'
  },
  growth: {
    emoji: '🌱',
    label: 'Growth',
    tooltip: 'About growth and healing',
    color: 'hover:bg-emerald-900/30 data-[active=true]:bg-emerald-900/50 data-[active=true]:text-emerald-300'
  },
  grateful: {
    emoji: '🙏',
    label: 'Grateful',
    tooltip: 'This helped me feel less alone',
    color: 'hover:bg-pink-900/30 data-[active=true]:bg-pink-900/50 data-[active=true]:text-pink-300'
  }
};

// Order reactions by supportiveness priority
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const reactionOrder: ReactionType[] = ['care', 'hugs', 'helpful', 'strength', 'relatable', 'thoughtful', 'growth', 'grateful'];

export function ReactionButtons({
  reactions,
  userReaction,
  onReaction,
  disabled = false
}: ReactionButtonsProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate total reaction count
  const totalReactions = Object.values(reactions).reduce((sum, count) => sum + count, 0);

  // Get the most popular reaction to show as the main button
  const topReaction = Object.entries(reactions)
    .sort(([, a], [, b]) => b - a)
    .find(([, count]) => count > 0)?.[0] as ReactionType;

  // Show user's reaction if they have one, otherwise show top reaction or default to care
  const displayReaction = userReaction || topReaction || 'care';
  const displayConfig = reactionConfig[displayReaction];

  const handleReaction = (reactionType: ReactionType) => {
    if (!disabled) {
      onReaction(reactionType);
      setIsPopupOpen(false);
    }
  };

  const handleMainButtonClick = () => {
    if (disabled) return;
    setIsPopupOpen(!isPopupOpen);
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsPopupOpen(false);
      }
    };

    if (isPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopupOpen]);

  return (
    <div className="relative">
      {/* Main reaction button */}
      <button
        ref={buttonRef}
        onClick={handleMainButtonClick}
        disabled={disabled}
        className={`
          flex items-center space-x-2 px-3 py-1 rounded-full text-sm
          transition-all duration-200 
          ${disabled
            ? 'text-gray-600 cursor-not-allowed'
            : userReaction
              ? `bg-green-100 text-green-800 scale-105`
              : 'text-gray-400 hover:text-gray-300 hover:scale-105'
          }
          ${isPopupOpen ? 'bg-gray-800' : 'hover:bg-gray-800/50'}
        `}
        title={userReaction ? `You reacted with ${displayConfig.label}` : 'Add reaction'}
      >
        <span className="text-base">{displayConfig.emoji}</span>
        {totalReactions > 0 && (
          <span className="text-xs font-medium">
            {totalReactions}
          </span>
        )}
        {/* Up arrow */}
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isPopupOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Reaction popup */}
      {isPopupOpen && (
        <div
          ref={popupRef}
          className="absolute bottom-full mb-2 left-0 border border-green-200 rounded-lg shadow-lg z-50 p-3 min-w-[280px]"
          style={{ backgroundColor: '#e7ece9' }}
        >
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(reactionConfig).map(([reactionType, config]) => {
              const count = reactions[reactionType as ReactionType];
              const isActive = userReaction === reactionType;

              return (
                <button
                  key={reactionType}
                  onClick={() => handleReaction(reactionType as ReactionType)}
                  className={`
                    flex flex-col items-center p-3 rounded-lg text-center
                    transition-all duration-200 
                    ${isActive
                      ? `bg-green-200 text-green-800 scale-105 font-medium border-2 border-green-300`
                      : 'text-gray-700 hover:text-gray-900 hover:bg-green-50'
                    }
                  `}
                  title={config.tooltip}
                >
                  <span className="text-2xl mb-2">{config.emoji}</span>
                  <span className="text-xs font-semibold text-gray-800">{config.label}</span>
                  {count > 0 && (
                    <span className="text-xs font-bold mt-1 px-1.5 py-0.5 bg-green-600 text-white rounded-full">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}