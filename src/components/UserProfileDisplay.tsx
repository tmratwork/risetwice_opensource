"use client";

import React from 'react';

/**
 * Props for the UserProfileDisplay component.
 * This component is designed to handle any profile structure without making assumptions about fields.
 */
interface UserProfileProps {
  /**
   * The profile data object with arbitrary structure.
   * Can contain nested objects, arrays, and primitive values.
   */
  profileData: Record<string, unknown>;

  /**
   * The timestamp when the profile was last updated.
   * Can be ISO string or numeric timestamp.
   */
  lastUpdated?: string | number;
}

/**
 * A component that displays user profile data in a visually appealing way.
 * Handles arbitrary data structures with dynamic rendering based on the content.
 *
 * Features:
 * - Renders any nested object structure
 * - Applies appropriate formatting for different data types
 * - Uses icons based on field names
 * - Formats timestamps for readability
 */
const UserProfileDisplay: React.FC<UserProfileProps> = ({ profileData }) => {
  // Helper function to check if an object has content
  const hasContent = (obj: unknown): boolean => {
    if (!obj) return false;
    if (typeof obj !== 'object') return true;
    if (Array.isArray(obj)) return obj.length > 0;
    if (obj && typeof obj === 'object') return Object.keys(obj).length > 0;
    return false;
  };

  // Helper function to format timestamps in a user-friendly way
  // const formatTimestamp = (timestamp: string | number | undefined): string => {
  //   if (!timestamp) return 'Unknown';
  //   const date = new Date(timestamp);
  //   return date.toLocaleString();
  // };

  // Helper function to format values in a human-friendly way
  const formatValue = (key: string, value: unknown): string => {
    // Handle confidence values - show as "X out of 5"
    if (key.toLowerCase().includes('confidence') && typeof value === 'number') {
      return `${value} out of 5`;
    }
    
    // Handle arrays - show as comma-separated list without brackets/quotes
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    
    // Handle objects - keep as JSON for complex nested data
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    
    return value?.toString() || '';
  };

  // Helper function to render object fields in a structured way
  const renderObjectFields = (obj: Record<string, unknown>) => {
    return Object.entries(obj).filter(([key]) => key !== 'messageReferences').map(([key, value]) => (
      <div key={key} className="mb-2">
        <div className="flex flex-col sm:flex-row sm:items-start">
          <span className="font-medium text-gray-800 dark:text-gray-200 min-w-fit">{key}:</span>
          <span className="text-gray-700 dark:text-gray-300 ml-0 sm:ml-2">
            {formatValue(key, value)}
          </span>
        </div>
      </div>
    ));
  };

  // Helper function to render an object section
  const renderSection = (title: string, data: unknown, icon: string = '📝', indent: number = 0) => {
    if (!data || !hasContent(data)) return null;

    // Handle array data - skip messageReferences arrays
    if (Array.isArray(data)) {
      // Skip rendering if this is a messageReferences array
      if (title.toLowerCase().includes('message references')) {
        return null;
      }
      
      return (
        <div className={`${indent === 0 ? '' : 'mb-4'} ml-${indent * 4}`} key={title}>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-800 dark:text-gray-100">
            <span className="mr-2">{icon}</span>
            {title}
          </h3>
          <div className="ml-6 space-y-3">
            {data.map((item, index) => (
              <div key={index} className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-600">
                {typeof item === 'object' && item !== null ? (
                  renderObjectFields(item as Record<string, unknown>)
                ) : (
                  <span className="text-gray-700 dark:text-gray-300">{item}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Handle object data
    if (typeof data === 'object') {
      return (
        <div className={`${indent === 0 ? '' : 'mb-4'} ml-${indent * 4}`} key={title}>
          <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-800 dark:text-gray-100">
            <span className="mr-2">{icon}</span>
            {title}
          </h3>
          <div className="ml-6">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-600">
              {renderObjectFields(data as Record<string, unknown>)}
            </div>
          </div>
        </div>
      );
    }

    // Handle scalar data
    return (
      <div className={`${indent === 0 ? '' : 'mb-4'} ml-${indent * 4}`} key={title}>
        <h3 className="text-lg font-semibold mb-3 flex items-center text-gray-800 dark:text-gray-100">
          <span className="mr-2">{icon}</span>
          {title}
        </h3>
        <div className="ml-6">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-600 text-gray-700 dark:text-gray-300">
            {data?.toString()}
          </div>
        </div>
      </div>
    );
  };

  // Map common profile sections to icons
  const sectionIcons: Record<string, string> = {
    'goals': '🎯',
    'personal_details': '👤',
    'health_information': '🏥',
    'coping_strategies': '🧠',
    'emotional_patterns': '😊',
    'triggers': '⚠️',
    'preferences': '👍',
    'engagement': '💬',
    'conversation_dynamics': '🗣️',
    'confidence_levels': '📊',
    'emotional_responses': '💭'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">

      <div className="columns-1 md:columns-2 gap-8 space-y-8">
        {Object.entries(profileData).map(([key, value]) => {
          // Format the key as a readable title
          const formattedKey = key
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          // Get icon for this section or use default
          const icon = sectionIcons[key] || '📝';

          return (
            <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600 break-inside-avoid">
              {renderSection(formattedKey, value, icon)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserProfileDisplay;