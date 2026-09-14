import { useState, type Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/theme';
import { fonts, radius, space, touchTarget } from '@/theme/tokens';

import { AppText } from './text';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  hint?: string;
  error?: string | null;
  ref?: Ref<TextInput>;
};

export function TextField({ label, hint, error, onFocus, onBlur, ref, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.gold : colors.hairline;

  return (
    <View style={styles.field}>
      <AppText variant="label" tone="secondary">{label}</AppText>
      <TextInput
        ref={ref}
        {...rest}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        maxFontSizeMultiplier={1.6}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, { borderColor, color: colors.text, backgroundColor: colors.surface }]}
      />
      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  input: {
    minHeight: touchTarget + 4,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    fontFamily: fonts.body,
    fontSize: 16,
  },
});
