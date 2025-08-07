"use client";

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { audioLogger } from '@/hooksV15';
import { webrtcAudioIntegration } from '@/hooksV11/webrtc-audio-extensions';
import { useTheme } from '@/contexts/theme-context';
import ThinkingDotsAnimation from './ThinkingDotsAnimation';

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  angle: number;
  // New properties for smooth transitions
  targetSpeed: number;
  currentAnimationSpeed: number;
  targetOpacity: number;
  currentOpacity: number;
}

interface BlueOrbVoiceUIProps {
  isSpeaking?: boolean;
  isThinking?: boolean;
  isMuted?: boolean; // New prop to show mute state
  isFunctionExecuting?: boolean; // New prop to show function execution state
  currentVolume?: number; // Raw volume value from 0.0 to 1.0
  particleSizeMin?: number;
  particleSizeMax?: number;
  particleSpeedMin?: number;
  particleSpeedMax?: number;
  transitionSpeed?: number; // Controls how quickly visualization transitions
  className?: string;
  size?: number | string;
  onClick?: () => void; // New onClick handler for mute/unmute functionality
  draggable?: boolean; // New prop to enable/disable dragging
}

function BlueOrbVoiceUI({
  isSpeaking = false,
  isThinking = false,
  isMuted = false,
  isFunctionExecuting = false,
  currentVolume = 0,
  particleSizeMin = 20,
  particleSizeMax = 40,
  particleSpeedMin = 0.1,
  particleSpeedMax = 0.4,
  transitionSpeed = 0.2, // Increased for faster transitions = more obvious changes
  className = "",
  size = 250,
  onClick,
  draggable = false,
}: BlueOrbVoiceUIProps) {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const baseRadiusRef = useRef(120);
  const lastLoggedVolumeRef = useRef(0);
  const lastSpeakingStateRef = useRef(false);
  const instanceIdRef = useRef(`orb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Add refs to track the current state props
  const isSpeakingRef = useRef(isSpeaking);
  const currentVolumeRef = useRef(currentVolume);
  
  // Theme-aware thinking dots color
  const thinkingDotsColor = useMemo(() => {
    if (theme === 'dark') {
      return '#ffd700'; // Gold for dark mode (current color)
    } else {
      return '#374151'; // Dark gray for light mode (better contrast)
    }
  }, [theme]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasDraggedDistance, setHasDraggedDistance] = useState(false);
  const [hasBeenDragged, setHasBeenDragged] = useState(false); // Track if orb has ever been moved
  const dragStartPositionRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);

  // Update refs when props change
  // Enhanced audio level detection from WebRTC stream
  const [enhancedAudioLevel, setEnhancedAudioLevel] = useState<number>(0);
  const lastLogTimeRef = useRef(0);
  const LOG_THROTTLE_MS = 1000; // Only log once per second

  // Listener for direct WebRTC audio level events
  useEffect(() => {
    const handleAudioLevelEvent = (event: CustomEvent) => {
      if (event.detail && typeof event.detail.level === 'number') {
        // Convert 0-255 scale to 0-1 scale for compatibility
        const normalizedLevel = event.detail.level / 255;
        
        // Throttle logging - only log once per second
        const now = Date.now();
        if (now - lastLogTimeRef.current > LOG_THROTTLE_MS) {
          if (process.env.ENABLE_BLUE_ORB_ROTATION_LOGS === 'true') {
            console.log(`[BLUE-ORB-ROTATION] WebRTC audio level event received: ${event.detail.level} -> normalized: ${normalizedLevel}`);
          }
          lastLogTimeRef.current = now;
        }
        
        setEnhancedAudioLevel(normalizedLevel);
      }
    };

    // Listen for audio level events from the WebRTC audio integration
    window.addEventListener('webrtc-audio-level', handleAudioLevelEvent as EventListener);
    if (process.env.ENABLE_BLUE_ORB_ROTATION_LOGS === 'true') {
      console.log(`[BLUE-ORB-ROTATION] Registered webrtc-audio-level event listener`);
    }

    return () => {
      window.removeEventListener('webrtc-audio-level', handleAudioLevelEvent as EventListener);
      if (process.env.ENABLE_BLUE_ORB_ROTATION_LOGS === 'true') {
        console.log(`[BLUE-ORB-ROTATION] Unregistered webrtc-audio-level event listener`);
      }
    };
  }, []);

  // Use enhanced audio level if available, otherwise fallback to provided volume
  const effectiveVolume = enhancedAudioLevel > 0 ? enhancedAudioLevel : currentVolume;

  // Debug logging for volume data flow - throttled to prevent spam
  const lastVolumeLogRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastVolumeLogRef.current > LOG_THROTTLE_MS) {
      if (process.env.ENABLE_BLUE_ORB_ROTATION_LOGS === 'true') {
        console.log(`[BLUE-ORB-ROTATION] Volume data update: currentVolume=${currentVolume}, enhancedAudioLevel=${enhancedAudioLevel}, effectiveVolume=${effectiveVolume}, isSpeaking=${isSpeaking}`);
      }
      lastVolumeLogRef.current = now;
    }
  }, [currentVolume, enhancedAudioLevel, effectiveVolume, isSpeaking]);

  // Update refs when props change
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
    // Use enhanced volume if available, otherwise use the prop
    currentVolumeRef.current = effectiveVolume;
  }, [isSpeaking, currentVolume, effectiveVolume]);

  // Update colors when isFunctionExecuting changes
  useEffect(() => {
    const newColor = isFunctionExecuting ? [0, 102, 255] : [157, 187, 172];
    innerGlowRef.current.baseColor = newColor;
    innerGlowRef.current.targetColor = [...newColor];
    innerGlowRef.current.currentColor = [...newColor];
  }, [isFunctionExecuting]);

  // Track inner glow properties for smooth transitions
  const innerGlowRef = useRef({
    centerOpacity: isSpeaking ? 0.4 : 0.2,
    targetCenterOpacity: isSpeaking ? 0.4 : 0.2,
    midOpacity: isSpeaking ? 0.1 : 0.05,
    targetMidOpacity: isSpeaking ? 0.1 : 0.05,
    midStop: isSpeaking ? 0.4 : 0.6,
    targetMidStop: isSpeaking ? 0.4 : 0.6,
    baseColor: isFunctionExecuting ? [0, 102, 255] : [157, 187, 172], // Blue during function execution, green otherwise
    targetColor: isFunctionExecuting ? [0, 102, 255] : [157, 187, 172], // Target color
    currentColor: isFunctionExecuting ? [0, 102, 255] : [157, 187, 172], // Current interpolated color
    pulseSize: 1.0, // Size multiplier for pulsing effect
    targetPulseSize: 1.0, // Target pulse size
    shockwaves: [] as { radius: number, maxRadius: number, opacity: number }[] // For shockwave effects
  });

  // Initialize particles
  const initParticles = () => {
    // Only log this on initial creation, not on every state change
    if (particlesRef.current.length === 0 && currentVolumeRef.current > 0.05) {
      console.log(`[INIT-PARTICLES] Creating initial particles set`);
      audioLogger.info('orb', 'initialize_particles', {
        instanceId: instanceIdRef.current,
        particleCount: 20,
        initialVolume: currentVolumeRef.current
      });
    }

    const particles: Particle[] = [];
    const count = 20;

    for (let i = 0; i < count; i++) {
      const baseSpeed = Math.random() * particleSpeedMax + particleSpeedMin;
      const baseOpacity = Math.random() * 0.4 + 0.1;

      particles.push({
        x: Math.random() * baseRadiusRef.current * 1.5 - baseRadiusRef.current * 0.75,
        y: Math.random() * baseRadiusRef.current * 1.5 - baseRadiusRef.current * 0.75,
        size: Math.random() * particleSizeMax + particleSizeMin,
        speed: baseSpeed,
        opacity: baseOpacity,
        angle: Math.random() * Math.PI * 2,
        // Initialize transition properties
        targetSpeed: baseSpeed,
        currentAnimationSpeed: isSpeakingRef.current ? baseSpeed * 2 : baseSpeed * 0.5,
        targetOpacity: baseOpacity,
        currentOpacity: isSpeakingRef.current ? baseOpacity * 1.5 : baseOpacity,
      });
    }

    particlesRef.current = particles;
  };

  // Animation loop
  const animate = () => {
    // Use refs for the current state
    const isSpeaking = isSpeakingRef.current;
    const currentVolume = currentVolumeRef.current;

    // Log significant volume changes - heavily throttled to prevent spam
    if (currentVolume > 0.2 && Math.random() < 0.001 && // Only log very high volumes with 0.1% probability
      (Math.abs(currentVolume - lastLoggedVolumeRef.current) > 0.2 ||
        isSpeaking !== lastSpeakingStateRef.current)) {

      console.log(`[ANIMATE] Significant volume change: ${currentVolume.toFixed(4)}, isSpeaking=${isSpeaking}`);

      // Log to optimized audio logger (with throttling)
      audioLogger.debug('orb', 'volume_change', {
        instanceId: instanceIdRef.current,
        volume: currentVolume,
        previousVolume: lastLoggedVolumeRef.current,
        isSpeaking: isSpeaking,
        previousSpeakingState: lastSpeakingStateRef.current,
        timestamp: Date.now()
      });

      // Update refs
      lastLoggedVolumeRef.current = currentVolume;
      lastSpeakingStateRef.current = isSpeaking;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const baseRadius = baseRadiusRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw outer glow
    const gradient = ctx.createRadialGradient(
      centerX, centerY, baseRadius * 0.7,
      centerX, centerY, baseRadius * 1.3
    );
    // Use current color for gradient
    const [r, g, b] = innerGlowRef.current.currentColor;
    gradient.addColorStop(0, `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, 0.4)`);
    gradient.addColorStop(1, `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, 0)`);

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw base circle with current color
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, 0.2)`;
    ctx.fill();

    // Create clipping region for particles
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.clip();

    // Update and draw particles
    particlesRef.current.forEach((particle) => {
      // Update target values based on speaking state AND volume
      const volumeFactor = 1 + (currentVolume * 40); // 10x amplification for more dramatic effects
      particle.targetSpeed = isSpeaking
        ? particle.speed * (2 * volumeFactor) // Much faster with higher volume
        : particle.speed * 0.5;

      particle.targetOpacity = isSpeaking
        ? particle.opacity * (1.5 + currentVolume) // Brighter with higher volume
        : particle.opacity;

      // Debug logging removed to prevent infinite loop

      // Smoothly transition animation speed
      if (Math.abs(particle.currentAnimationSpeed - particle.targetSpeed) > 0.01) {
        particle.currentAnimationSpeed += (particle.targetSpeed - particle.currentAnimationSpeed) * transitionSpeed;
      } else {
        particle.currentAnimationSpeed = particle.targetSpeed;
      }

      // Smoothly transition opacity
      if (Math.abs(particle.currentOpacity - particle.targetOpacity) > 0.01) {
        particle.currentOpacity += (particle.targetOpacity - particle.currentOpacity) * transitionSpeed;
      } else {
        particle.currentOpacity = particle.targetOpacity;
      }

      // More dynamic, volume-reactive particle movement
      // Angle rotation speed also transitions based on speaking state and volume
      const angleSpeed = isSpeaking ? 0.05 + (currentVolume * 0.1) : 0.02;

      // Debug logging removed to prevent infinite loop

      // Add some chaotic motion when volume is high
      if (currentVolume > 0.2) {
        // Add randomness to angle when volume is high for more dramatic effect
        particle.angle += (particle.speed * angleSpeed) + (Math.random() - 0.5) * currentVolume * 0.3;
      } else {
        particle.angle += particle.speed * angleSpeed;
      }

      // Use the smoothly transitioning currentAnimationSpeed for movement
      // Add some "bounce" with higher volume (more particle movement)
      particle.x += Math.cos(particle.angle) * particle.currentAnimationSpeed;
      particle.y += Math.sin(particle.angle) * particle.currentAnimationSpeed;

      // Contain particles within the orb
      const distance = Math.sqrt(
        Math.pow(particle.x, 2) + Math.pow(particle.y, 2)
      );

      if (distance > baseRadius * 0.85) {
        // Redirect particles back toward center
        const angle = Math.atan2(particle.y, particle.x);
        particle.x = Math.cos(angle) * baseRadius * 0.85;
        particle.y = Math.sin(angle) * baseRadius * 0.85;
        particle.angle = angle + Math.PI + Math.random() * Math.PI / 2;
      }

      // Draw cloud-like particle
      const glowGradient = ctx.createRadialGradient(
        centerX + particle.x, centerY + particle.y, 0,
        centerX + particle.x, centerY + particle.y, particle.size
      );

      // Use the smoothly transitioning opacity value
      glowGradient.addColorStop(0, `rgba(255, 255, 255, ${particle.currentOpacity})`);
      glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.beginPath();
      ctx.arc(
        centerX + particle.x,
        centerY + particle.y,
        particle.size,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = glowGradient;
      ctx.fill();
    });

    ctx.restore();

    // Update inner glow target values based on speaking state AND volume
    const volumeBoost = currentVolume * 30; // Increased amplification factor (10x) for more dramatic effects

    // Log high volumes - very rarely to prevent spam
    if (currentVolume > 0.5 && Math.random() < 0.001) {
      console.log(`[VISUALIZER] Extremely high volume detected: ${currentVolume.toFixed(4)}`);
    }

    // Clamp values to ensure they stay in valid ranges
    innerGlowRef.current.targetCenterOpacity = isSpeaking ? Math.min(0.8, 0.4 + volumeBoost * 0.2) : 0.2;
    innerGlowRef.current.targetMidOpacity = isSpeaking ? Math.min(0.5, 0.1 + volumeBoost * 0.05) : 0.05;

    // CRITICAL FIX: Ensure midStop is always within 0.1-0.9 range to prevent gradient errors
    innerGlowRef.current.targetMidStop = isSpeaking
      ? Math.max(0.1, Math.min(0.9, 0.4 - volumeBoost * 0.05))
      : 0.6;

    // Color shift based on volume (blue to purple to cyan) - using a different color scheme
    // that avoids red (which is reserved for alerts/errors)
    if (isSpeaking) {
      // Calculate volume boost with reasonable amplification
      const safeVolumeBoost = Math.min(0.9, volumeBoost * 0.5);

      // Use purple/cyan color palette instead of red
      // Change from blue (0,102,255) to purple to cyan based on volume
      const r = Math.min(180, Math.floor(safeVolumeBoost * 180)); // Purple component grows with volume
      const g = Math.min(255, Math.floor(102 + safeVolumeBoost * 153)); // Green increases toward cyan
      const b = 255; // Keep blue at maximum

      // Create a new array instead of modifying in place to ensure update
      innerGlowRef.current.targetColor = [r, g, b];
    } else {
      // Return to base color (green or blue based on function execution state) when not speaking
      innerGlowRef.current.targetColor = [...innerGlowRef.current.baseColor];
    }

    // Update pulse size target - grow with volume (with safe limits)
    innerGlowRef.current.targetPulseSize = Math.max(0.5, Math.min(1.5, 1.0 + volumeBoost * 0.08)); // Limited pulse size

    // Create shockwaves only on significant volumes with reduced frequency
    if (isSpeaking && currentVolume > 0.05 && Math.random() < 0.1) {
      // Less frequent shockwaves for better performance
      innerGlowRef.current.shockwaves.push({
        radius: baseRadius * 0.3,
        maxRadius: baseRadius * (1.0 + Math.random() * 0.5),
        opacity: 0.3 + Math.random() * 0.3 // More subtle opacity
      });

      // Log significant volume shockwaves with audio logger - very rarely
      if (currentVolume > 0.5 && Math.random() < 0.01) {
        console.log(`[SHOCKWAVE] Created shockwave at extremely high volume ${currentVolume.toFixed(2)}`);

        audioLogger.debug('orb', 'shockwave_created', {
          instanceId: instanceIdRef.current,
          volume: currentVolume,
          shockwaveCount: innerGlowRef.current.shockwaves.length,
          maxRadius: baseRadius * (1.0 + Math.random() * 0.5),
          timestamp: Date.now(),
          isSpeaking: isSpeaking
        });
      }
    }

    // Smoothly transition the values
    innerGlowRef.current.centerOpacity += (innerGlowRef.current.targetCenterOpacity - innerGlowRef.current.centerOpacity) * transitionSpeed;
    innerGlowRef.current.midOpacity += (innerGlowRef.current.targetMidOpacity - innerGlowRef.current.midOpacity) * transitionSpeed;
    innerGlowRef.current.midStop += (innerGlowRef.current.targetMidStop - innerGlowRef.current.midStop) * transitionSpeed;
    innerGlowRef.current.pulseSize += (innerGlowRef.current.targetPulseSize - innerGlowRef.current.pulseSize) * transitionSpeed;

    // Transition color smoothly
    for (let i = 0; i < 3; i++) {
      innerGlowRef.current.currentColor[i] +=
        (innerGlowRef.current.targetColor[i] - innerGlowRef.current.currentColor[i]) * transitionSpeed;
    }

    // Draw shockwaves (if any)
    innerGlowRef.current.shockwaves.forEach((wave, index) => {
      const shockwaveGradient = ctx.createRadialGradient(
        centerX, centerY, wave.radius * 0.8,
        centerX, centerY, wave.radius
      );

      // Use current color for shockwaves
      const [r, g, b] = innerGlowRef.current.currentColor;
      shockwaveGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      shockwaveGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${wave.opacity})`);
      shockwaveGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(centerX, centerY, wave.radius, 0, Math.PI * 2);
      ctx.fillStyle = shockwaveGradient;
      ctx.fill();

      // Expand shockwave
      wave.radius += 2 + currentVolume * 6;
      wave.opacity *= 0.95; // Fade out

      // Remove if it's reached max size or faded out
      if (wave.radius > wave.maxRadius || wave.opacity < 0.02) {
        innerGlowRef.current.shockwaves.splice(index, 1);
      }
    });

    // Save context for pulse effect
    ctx.save();

    // Apply pulse scaling effect - grow and shrink with volume
    // CRITICAL FIX: Ensure pulse size is clamped to prevent rendering issues
    const pulseScale = Math.max(0.5, Math.min(1.5, innerGlowRef.current.pulseSize));
    ctx.translate(centerX, centerY);
    ctx.scale(pulseScale, pulseScale);
    ctx.translate(-centerX, -centerY);

    // Draw inner glow with smooth transitions and dynamic colors
    const innerGlow = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, baseRadius
    );

    // Use current interpolated color for gradient
    const [r2, g2, b2] = innerGlowRef.current.currentColor.map(Math.floor);

    innerGlow.addColorStop(0, `rgba(255, 255, 255, ${innerGlowRef.current.centerOpacity})`);
    innerGlow.addColorStop(innerGlowRef.current.midStop, `rgba(${r2}, ${g2}, ${b2}, ${innerGlowRef.current.midOpacity})`);
    innerGlow.addColorStop(1, `rgba(${r2}, ${g2}, ${b2}, 0)`);

    ctx.beginPath();
    ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
    ctx.fillStyle = innerGlow;
    ctx.fill();

    // Restore context after pulse effect
    ctx.restore();


    // Continue animation loop
    animationRef.current = requestAnimationFrame(animate);
  };

  // Handle canvas setup and resizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions
    const updateCanvasSize = () => {
      const canvasSize = typeof size === 'number' ? size : parseInt(size as string, 10) || 250;
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      baseRadiusRef.current = canvasSize / 3;
    };

    updateCanvasSize();

    // Log component mount
    audioLogger.info('orb', 'component_mount', {
      instanceId: instanceIdRef.current,
      initialVolume: currentVolume,
      isSpeaking: isSpeaking,
      size: size,
      timestamp: Date.now()
    });

    initParticles();

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      // Log component unmount
      audioLogger.info('orb', 'component_unmount', {
        instanceId: instanceIdRef.current,
        finalVolume: currentVolume,
        isSpeaking: isSpeaking,
        timestamp: Date.now()
      });

      audioLogger.debug('orb', 'animation_cycle_completed', {
        finalVolume: currentVolume,
        isSpeaking: isSpeaking,
        shockwaveCount: innerGlowRef.current.shockwaves.length
      });

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
    // ONLY CHANGE: Removed isSpeaking and currentVolume from dependencies
  }, [size, particleSizeMin, particleSizeMax, particleSpeedMin, particleSpeedMax]);

  // Only initialize particles when particle parameters change, not when speaking state changes
  useEffect(() => {
    initParticles();
  }, [particleSizeMin, particleSizeMax, particleSpeedMin, particleSpeedMax]);

  // Initialize position when draggable is enabled
  useEffect(() => {
    console.log('[DragBlueOrb] Initialize effect - draggable:', draggable, 'isInitialized:', isInitialized);

    if (draggable && !isInitialized) {
      // Set initial position to center of its container (relative positioning)
      const initialX = 0; // Center in container via CSS
      const initialY = 0; // Position normally in document flow

      console.log('[DragBlueOrb] Setting initial position:', { x: initialX, y: initialY });
      setPosition({ x: initialX, y: initialY });
      setIsInitialized(true);
    }
  }, [draggable]);

  // Drag functionality
  useEffect(() => {
    console.log('[DragBlueOrb] Drag effect - draggable:', draggable, 'isDragging:', isDragging);
    if (!draggable) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      // Check if user has dragged a meaningful distance (more than 5 pixels)
      const dragDistance = Math.sqrt(
        Math.pow(e.clientX - dragStartPositionRef.current.x, 2) +
        Math.pow(e.clientY - dragStartPositionRef.current.y, 2)
      );

      if (dragDistance > 5 && !hasDraggedDistance) {
        console.log('[DragBlueOrb] User has dragged meaningful distance:', dragDistance);
        setHasDraggedDistance(true);
        setHasBeenDragged(true); // Mark that orb has been moved from its default position
      }

      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      };
      console.log('[DragBlueOrb] Mouse move - new position:', newPosition);
      setPosition(newPosition);
    };

    const handleMouseUp = () => {
      console.log('[DragBlueOrb] Mouse up - ending drag, hasDraggedDistance:', hasDraggedDistance);
      setIsDragging(false);
      // Keep orb at its current position (don't reset)
      // Reset drag distance flag after a short delay to allow click handler to check it
      setTimeout(() => setHasDraggedDistance(false), 100);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      const touch = e.touches[0];
      if (touch) {
        // Check if user has dragged a meaningful distance (more than 5 pixels)
        const dragDistance = Math.sqrt(
          Math.pow(touch.clientX - dragStartPositionRef.current.x, 2) +
          Math.pow(touch.clientY - dragStartPositionRef.current.y, 2)
        );

        if (dragDistance > 5 && !hasDraggedDistance) {
          console.log('[DragBlueOrb] User has dragged meaningful distance (touch):', dragDistance);
          setHasDraggedDistance(true);
          setHasBeenDragged(true); // Mark that orb has been moved from its default position
        }

        const newPosition = {
          x: touch.clientX - dragOffset.x,
          y: touch.clientY - dragOffset.y
        };
        console.log('[DragBlueOrb] Touch move - new position:', newPosition);
        setPosition(newPosition);
      }
    };

    const handleTouchEnd = () => {
      console.log('[DragBlueOrb] Touch end - ending drag, hasDraggedDistance:', hasDraggedDistance);
      setIsDragging(false);
      // Keep orb at its current position (don't reset)
      // Reset drag distance flag after a short delay to allow click handler to check it
      setTimeout(() => setHasDraggedDistance(false), 100);
    };

    if (isDragging) {
      console.log('[DragBlueOrb] Adding event listeners for dragging');
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      console.log('[DragBlueOrb] Cleaning up event listeners');
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragOffset, draggable, hasDraggedDistance]);

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('[DragBlueOrb] Mouse down event - draggable:', draggable, 'event:', e);
    if (!draggable) {
      console.log('[DragBlueOrb] Not draggable, ignoring mouse down');
      return;
    }

    const rect = dragRef.current?.getBoundingClientRect();
    console.log('[DragBlueOrb] Element rect:', rect);
    if (rect) {
      const offset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      // Store the initial drag position to track distance moved
      dragStartPositionRef.current = { x: e.clientX, y: e.clientY };
      setHasDraggedDistance(false);

      // Convert from relative to fixed positioning when drag starts
      setPosition({ x: rect.left, y: rect.top });

      console.log('[DragBlueOrb] Starting drag - mouse position:', { x: e.clientX, y: e.clientY }, 'offset:', offset);
      setIsDragging(true);
      setDragOffset(offset);
    } else {
      console.log('[DragBlueOrb] No rect found, cannot start drag');
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    console.log('[DragBlueOrb] Touch start event - draggable:', draggable, 'touches:', e.touches.length);
    if (!draggable) {
      console.log('[DragBlueOrb] Not draggable, ignoring touch start');
      return;
    }

    const touch = e.touches[0];
    const rect = dragRef.current?.getBoundingClientRect();
    console.log('[DragBlueOrb] Touch rect:', rect, 'touch:', touch);
    if (touch && rect) {
      const offset = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
      // Store the initial drag position to track distance moved
      dragStartPositionRef.current = { x: touch.clientX, y: touch.clientY };
      setHasDraggedDistance(false);

      // Convert from relative to fixed positioning when drag starts
      setPosition({ x: rect.left, y: rect.top });

      console.log('[DragBlueOrb] Starting touch drag - touch position:', { x: touch.clientX, y: touch.clientY }, 'offset:', offset);
      setIsDragging(true);
      setDragOffset(offset);
    } else {
      console.log('[DragBlueOrb] No touch or rect found, cannot start drag');
    }
  };

  // Custom click handler that prevents click if user has dragged
  const handleClick = (e: React.MouseEvent) => {
    console.log('[DragBlueOrb] Click event - hasDraggedDistance:', hasDraggedDistance, 'onClick provided:', !!onClick);
    if (hasDraggedDistance) {
      console.log('[DragBlueOrb] Preventing click because user has dragged');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (onClick) {
      console.log('[DragBlueOrb] Executing onClick handler');
      onClick();
    }
  };

  // Memoized audio detection to prevent re-renders
  const isActuallyPlaying = useMemo(() => {
    return webrtcAudioIntegration.isAudioCurrentlyPlaying() || isSpeaking;
  }, [isSpeaking]);

  // Memoized speaking state calculation
  const effectiveSpeakingState = useMemo(() => {
    return isActuallyPlaying || (effectiveVolume > 0.02);
  }, [isActuallyPlaying, effectiveVolume]);

  // Memoized style object to prevent infinite re-renders
  const debugStyle = useMemo(() => ({
    borderRadius: '50%',
    transition: isDragging ? 'none' : 'all 0.2s ease-out',
    cursor: draggable ? (isDragging ? 'grabbing' : 'grab') : (onClick ? 'pointer' : 'default'),
    boxShadow: isMuted ? '0 0 0 2px rgba(255,0,0,0.2)' : 'none',
    userSelect: 'none' as const,
    ...(draggable && (isDragging || hasBeenDragged) && {
      position: 'fixed' as const,
      left: position.x,
      top: position.y,
      zIndex: isDragging ? 1000 : 10
    }),
    ...(draggable && !isDragging && !hasBeenDragged && {
      position: 'relative' as const,
      zIndex: 10
    })
  }), [isDragging, draggable, onClick, isMuted, position.x, position.y, hasBeenDragged]);

  // Only log on actual changes, not every render
  useEffect(() => {
    console.log('[DragBlueOrb] State changed - draggable:', draggable, 'isDragging:', isDragging, 'position:', position, 'isInitialized:', isInitialized);
  }, [draggable, isDragging, position.x, position.y, isInitialized]);

  useEffect(() => {
    console.log('[DragBlueOrb] Style changed:', debugStyle);
  }, [debugStyle]);

  return (
    <div
      ref={dragRef}
      className={`flex items-center justify-center ${className} ${onClick ? 'hover:opacity-90 active:opacity-80' : ''}`}
      style={{
        ...debugStyle,
        ...(draggable ? {} : { position: 'relative' }), // Ensure container is positioned relatively when not draggable
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      data-speaking={effectiveSpeakingState ? 'true' : 'false'}
      data-volume={effectiveVolume.toFixed(2)}
      data-enhanced-audio={enhancedAudioLevel > 0 ? 'true' : 'false'}
      data-instance-id={instanceIdRef.current}
      data-thinking={isThinking ? 'true' : 'false'} // Data attribute for debugging
      data-muted={isMuted ? 'true' : 'false'} // Data attribute for mute state
      data-function-executing={isFunctionExecuting ? 'true' : 'false'} // Data attribute for function execution state
      data-draggable={draggable ? 'true' : 'false'} // Data attribute for drag state
      title={draggable ? "Drag to move or click to toggle mute" : (isMuted ? "Click to unmute microphone" : "Click to mute microphone")}
    >
      <canvas ref={canvasRef} />
      {/* Mute indicator icon - microphone with slash */}
      {isMuted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="w-14 h-14 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center">
            <svg viewBox="0 0 100 100" width="36" height="36" xmlns="http://www.w3.org/2000/svg">
              <rect x="35" y="15" width="30" height="50" rx="15" fill="white" fillOpacity="0.7" />
              <path d="M25 55 C25 70 40 80 50 80 C60 80 75 70 75 55" stroke="white" strokeOpacity="0.7" strokeWidth="5" fill="none" />
              <line x1="50" y1="80" x2="50" y2="95" stroke="white" strokeOpacity="0.7" strokeWidth="5" />
              <line x1="35" y1="95" x2="65" y2="95" stroke="white" strokeOpacity="0.7" strokeWidth="5" />
              <line x1="20" y1="20" x2="80" y2="80" stroke="white" strokeOpacity="0.7" strokeWidth="5" />
            </svg>
          </div>
        </div>
      )}
      <ThinkingDotsAnimation
        isThinking={isThinking}
        size={typeof size === 'number' ? size : parseInt(size as string, 10) || 250}
        dotCount={12}
        dotSize={3}
        dotColor={thinkingDotsColor}
        animationDuration={500}
      />
    </div>
  );
}

// Export memoized component with optimized comparison to prevent unnecessary re-renders
export default React.memo(BlueOrbVoiceUI, (prevProps, nextProps) => {
  // Less sensitive volume threshold to reduce re-renders
  const volumeThreshold = 0.1; // 10% threshold (was 5%)
  const prevVolume = prevProps.currentVolume ?? 0;
  const nextVolume = nextProps.currentVolume ?? 0;
  const volumeEqual = Math.abs(prevVolume - nextVolume) < volumeThreshold;

  // Early return for major differences - re-render needed
  if (!volumeEqual || prevProps.isSpeaking !== nextProps.isSpeaking) {
    return false; // Re-render needed
  }

  // Skip other expensive comparisons if volume/speaking are the same
  // Only check critical props that actually affect rendering
  const criticalPropsEqual = (
    prevProps.isThinking === nextProps.isThinking &&
    prevProps.isMuted === nextProps.isMuted &&
    prevProps.isFunctionExecuting === nextProps.isFunctionExecuting &&
    prevProps.size === nextProps.size &&
    prevProps.draggable === nextProps.draggable
  );

  return criticalPropsEqual; // No re-render needed if critical props are equal
});