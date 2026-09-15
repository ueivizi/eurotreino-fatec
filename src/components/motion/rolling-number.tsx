import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AppText, textVariantStyle, type TextTone, type TextVariant } from '@/components/ui/text';
import { duration, easing } from '@/theme/motion';

import { useReducedMotionPreference } from './reduced-motion';

/** Duas voltas de 0 a 9: a coluna sempre rola para frente quando o número sobe. */
const STRIP = Array.from({ length: 20 }, (_, index) => index % 10);

/** Mesmo teto de AppText para fonte dinâmica. */
const MAX_FONT_SCALE = 1.6;

type Typography = {
  variant: TextVariant;
  tone: TextTone;
  style?: StyleProp<TextStyle>;
  lineHeight: number;
};

type ColumnProps = Typography & {
  digit: number;
  initialDigit: number;
  rising: boolean;
  delay: number;
  reduced: boolean;
};

function DigitColumn({ digit, initialDigit, rising, delay, reduced, variant, tone, style, lineHeight }: ColumnProps) {
  const position = useSharedValue(initialDigit);
  // Dígito em que a coluna vai parar; só é lido e gravado dentro do efeito.
  const resting = useRef(initialDigit);

  useEffect(() => {
    const from = resting.current;
    if (digit === from) return;
    resting.current = digit;
    if (reduced) {
      position.set(digit);
      return;
    }
    // Subindo: 8 → 5 passa por 9 e 0 (índice 15); descendo: começa na segunda volta e desce.
    let target = digit;
    if (rising && (digit < from || position.get() >= 10)) target = digit + 10;
    if (!rising && digit > from) position.set(from + 10);
    position.set(
      withDelay(
        delay,
        withTiming(target, { duration: duration.reveal, easing: easing.standard }, (finished) => {
          'worklet';
          if (finished) position.set(target % 10);
        }),
      ),
    );
  }, [digit, rising, delay, reduced, position]);

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -position.get() * lineHeight }],
  }));

  return (
    <View style={{ height: lineHeight, overflow: 'hidden' }}>
      <Animated.View style={stripStyle}>
        {STRIP.map((value, index) => (
          <AppText
            key={index}
            variant={variant}
            tone={tone}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[style, styles.digit, { height: lineHeight, lineHeight }]}>
            {String(value)}
          </AppText>
        ))}
      </Animated.View>
    </View>
  );
}

type Props = {
  value: number;
  /** Valor exibido antes da primeira animação (ex.: 0 para contar desde o zero). */
  from?: number;
  prefix?: string;
  suffix?: string;
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Atraso da rolagem, em ms. */
  delay?: number;
  /** Texto para o leitor de tela; por padrão, prefixo + número + sufixo. */
  accessibilityLabel?: string;
};

/**
 * "Contagem": dígitos rolam como odômetro. Aceita inteiros não negativos (Glória, posição,
 * minutos, carga). Com "reduzir movimento", o número troca sem rolar.
 */
export function RollingNumber({
  value,
  from,
  prefix,
  suffix,
  variant = 'body',
  tone = 'primary',
  style,
  containerStyle,
  delay = 0,
  accessibilityLabel,
}: Props) {
  const reduced = useReducedMotionPreference();
  const { fontScale } = useWindowDimensions();
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const start = from !== undefined && Number.isFinite(from) ? Math.max(0, Math.round(from)) : safe;

  // Guarda o valor anterior para saber se a rolagem é para frente ou para trás.
  const [tracked, setTracked] = useState({ current: safe, previous: start });
  if (tracked.current !== safe) setTracked({ current: safe, previous: tracked.current });
  const rising = safe >= tracked.previous;

  const flat = StyleSheet.flatten([textVariantStyle(variant), style]);
  const baseLineHeight = flat.lineHeight ?? Math.round((flat.fontSize ?? 15) * 1.35);
  const lineHeight = Math.ceil(baseLineHeight * Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE));

  const digits = String(safe).split('').map(Number);
  const startDigits = String(start).padStart(digits.length, '0').slice(-digits.length).split('').map(Number);
  const typography = { variant, tone, style, lineHeight };

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `${prefix ?? ''}${safe}${suffix ?? ''}`}
      style={[styles.row, containerStyle]}>
      <View aria-hidden style={styles.row}>
        {prefix ? (
          <AppText {...typography} style={[style, { lineHeight }]}>
            {prefix}
          </AppText>
        ) : null}
        {digits.map((digit, index) => {
          const place = digits.length - index;
          return (
            <DigitColumn
              key={`casa-${place}`}
              {...typography}
              digit={digit}
              initialDigit={startDigits[index] ?? 0}
              rising={rising}
              // Casas mais altas começam um pouco depois: a leitura acompanha da unidade para a esquerda.
              delay={delay + (place - 1) * 40}
              reduced={reduced}
            />
          );
        })}
        {suffix ? (
          <AppText {...typography} style={[style, { lineHeight }]}>
            {suffix}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  digit: {
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
