import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Create animated values for each bar
  const barAnims = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isActive) {
      // Animate bars based on metering level
      barAnims.forEach((anim, index) => {
        // Create varied heights for visual interest
        const offset = (index - Math.floor(barCount / 2)) / barCount;
        const targetHeight = Math.max(
          0.2,
          Math.min(1, metering + offset * 0.3 + Math.random() * 0.1)
        );

        Animated.timing(anim, {
          toValue: targetHeight,
          duration: 100,
          useNativeDriver: true,
        }).start();
      });
    } else {
      // Reset all bars to minimum
      barAnims.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [metering, isActive, barAnims]);

  const barColor = isActive
    ? Colors.recordingActive
    : isDark
    ? Colors.textTertiaryDark
    : Colors.textTertiary;

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
