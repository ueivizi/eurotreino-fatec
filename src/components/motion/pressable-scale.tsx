import type { ReactNode } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import * as haptics from '@/lib/haptics';
import { duration, spring } from '@/theme/motion';

import { useReducedMotionPreference } from './reduced-motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Escala ao pressionar; 1 desliga a escala. */
  scaleTo?: number;
  haptic?: 'tap' | 'select' | 'none';
};

/** Pressable que afunda com mola ao toque. Com "reduzir movimento", só escurece de leve. */
export function PressableScale({
  style,
  children,
  scaleTo = 0.97,
  haptic = 'tap',
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: Props) {
  const reduced = useReducedMotionPreference();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const amount = pressed.get();
    return reduced ? { opacity: 1 - 0.18 * amount } : { transform: [{ scale: 1 - (1 - scaleTo) * amount }] };
  });

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event: GestureResponderEvent) => {
        pressed.set(reduced ? withTiming(1, { duration: duration.instant }) : withSpring(1, spring.press));
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressed.set(reduced ? withTiming(0, { duration: duration.fast }) : withSpring(0, spring.pop));
        onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (haptic === 'tap') haptics.tap();
        else if (haptic === 'select') haptics.select();
        onPress?.(event);
      }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
