import { useFocusEffect } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { duration, easing } from '@/theme/motion';

import { useReducedMotionPreference } from './reduced-motion';

/**
 * Travessia ao abrir uma aba.
 *
 * Trocar de aba não empilha tela, então a transição do Stack não vale ali: sem isto a aba nova
 * aparece seca. A travessia mora **dentro** da tela, e não no `TabSlot`: embrulhar cada aba num
 * `Screen` próprio, lá no layout, parou a navegação inteira (22/09) -- a URL mudava e a tela não.
 *
 * Com "reduzir movimento" ligado no sistema, a tela aparece pronta.
 */
export function TabFade({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionPreference();
  const opacity = useSharedValue(1);

  useFocusEffect(
    useCallback(() => {
      if (reduced) {
        opacity.set(1);
        return;
      }
      opacity.set(0);
      opacity.set(withTiming(1, { duration: duration.fast, easing: easing.standard }));
    }, [opacity, reduced]),
  );

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return <Animated.View style={[styles.fill, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
