import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme } from '@/theme/theme';
import { fonts, type Palette } from '@/theme/tokens';

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyMedium'
  | 'button'
  | 'label'
  | 'caption'
  | 'overline'
  | 'motto'
  | 'stat';

export type TextTone = 'primary' | 'secondary' | 'muted' | 'gold' | 'goldHighlight' | 'onGold' | 'success' | 'danger';

export const TONE_TO_COLOR: Record<TextTone, keyof Palette> = {
  primary: 'text',
  secondary: 'textSecondary',
  muted: 'textMuted',
  gold: 'goldText',
  goldHighlight: 'goldHighlight',
  onGold: 'onGold',
  success: 'success',
  danger: 'danger',
};

type Props = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

export function AppText({ variant = 'body', tone = 'primary', style, maxFontSizeMultiplier = 1.6, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[styles[variant], { color: colors[TONE_TO_COLOR[tone]] }, style]}
    />
  );
}

/** Estilo tipográfico de uma variante, para componentes que medem o texto (ex.: números que rolam). */
export function textVariantStyle(variant: TextVariant): TextStyle {
  return styles[variant];
}

const styles: Record<TextVariant, TextStyle> = StyleSheet.create({
  display: { fontFamily: fonts.display, fontSize: 44, lineHeight: 52, letterSpacing: 1 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36 },
  heading: { fontFamily: fonts.display, fontSize: 22, lineHeight: 30 },
  subheading: { fontFamily: fonts.display, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22 },
  button: { fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17 },
  overline: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  motto: { fontFamily: fonts.motto, fontSize: 21, lineHeight: 28 },
  stat: { fontFamily: fonts.bodySemibold, fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] },
});
