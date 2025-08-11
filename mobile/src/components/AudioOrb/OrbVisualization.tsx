import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface OrbVisualizationProps {
  isActive: boolean;
  volume: number;
  color: string;
  size: number;
  isMuted: boolean;
  isThinking: boolean;
}

export default function OrbVisualization({
  isActive,
  volume,
  color,
  size,
  isMuted,
  isThinking,
}: OrbVisualizationProps) {
  const particleAnimations = useRef(
    Array.from({ length: 12 }, () => ({
      opacity: new Animated.Value(0.3),
      scale: new Animated.Value(1),
      rotation: new Animated.Value(0),
    }))
  ).current;

  // Animate particles when active
  useEffect(() => {
    if (isActive && !isMuted) {
      // Start particle animations
      particleAnimations.forEach((particle, index) => {
        const delay = index * 100;
        
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(particle.opacity, {
                toValue: 0.8,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(particle.scale, {
                toValue: 1 + (volume * 0.5),
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(particle.rotation, {
                toValue: 360,
                duration: 2000,
                useNativeDriver: true,
              }),
            ]),
            Animated.parallel([
              Animated.timing(particle.opacity, {
                toValue: 0.3,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(particle.scale, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
          ])
        ).start();
      });
    } else {
      // Stop animations and reset
      particleAnimations.forEach((particle) => {
        particle.opacity.setValue(0.3);
        particle.scale.setValue(1);
        particle.rotation.setValue(0);
      });
    }
  }, [isActive, isMuted, volume]);

  const orbRadius = size / 2;
  const particleRadius = 4;
  const particleDistance = orbRadius * 0.8;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Main orb using View instead of SVG */}
      <View
        style={[
          styles.mainOrb,
          {
            width: size - 4,
            height: size - 4,
            borderRadius: (size - 4) / 2,
            backgroundColor: color,
            borderWidth: 2,
            borderColor: color,
            opacity: 0.8,
          },
        ]}
      >
        {/* Center indicator */}
        <View
          style={[
            styles.centerIndicator,
            {
              width: isMuted ? 16 : isThinking ? 24 : 12,
              height: isMuted ? 16 : isThinking ? 24 : 12,
              borderRadius: isMuted ? 8 : isThinking ? 12 : 6,
              backgroundColor: color,
              opacity: isMuted ? 0.3 : isThinking ? 0.8 : 0.6,
            },
          ]}
        />
      </View>

      {/* Particle system */}
      {particleAnimations.map((particle, index) => {
        const angle = (index * 360) / particleAnimations.length;
        const angleRad = (angle * Math.PI) / 180;
        const x = orbRadius + Math.cos(angleRad) * particleDistance;
        const y = orbRadius + Math.sin(angleRad) * particleDistance;

        return (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                left: x - particleRadius,
                top: y - particleRadius,
                width: particleRadius * 2,
                height: particleRadius * 2,
                backgroundColor: color,
                opacity: particle.opacity,
                transform: [
                  { scale: particle.scale },
                  { 
                    rotate: particle.rotation.interpolate({
                      inputRange: [0, 360],
                      outputRange: ['0deg', '360deg'],
                    })
                  },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainOrb: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerIndicator: {
    position: 'absolute',
  },
  particle: {
    position: 'absolute',
    borderRadius: 4,
  },
});