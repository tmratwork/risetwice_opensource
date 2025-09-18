"use client";

import React, { useState, useRef, useEffect, forwardRef } from 'react';

interface InfoTooltipProps {
  content: string;
  className?: string;
}

interface TooltipContentProps {
  content: string;
  iconRef: React.RefObject<HTMLButtonElement>;
  isMobile: boolean;
}

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(({ content, iconRef, isMobile }, ref) => {
  const [position, setPosition] = useState<{ left: string; transform: string; arrowLeft: string }>({
    left: '50%',
    transform: 'translateX(-50%)',
    arrowLeft: '50%'
  });

  useEffect(() => {
    if (!iconRef.current) return;

    const iconRect = iconRef.current.getBoundingClientRect();
    const tooltipWidth = 320; // 80 * 4 (w-80 = 320px)
    const viewportWidth = window.innerWidth;
    const padding = 16; // 1rem padding from screen edges

    // Calculate ideal center position
    const iconCenter = iconRect.left + iconRect.width / 2;
    const tooltipHalfWidth = tooltipWidth / 2;

    // Check if tooltip would overflow left edge
    if (iconCenter - tooltipHalfWidth < padding) {
      // Position tooltip so it starts at padding distance from left edge
      const leftPosition = padding;
      const arrowPosition = ((iconCenter - leftPosition) / tooltipWidth) * 100;

      setPosition({
        left: `${leftPosition}px`,
        transform: 'translateX(0)',
        arrowLeft: `${Math.max(10, Math.min(90, arrowPosition))}%`
      });
    }
    // Check if tooltip would overflow right edge
    else if (iconCenter + tooltipHalfWidth > viewportWidth - padding) {
      // Position tooltip so it ends at padding distance from right edge
      const rightPosition = viewportWidth - padding;
      const leftPosition = rightPosition - tooltipWidth;
      const arrowPosition = ((iconCenter - leftPosition) / tooltipWidth) * 100;

      setPosition({
        left: `${leftPosition}px`,
        transform: 'translateX(0)',
        arrowLeft: `${Math.max(10, Math.min(90, arrowPosition))}%`
      });
    }
    // Default: center the tooltip
    else {
      setPosition({
        left: '50%',
        transform: 'translateX(-50%)',
        arrowLeft: '50%'
      });
    }
  }, [iconRef]);

  return (
    <div
      ref={ref}
      className={`absolute z-50 w-80 p-3 text-sm bg-gray-800 text-white rounded-lg shadow-lg transition-opacity duration-150 ${
        isMobile ? 'opacity-95' : 'opacity-90'
      }`}
      style={{
        left: position.left,
        transform: position.transform,
        bottom: 'calc(100% + 8px)',
        maxWidth: '90vw'
      }}
    >
      <div className="relative">
        {content}
        {/* Arrow pointing down */}
        <div
          className="absolute top-full transform -translate-x-1/2 w-0 h-0"
          style={{
            left: position.arrowLeft,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '6px solid #374151'
          }}
        />
      </div>
    </div>
  );
});

TooltipContent.displayName = 'TooltipContent';

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        iconRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !iconRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    if (isVisible && isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible, isMobile]);

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile) {
      setIsVisible(!isVisible);
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setIsVisible(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        ref={iconRef}
        type="button"
        onClick={handleIconClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="ml-1 w-4 h-4 rounded-full bg-gray-400 hover:bg-gray-500 text-white text-xs font-medium flex items-center justify-center cursor-help transition-colors duration-150"
        aria-label="Information"
      >
        i
      </button>

      {isVisible && (
        <TooltipContent
          ref={tooltipRef}
          content={content}
          iconRef={iconRef}
          isMobile={isMobile}
        />
      )}
    </div>
  );
};

export default InfoTooltip;