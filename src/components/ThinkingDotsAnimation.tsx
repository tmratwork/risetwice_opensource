"use client";

import React, { useEffect, useRef, useDeferredValue } from 'react';

interface ThinkingDotsAnimationProps {
  isThinking: boolean;
  size?: number;
  dotCount?: number;
  dotSize?: number;
  dotColor?: string;
  animationDuration?: number;
}

export default function ThinkingDotsAnimation({
  isThinking = false,
  size = 200,
  dotCount = 12,
  dotSize = 4,
  dotColor = "#0066ff",
  animationDuration = 3000,
}: ThinkingDotsAnimationProps) {
  // Use deferred value to throttle rapid thinking state changes
  const deferredIsThinking = useDeferredValue(isThinking);
  
  // Log when the thinking state changes (minimal throttled)
  useEffect(() => {
    // Only log significant state changes, not rapid flickers (reduced logging)
    if (Math.random() < 0.05) { // 5% sampling to reduce log spam
      console.log(`[THINKING-ANIMATION] Thinking state changed to: ${deferredIsThinking}`);
    }

    // For very short thinking states, show all dots immediately
    if (deferredIsThinking) {
      // Skip the sequential appearance for fast feedback
      progressRef.current = 0.8; // Start with most dots already visible
    }
  }, [deferredIsThinking]);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const dotsRef = useRef<HTMLDivElement[]>([]);
  const progressRef = useRef<number>(0);
  const rotationRef = useRef<number>(0);
  const allDotsVisibleRef = useRef<boolean>(false);

  // Animation loop using deferred thinking state
  const animate = () => {
    if (!deferredIsThinking) {
      allDotsVisibleRef.current = false;
      progressRef.current = 0;
      rotationRef.current = 0;
      dotsRef.current.forEach(dot => {
        dot.style.opacity = '0';
        dot.style.transform = 'translate(-50%, -50%)';
      });
      return;
    }

    // Log when animation is active for debugging (very minimal)
    if (Math.random() < 0.001) { // Reduced to 0.1% to minimize log spam
      console.log(`[THINKING-DOTS-ANIMATION] Active - progress: ${progressRef.current.toFixed(2)}, allVisible: ${allDotsVisibleRef.current}, rotation: ${rotationRef.current.toFixed(2)}`);
    }

    // If we don't have a container or dots, we can't animate
    if (!containerRef.current || dotsRef.current.length === 0) {
      animationRef.current = requestAnimationFrame(animate);
      return;
    }

    // Calculate progress - dots appearing one by one (0 to 1)
    if (!allDotsVisibleRef.current) {
      // Increment progress at appropriate speed
      // Make the dots appear much faster - complete in 0.5 seconds instead of 3
      progressRef.current += 1 / (500 / 16.67); // ~60fps

      // Determine how many dots should be visible based on progress
      const visibleDots = Math.floor(progressRef.current * dotCount);

      // Show/hide dots based on progress
      dotsRef.current.forEach((dot, index) => {
        if (index < visibleDots) {
          dot.style.opacity = '1';
        } else {
          dot.style.opacity = '0';
        }
      });

      // Check if all dots are now visible
      if (progressRef.current >= 1) {
        allDotsVisibleRef.current = true;
        progressRef.current = 1;
      }
    } else {
      // All dots are visible, now rotate them clockwise
      rotationRef.current += 0.8; // Adjust speed of rotation as needed

      dotsRef.current.forEach((dot, index) => {
        // Apply rotation to all dots
        const angle = (index * (360 / dotCount)) + rotationRef.current;

        // Add transition for smooth rotation
        if (!dot.style.transition.includes('transform')) {
          dot.style.transition = dot.style.transition + ', transform 0.2s linear';
        }

        // Calculate orbit radius based on the size of the orb
        const orbitRadius = size / 2 + 1; // Just 1px from the edge
        dot.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(${-orbitRadius}px) rotate(-${angle}deg)`;
      });
    }

    // Continue the animation loop
    animationRef.current = requestAnimationFrame(animate);
  };

  // Set up and manage animation
  useEffect(() => {
    // Log when component mounts/updates (minimal)
    if (Math.random() < 0.1) { // Only log 10% of renders
      console.log(`[THINKING-DOTS] Component rendered - isThinking: ${isThinking}, dotCount: ${dotCount}, size: ${size}`);
    }

    // Create dots if they don't exist
    if (containerRef.current && dotsRef.current.length === 0) {
      const newDots: HTMLDivElement[] = [];

      for (let i = 0; i < dotCount; i++) {
        const dot = document.createElement('div');
        dot.className = 'thinking-dot';

        // Style the dot
        dot.style.position = 'absolute';
        // Style dots with theme-aware color
        dot.style.width = `${dotSize}px`;
        dot.style.height = `${dotSize}px`;
        dot.style.backgroundColor = dotColor;
        dot.style.borderRadius = '50%';
        dot.style.opacity = '0';
        dot.style.top = '50%';
        dot.style.left = '50%';
        dot.style.transform = 'translate(-50%, -50%)';
        dot.style.transition = 'opacity 0.05s ease-in-out'; // Faster opacity transition
        // Enhanced shadow for better visibility in both themes
        dot.style.boxShadow = `0 0 ${dotSize}px ${dotColor}, 0 1px 2px rgba(0,0,0,0.2)`;
        dot.style.zIndex = '20';

        // Place dots evenly around the circle (but hidden initially)
        const angle = i * (360 / dotCount);
        // Place dots closer to the orb's border
        const orbitRadius = size / 2 + 1; // Just 1px from the edge
        dot.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(${-orbitRadius}px) rotate(-${angle}deg)`;

        containerRef.current.appendChild(dot);
        newDots.push(dot);
      }

      dotsRef.current = newDots;
    }

    // Start or stop the animation based on deferred thinking state
    if (deferredIsThinking) {
      // Start animation
      animationRef.current = requestAnimationFrame(animate);
    } else {
      // Reset animation state
      allDotsVisibleRef.current = false;
      progressRef.current = 0;
      rotationRef.current = 0;

      // Hide all dots
      dotsRef.current.forEach(dot => {
        dot.style.opacity = '0';
      });

      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    // Cleanup on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Remove dots from DOM
      if (containerRef.current) {
        dotsRef.current.forEach(dot => {
          if (containerRef.current && containerRef.current.contains(dot)) {
            containerRef.current.removeChild(dot);
          }
        });
      }

      dotsRef.current = [];
    };
  }, [deferredIsThinking, dotCount, dotSize, dotColor, size, animationDuration]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        pointerEvents: 'none',
        zIndex: 40, // Increase z-index to ensure it's above everything
        top: '0',
        left: '0'
      }}
      data-thinking={deferredIsThinking ? 'true' : 'false'}
    />
  );
}