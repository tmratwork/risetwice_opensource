'use client';

import { VoteButtonsProps } from '../types/community';

export function VoteButtons({ 
  upvotes, 
  downvotes, 
  userVote, 
  onVote, 
  disabled = false 
}: VoteButtonsProps) {
  const netVotes = upvotes - downvotes;

  const handleUpvote = () => {
    if (!disabled) {
      onVote('upvote');
    }
  };

  const handleDownvote = () => {
    if (!disabled) {
      onVote('downvote');
    }
  };

  return (
    <div className="flex items-center space-x-1">
      {/* Upvote Button */}
      <button
        onClick={handleUpvote}
        disabled={disabled}
        className={`p-1 rounded transition-colors ${
          disabled 
            ? 'text-gray-600 cursor-not-allowed' 
            : userVote === 'upvote'
              ? 'text-orange-500 hover:text-orange-400'
              : 'text-gray-400 hover:text-orange-500'
        }`}
        title="Upvote"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 4l-8 8h5v8h6v-8h5z"/>
        </svg>
      </button>

      {/* Vote Count */}
      <span className={`text-sm font-medium min-w-[2rem] text-center ${
        netVotes > 0 ? 'text-orange-500' : 
        netVotes < 0 ? 'text-blue-500' : 
        'text-gray-400'
      }`}>
        {netVotes > 0 ? `+${netVotes}` : netVotes}
      </span>

      {/* Downvote Button */}
      <button
        onClick={handleDownvote}
        disabled={disabled}
        className={`p-1 rounded transition-colors ${
          disabled 
            ? 'text-gray-600 cursor-not-allowed' 
            : userVote === 'downvote'
              ? 'text-blue-500 hover:text-blue-400'
              : 'text-gray-400 hover:text-blue-500'
        }`}
        title="Downvote"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 20l8-8h-5V4H9v8H4z"/>
        </svg>
      </button>
    </div>
  );
}