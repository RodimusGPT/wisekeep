import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/hooks';

interface AudioWaveformProps {
  metering: number; // 0-1 scale
  isActive: boolean;
  barCount?: number;
}

export function AudioWaveform({
  metering,
  isActive,
  barCount = 5,
}: AudioWaveformProps) {
  const { colors } = useTheme();

  // Create animated values for each bar
  const barAnims = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];

    if (isActive) {
      // Animate bars based on metering level
      barAnims.forEach((anim, index) => {
        // Create varied heights for visual interest
        const offset = (index - Math.floor(barCount / 2)) / barCount;
        const targetHeight = Math.max(
          0.2,
          Math.min(1, metering + offset * 0.3 + Math.random() * 0.1)
        );

        const animation = Animated.timing(anim, {
          toValue: targetHeight,
          duration: 100,
          useNativeDriver: Platform.OS !== 'web',
        });
        animations.push(animation);
        animation.start();
      });
    } else {
      // Reset all bars to minimum
      barAnims.forEach((anim) => {
        const animation = Animated.timing(anim, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: Platform.OS !== 'web',
        });
        animations.push(animation);
        animation.start();
      });
    }

    // Cleanup: stop animations and reset values when effect re-runs or component unmounts
    return () => {
      animations.forEach((anim) => anim.stop());
      // Reset animated values to initial state to prevent memory leaks
      barAnims.forEach((anim) => anim.setValue(0.3));
    };
  }, [metering, isActive, barAnims]);

  const barColor = isActive ? Colors.recordingActive : colors.textTertiary;

  return (
    <View style={styles.container}>
      {barAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: barColor,
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 6,
  },
  bar: {
    width: 8,
    height: 40,
    borderRadius: 4,
  },
});
