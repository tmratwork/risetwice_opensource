'use client';

import React, { useState, useEffect } from 'react';
import { Circle, CircleMembership } from '../types/community';
import { ChevronDown, Globe, Lock, Users, Search, Plus } from 'lucide-react';

interface CircleSelectorProps {
  selectedCircleId?: string;
  onCircleChange: (circleId: string | null) => void;
  userCircles?: Circle[];
  userMemberships?: CircleMembership[];
  showCreateOption?: boolean;
  onCreateClick?: () => void;
  className?: string;
}

export default function CircleSelector({
  selectedCircleId,
  onCircleChange,
  userCircles = [],
  userMemberships = [],
  showCreateOption = false,
  onCreateClick,
  className = '',
}: CircleSelectorProps) {
  // Logging helper following project standards
  const logCircleSelector = (message: string, ...args: unknown[]) => {
    if (process.env.NEXT_PUBLIC_ENABLE_CIRCLE_SELECTOR_LOGS === 'true') {
      console.log(`[circle_selector] ${message}`, ...args);
    }
  };

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get circles that the user is a member of
  const memberCircleIds = userMemberships.map(m => m.circle_id);
  const memberCircles = userCircles.filter(circle => memberCircleIds.includes(circle.id));

  logCircleSelector('CircleSelector component rendering:', {
    userCirclesCount: userCircles.length,
    userMembershipsCount: userMemberships.length,
    memberCircleIdsCount: memberCircleIds.length,
    memberCirclesCount: memberCircles.length,
    memberCircleIds,
    memberCircles: memberCircles.map(c => ({ id: c.id, display_name: c.display_name }))
  });

  // Filter circles based on search term
  const filteredCircles = memberCircles.filter(circle =>
    circle.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    circle.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  logCircleSelector('Filtered circles for display:', {
    searchTerm,
    filteredCirclesCount: filteredCircles.length,
    filteredCircles: filteredCircles.map(c => ({ id: c.id, display_name: c.display_name }))
  });

  // Find selected circle
  const selectedCircle = userCircles.find(circle => circle.id === selectedCircleId);

  const handleCircleSelect = (circleId: string | null) => {
    onCircleChange(circleId);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.circle-selector')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className={`relative circle-selector ${className}`}>
      {/* Selected Circle Display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
      >
        <div className="flex items-center space-x-2 min-w-0">
          {selectedCircle ? (
            <>
              {/* Circle Icon */}
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                {selectedCircle.icon_url ? (
                  <img
                    src={selectedCircle.icon_url}
                    alt={selectedCircle.display_name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-white text-xs font-medium">
                    {selectedCircle.display_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1 min-w-0">
                {selectedCircle.is_private && (
                  <Lock className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {selectedCircle.display_name}
                </span>
              </div>
            </>
          ) : (
            <>
              <Globe className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                General Feed
              </span>
            </>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-80 overflow-hidden">

          {/* Search */}
          {memberCircles.length > 5 && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-600">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search circles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {/* General Feed Option */}
            <button
              type="button"
              onClick={() => handleCircleSelect(null)}
              className={`w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${!selectedCircleId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
            >
              <Globe className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  General Feed
                </div>

              </div>
              {!selectedCircleId && (
                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
              )}
            </button>

            {/* Member Circles */}
            {filteredCircles.length > 0 && (
              <>
                <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-600/50">
                  YOUR CIRCLES
                </div>
                {filteredCircles.map((circle) => {
                  const membership = userMemberships.find(m => m.circle_id === circle.id);
                  const isSelected = selectedCircleId === circle.id;

                  return (
                    <button
                      key={circle.id}
                      type="button"
                      onClick={() => handleCircleSelect(circle.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                    >
                      {/* Circle Icon */}
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        {circle.icon_url ? (
                          <img
                            src={circle.icon_url}
                            alt={circle.display_name}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white text-xs font-medium">
                            {circle.display_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1">
                          {circle.is_private && (
                            <Lock className="w-3 h-3 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {circle.display_name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                          <span>c/{circle.name}</span>
                          {membership && (
                            <span className="px-1 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">
                              {membership.role}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        <Users className="w-3 h-3" />
                        <span>{circle.member_count}</span>
                      </div>

                      {isSelected && (
                        <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </>
            )}

            {/* No results */}
            {searchTerm && filteredCircles.length === 0 && (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                No circles found matching &quot;{searchTerm}&quot;
              </div>
            )}

            {/* Create Circle Option */}
            {showCreateOption && onCreateClick && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-600" />
                <button
                  type="button"
                  onClick={() => {
                    onCreateClick();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <Plus className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-blue-600">
                    Create New Circle
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}