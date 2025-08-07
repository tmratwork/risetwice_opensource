// src/hooksV11/ThinkingStateIndicator.tsx

import React, { useEffect, useState } from 'react';
import useThinkingStateIntegration from './use-thinking-state-integration';

/**
 * Minimalist component for indicating thinking state
 * Can be added to existing UI without modifying WebRTC functionality
 */
interface ThinkingStateIndicatorProps {
  // Whether to show the indicator when not thinking
  showWhenIdle?: boolean;
  
  // Position of the indicator
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  
  // Styling variant
  variant?: 'minimal' | 'badge' | 'pill' | 'text';
  
  // Whether to show more detailed information
  detailed?: boolean;
  
  // Whether to show recovery suggestions on issues
  showSuggestions?: boolean;
  
  // Whether to use fixed positioning (doesn't apply to inline)
  fixed?: boolean;
  
  // Custom CSS class
  className?: string;
  
  // Custom handler for issue detection
  onIssueDetected?: (level: string, duration: number) => void;
}

export default function ThinkingStateIndicator({
  showWhenIdle = false,
  position = 'bottom-right',
  variant = 'pill',
  detailed = false,
  showSuggestions = false,
  fixed = true,
  className = '',
  onIssueDetected
}: ThinkingStateIndicatorProps) {
  // Use the integration hook
  const {
    isThinking,
    formattedDuration,
    hasIssue,
    issueLevel,
    issueMessage,
    getRecoverySuggestions
  } = useThinkingStateIntegration({
    autoStart: true,
    onIssueDetected: onIssueDetected 
      ? (level, duration) => onIssueDetected(level, duration)
      : undefined
  });
  
  // State for suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Get position classes
  const getPositionClasses = () => {
    if (position === 'inline') return '';
    
    if (!fixed) return '';
    
    switch (position) {
      case 'top-right':
        return 'fixed top-2 right-2';
      case 'top-left':
        return 'fixed top-2 left-2';
      case 'bottom-left':
        return 'fixed bottom-2 left-2';
      case 'bottom-right':
      default:
        return 'fixed bottom-2 right-2';
    }
  };
  
  // Get variant classes
  const getVariantClasses = () => {
    switch (variant) {
      case 'minimal':
        return 'w-3 h-3 rounded-full shadow-md';
      case 'badge':
        return 'px-2 py-1 rounded text-xs shadow-md';
      case 'text':
        return '';
      case 'pill':
      default:
        return 'px-3 py-1 rounded-full text-sm shadow-md';
    }
  };
  
  // Get color classes based on thinking state and issues
  const getColorClasses = () => {
    if (!isThinking) return 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    
    if (hasIssue) {
      switch (issueLevel) {
        case 'critical':
          return 'bg-red-500 text-white';
        case 'error':
          return 'bg-orange-500 text-white';
        case 'warning':
          return 'bg-yellow-500 text-white';
        default:
          return 'bg-blue-500 text-white';
      }
    }
    
    return 'bg-blue-500 text-white';
  };
  
  // Update suggestions when there's an issue
  useEffect(() => {
    if (hasIssue && showSuggestions) {
      const { suggestions } = getRecoverySuggestions();
      setSuggestions(suggestions);
    } else {
      setSuggestions([]);
    }
  }, [hasIssue, showSuggestions, getRecoverySuggestions]);
  
  // Don't render anything if not thinking and showWhenIdle is false
  if (!isThinking && !showWhenIdle) {
    return null;
  }
  
  // Minimal variant just shows a dot with appropriate color
  if (variant === 'minimal' && !detailed) {
    return (
      <div 
        className={`${getPositionClasses()} ${getVariantClasses()} ${getColorClasses()} ${className}`}
        title={isThinking ? `AI thinking: ${formattedDuration}` : 'AI idle'}
      ></div>
    );
  }
  
  // Standard display with text
  return (
    <div className={`${position === 'inline' ? 'inline-block' : 'block'} z-50`}>
      <div
        className={`${getPositionClasses()} ${getVariantClasses()} ${getColorClasses()} ${className} flex items-center transition-all duration-300`}
      >
        {/* Pulsing dot indicator */}
        <div className={`w-2 h-2 rounded-full mr-2 ${isThinking ? 'animate-pulse bg-white' : 'bg-gray-400'}`}></div>
        
        {/* Status text */}
        <span>
          {isThinking 
            ? (issueMessage || `AI thinking: ${formattedDuration}`)
            : 'AI idle'}
        </span>
      </div>
      
      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <div className={`mt-1 p-2 bg-white dark:bg-gray-800 border rounded shadow-lg text-sm max-w-xs ${getPositionClasses().includes('top-') ? 'mt-8' : ''}`}>
          <p className="font-medium mb-1 text-gray-800 dark:text-gray-200">Suggestions:</p>
          <ul className="list-disc pl-4 text-gray-600 dark:text-gray-400">
            {suggestions.slice(0, 2).map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
            {suggestions.length > 2 && (
              <li>
                <button 
                  onClick={() => getRecoverySuggestions().actions.find(a => a.label === 'Export Diagnostics')?.action()}
                  className="text-blue-500 hover:underline"
                >
                  View more details...
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}