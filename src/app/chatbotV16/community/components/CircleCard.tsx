'use client';

import React from 'react';
import { CircleCardProps } from '../types/community';
import { Users, Lock, MessageSquare, Calendar, Settings } from 'lucide-react';

export default function CircleCard({
  circle,
  currentUserId,
  userMembership,
  onJoin,
  onLeave,
  onClick,
}: CircleCardProps) {
  const isMember = !!userMembership;
  const isAdmin = userMembership?.role === 'admin';
  const isModerator = userMembership?.role === 'moderator' || isAdmin;
  const isCreator = circle.created_by === currentUserId;
  const isPendingApproval = !circle.is_approved;

  const handleJoinLeave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMember && onLeave) {
      onLeave(circle.id);
    } else if (!isMember && onJoin) {
      onJoin(circle.id);
    }
  };

  const handleLeaveCircle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to leave ${circle.display_name}?`)) {
      if (onLeave) {
        onLeave(circle.id);
      }
    }
  };

  const handleEnterCircle = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to circle feed
    window.location.href = `/chatbotV16/community?circle_id=${circle.id}`;
  };

  const handleAdminClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Navigate to circle admin page
    window.location.href = `/chatbotV16/community/circles/${circle.id}/admin`;
  };

  const handleClick = () => {
    if (onClick) {
      onClick(circle.id);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-all duration-200 cursor-pointer"
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          {/* Circle Icon */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#9dbbac] to-[#3b503c] flex items-center justify-center">
            {circle.icon_url ? (
              <img
                src={circle.icon_url}
                alt={circle.display_name}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold text-lg">
                {circle.display_name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {circle.display_name}
              </h3>
              {circle.requires_approval && (
                <Lock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              )}
              {isPendingApproval && isCreator && (
                <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-xs rounded-full">
                  Pending Approval
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              c/{circle.name}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {currentUserId && (
          <div className="flex items-center space-x-2">
            {/* Admin Button */}
            {isAdmin && (
              <button
                onClick={handleAdminClick}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Circle Admin"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            
            {/* Join Button for non-members only */}
            {!isMember && (
              <button
                onClick={handleJoinLeave}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#9dbbac] text-white hover:bg-[#3b503c] transition-colors"
              >
                {circle.requires_approval ? 'Join' : 'Join'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      {circle.description && (
        <p className="text-gray-600 dark:text-gray-300 text-sm mb-4 line-clamp-2">
          {circle.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4" />
            <span>{circle.member_count.toLocaleString()} members</span>
          </div>
          <div className="flex items-center space-x-1">
            <MessageSquare className="w-4 h-4" />
            <span>{circle.post_count.toLocaleString()} posts</span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <Calendar className="w-4 h-4" />
          <span>Created {formatDate(circle.created_at)}</span>
        </div>
      </div>

      {/* Member Badge */}
      {isMember && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs rounded-full">
              Member
            </span>
            {isAdmin && (
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                Admin
              </span>
            )}
            {isModerator && !isAdmin && (
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                Moderator
              </span>
            )}
          </div>

          {userMembership && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Joined {formatDate(userMembership.joined_at)}
            </span>
          )}
        </div>
      )}

      {/* Enter and Leave Buttons for Members */}
      {isMember && currentUserId && (
        <div className="flex gap-2">
          <button
            onClick={handleEnterCircle}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-[#9dbbac] text-white hover:bg-[#3b503c] transition-colors"
          >
            Enter Circle
          </button>
          <button
            onClick={handleLeaveCircle}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-[#9dbbac] text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Leave
          </button>
        </div>
      )}

      {/* Rules Preview (for non-members of private circles) */}
      {!isMember && circle.rules && circle.rules.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rules:</p>
          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1">
            {circle.rules[0]}
          </p>
          {circle.rules.length > 1 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              +{circle.rules.length - 1} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}