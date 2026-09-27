import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import * as haptics from '@/lib/haptics';
import { spring } from '@/theme/motion';
import { useTheme } from '@/theme/theme';
import { goldGradient, space, touchTarget } from '@/theme/tokens';

const SLOTS = 6;
const INDICATOR = 28;

/** Posição de cada aba na barra (o medalhão Registrar ocupa a terceira). */
function slotOf(pathname: string): number | null {
  if (pathname === '/') return 0;
  if (pathname.startsWith('/arena')) return 1;
  if (pathname.startsWith('/mapa')) return 3;
  if (pathname.startsWith('/legiao')) return 4;
  if (pathname.startsWith('/perfil')) return 5;
  return null;
}

type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName };

function TabButton({ isFocused, label, icon, onPress, ...props }: TabButtonProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const pop = useSharedValue(1);
  const color = isFocused ? colors.goldHighlight : colors.textMuted;

  useEffect(() => {
    if (!isFocused || reduced) return;
    pop.set(withSequence(withTiming(0.82, { duration: 70 }), withSpring(1, spring.pop)));
  }, [isFocused, reduced, pop]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Pressable
      {...props}
      onPress={(event) => {
        if (!isFocused) haptics.select();
        onPress?.(event);
      }}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}>
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={24} color={color} />
      </Animated.View>
      <AppText variant="tab" style={{ color }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function RegisterButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel="Registrar treino"
      scaleTo={0.9}
      onPress={() => router.push('/registrar')}
      style={styles.tab}>
      <View style={[styles.medallion, { borderColor: colors.tabBar }]}>
        <LinearGradient
          colors={goldGradient.colors}
          locations={goldGradient.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* zIndex explícito: na Web o gradiente absoluto seria pintado por cima do SVG. */}
        <View style={styles.medallionIcon}>
          <Icon name="registrar" size={26} color={colors.onGold} strokeWidth={1.8} />
        </View>
      </View>
      <AppText variant="tab" tone="gold">
        Registrar
      </AppText>
    </PressableScale>
  );
}

/** Filete dourado que desliza até a aba ativa. */
function ActiveIndicator({ slot, width }: { slot: number | null; width: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const slotWidth = width / SLOTS;
  const target = slot === null ? 0 : slot * slotWidth + slotWidth / 2 - INDICATOR / 2;
  const x = useSharedValue(target);
  const placed = useRef(false);

  useEffect(() => {
    if (width === 0 || slot === null) return;
    // Na primeira medida o filete já nasce no lugar; depois, desliza com mola.
    x.set(placed.current && !reduced ? withSpring(target, spring.settle) : target);
    placed.current = true;
  }, [width, slot, target, reduced, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  if (width === 0 || slot === null) return null;
  return <Animated.View style={[styles.indicator, { backgroundColor: colors.goldHighlight }, style]} />;
}

/** Barra de abas com o medalhão central de registro (fluxo de 3 toques). */
export function TabBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [width, setWidth] = useState(0);

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[
        styles.bar,
        { backgroundColor: colors.tabBar, borderTopColor: colors.hairlineSoft, paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}>
      <ActiveIndicator slot={slotOf(pathname)} width={width} />
      <TabTrigger name="inicio" asChild>
        <TabButton label="Início" icon="inicio" />
      </TabTrigger>
      <TabTrigger name="arena" asChild>
        <TabButton label="Coliseu" icon="arena" />
      </TabTrigger>
      <RegisterButton />
      <TabTrigger name="mapa" asChild>
        <TabButton label="Mapa" icon="mapa" />
      </TabTrigger>
      <TabTrigger name="legiao" asChild>
        <TabButton label="Legião" icon="legiao" />
      </TabTrigger>
      <TabTrigger name="perfil" asChild>
        <TabButton label="Perfil" icon="perfil" />
      </TabTrigger>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: space.sm,
  },
  indicator: {
    position: 'absolute',
    top: -1,
    left: 0,
    width: INDICATOR,
    height: 2,
    borderRadius: 1,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space.xs,
  },
  medallion: {
    width: 60,
    height: 60,
    marginTop: -30,
    borderRadius: 30,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionIcon: {
    position: 'relative',
    zIndex: 1,
  },
});
