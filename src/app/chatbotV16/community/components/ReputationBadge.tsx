'use client';

import { ReputationBadgeProps, REPUTATION_LEVELS } from '../types/community';

export function ReputationBadge({ stats, size = 'md' }: ReputationBadgeProps) {
  const getReputationLevel = (score: number) => {
    for (const [, level] of Object.entries(REPUTATION_LEVELS)) {
      if (score >= level.min && score <= level.max) {
        return level;
      }
    }
    return REPUTATION_LEVELS.NEW_MEMBER;
  };

  const level = getReputationLevel(stats.reputation_score);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const badgeColors = {
    gray: 'bg-gray-600 text-gray-200',
    bronze: 'bg-amber-600 text-amber-100',
    silver: 'bg-gray-400 text-gray-900',
    gold: 'bg-yellow-500 text-yellow-900',
    platinum: 'bg-purple-600 text-purple-100'
  };

  return (
    <div className="flex items-center space-x-2">
      {/* Reputation Badge */}
      <span className={`
        ${sizeClasses[size]} 
        ${badgeColors[level.badge as keyof typeof badgeColors]}
        rounded-full font-medium flex items-center space-x-1
      `}>
        {/* Badge Icon */}
        {level.badge === 'platinum' && <span>👑</span>}
        {level.badge === 'gold' && <span>🥇</span>}
        {level.badge === 'silver' && <span>🥈</span>}
        {level.badge === 'bronze' && <span>🥉</span>}
        {level.badge === 'gray' && <span>🌱</span>}
        
        <span>{stats.reputation_score}</span>
      </span>

      {/* Verification Badge */}
      {stats.is_verified && (
        <span className="text-blue-500" title="Verified user">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8V4C10 2.9 10.9 2 12 2ZM21 9V7L19 5L17 7V9C17 11.2 15.2 13 13 13H11C8.8 13 7 11.2 7 9V7L5 5L3 7V9C3 12.9 6.1 16 10 16H14C17.9 16 21 12.9 21 9ZM12 22L16 18L12 14L8 18L12 22Z"/>
          </svg>
        </span>
      )}

      {/* AI Assistant Badge */}
      {stats.is_ai_assistant && (
        <span className="text-purple-500" title="AI Assistant">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20ZM12 6C8.69 6 6 8.69 6 12S8.69 18 12 18 18 15.31 18 12 15.31 6 12 6ZM12 16C9.79 16 8 14.21 8 12S9.79 8 12 8 16 9.79 16 12 14.21 16 12 16Z"/>
          </svg>
        </span>
      )}
    </div>
  );
}