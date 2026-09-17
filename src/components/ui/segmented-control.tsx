import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import * as haptics from '@/lib/haptics';
import { spring } from '@/theme/motion';
import { useTheme } from '@/theme/theme';
import { radius, touchTarget } from '@/theme/tokens';

import { AppText } from './text';

const PADDING = 3;
const GAP = 3;
/** Borda de 1 pt + recuo: a área de toque vertical cobre o controle inteiro. */
const SEGMENT_HIT_SLOP = { top: PADDING + 1, bottom: PADDING + 1 } as const;

type Option<T extends string | number> = { id: T; label: string };

type Props<T extends string | number> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (id: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

/** Seletor segmentado com "filete": o fundo dourado desliza até a opção escolhida. */
export function SegmentedControl<T extends string | number>({ options, value, onChange, accessibilityLabel, disabled = false }: Props<T>) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const [width, setWidth] = useState(0);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const offset = useSharedValue(selectedIndex);

  useEffect(() => {
    offset.set(reduced ? selectedIndex : withSpring(selectedIndex, spring.settle));
  }, [selectedIndex, reduced, offset]);

  const count = Math.max(1, options.length);
  const segment = width > 0 ? (width - PADDING * 2 - GAP * (count - 1)) / count : 0;

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.get() * (segment + GAP) }],
  }));

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.container, { borderColor: colors.hairline }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {segment > 0 ? (
        <Animated.View
          style={[styles.thumb, { width: segment, backgroundColor: colors.selectedFill, borderColor: colors.gold }, thumbStyle]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={String(option.id)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            // O segmento desenhado tem 42 pt; o toque vale até a borda do controle (50 pt), acima do
            // mínimo de 44 pt no iOS e 48 dp no Android (NF002).
            hitSlop={SEGMENT_HIT_SLOP}
            onPress={() => {
              if (selected) return;
              haptics.select();
              onChange(option.id);
            }}
            style={[
              styles.segment,
              // Antes de medir a largura, o fundo fica parado na opção escolhida.
              segment === 0 && selected ? { backgroundColor: colors.selectedFill, borderColor: colors.gold, borderWidth: 1 } : null,
            ]}>
            <AppText variant={selected ? 'button' : 'body'} tone={selected ? 'goldHighlight' : 'secondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: PADDING,
    gap: GAP,
  },
  thumb: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  segment: {
    flex: 1,
    minHeight: touchTarget - 6,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
