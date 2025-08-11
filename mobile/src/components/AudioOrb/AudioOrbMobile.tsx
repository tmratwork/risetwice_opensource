import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useWebRTCStore } from '../../stores/webrtc-store';
import OrbVisualization from './OrbVisualization';

interface AudioOrbMobileProps {
  onPress?: () => void;
  size?: number;
}

export default function AudioOrbMobile({ onPress, size = 120 }: AudioOrbMobileProps) {
  const {
    isConnected,
    isAudioPlaying,
    isThinking,
    isMuted,
    currentVolume,
    toggleMute,
  } = useWebRTCStore();

  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const pulseAnimation = useRef(new Animated.Value(1)).current;

  // Animate based on audio state
  useEffect(() => {
    if (isAudioPlaying || isThinking) {
      // Pulse animation when AI is speaking or thinking
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Stop pulse animation
      pulseAnimation.setValue(1);
    }
  }, [isAudioPlaying, isThinking]);

  // Handle press animation
  const handlePressIn = () => {
    Animated.spring(scaleAnimation, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnimation, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      toggleMute();
    }
  };

  const getOrbColor = () => {
    if (!isConnected) return '#9CA3AF'; // Gray when disconnected
    if (isMuted) return '#EF4444'; // Red when muted
    if (isThinking) return '#F59E0B'; // Yellow when thinking
    if (isAudioPlaying) return '#10B981'; // Green when playing
    return '#3B82F6'; // Blue default
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.orbContainer,
            {
              width: size,
              height: size,
              transform: [
                { scale: scaleAnimation },
                { scale: pulseAnimation },
              ],
            },
          ]}
        >
          <OrbVisualization
            isActive={isAudioPlaying || isThinking}
            volume={currentVolume}
            color={getOrbColor()}
            size={size}
            isMuted={isMuted}
            isThinking={isThinking}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbContainer: {
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});