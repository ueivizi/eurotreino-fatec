import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { css, cubicBezier } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/motion/reveal';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const fadeIn = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });
const popIn = css.keyframes({
  from: { opacity: 0, transform: [{ scale: 0.92 }, { translateY: 16 }] },
  to: { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] },
});
const standardCurve = cubicBezier(0.2, 0, 0, 1);

export type SceneAction = { label: string; onPress: () => void; variant?: ButtonVariant };

type Props = {
  /** `full` para cerimônias (tela cheia); `card` para conquistas menores. */
  layout: 'full' | 'card';
  /** Frase anunciada pelo leitor de tela quando a cena abre. */
  announcement: string;
  /** Tocar fora dos botões (ou fora do cartão) pula a cena. */
  onSkip: () => void;
  actions: SceneAction[];
  /** Quando os botões aparecem, em ms (fim da batida principal). */
  actionsDelay: number;
  children: ReactNode;
};

/** Moldura comum das cerimônias: fundo escuro, filete de ouro e ações claras no fim. */
export function SceneFrame({ layout, announcement, onSkip, actions, actionsDelay, children }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotionPreference();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  const buttons = (
    <Reveal delay={reduced ? 0 : actionsDelay} style={styles.actions}>
      {actions.map((action) => (
        <Button key={action.label} label={action.label} onPress={action.onPress} variant={action.variant ?? 'primary'} />
      ))}
    </Reveal>
  );

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: layout === 'full' ? 'rgba(8,7,5,0.95)' : colors.scrim },
          { animationName: fadeIn, animationDuration: 220, animationFillMode: 'backwards' },
        ]}
      />
      {layout === 'full' ? (
        <Pressable accessible={false} onPress={onSkip} style={StyleSheet.absoluteFill}>
          <View style={[styles.frame, { borderColor: colors.hairlineSoft, top: insets.top + 14, bottom: insets.bottom + 14 }]} />
          <ScrollView
            contentContainerStyle={[
              styles.fullContent,
              { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxxl },
            ]}
            showsVerticalScrollIndicator={false}>
            <View style={styles.fullInner}>{children}</View>
            {buttons}
          </ScrollView>
        </Pressable>
      ) : (
        <Pressable accessible={false} onPress={onSkip} style={[StyleSheet.absoluteFill, styles.cardHost]}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: colors.surfaceRaised, borderColor: colors.hairline },
              reduced
                ? { animationName: fadeIn, animationDuration: 150 }
                : { animationName: popIn, animationDuration: 420, animationTimingFunction: standardCurve, animationFillMode: 'backwards' },
            ]}>
            {/* Toques dentro do cartão não pulam a cena: só os de fora. */}
            <Pressable accessible={false} onPress={() => undefined} style={styles.cardInner}>
              {children}
            </Pressable>
            {buttons}
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderWidth: 1,
    pointerEvents: 'none',
  },
  fullContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xxl + space.sm,
    gap: space.xxl,
  },
  fullInner: {
    alignItems: 'center',
    gap: space.md,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  cardHost: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderRadius: radius.sheet,
    padding: space.xxl,
    gap: space.xl,
    overflow: 'hidden',
  },
  cardInner: {
    alignItems: 'center',
    gap: space.sm,
  },
  actions: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
    gap: space.sm,
  },
});
