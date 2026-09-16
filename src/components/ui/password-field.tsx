import { useState, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/theme';
import { PASSWORD_MAX_BYTES } from '@/features/auth/credentials';
import { fonts, radius, space, touchTarget } from '@/theme/tokens';

import { Icon } from './icon';
import { AppText } from './text';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'secureTextEntry'> & {
  label: string;
  hint?: string;
  error?: string | null;
  ref?: Ref<TextInput>;
};

/**
 * Campo de senha: escondido por padrão, com um botão para mostrar enquanto se digita. O valor fica
 * só no estado da tela e vai direto para o Supabase Auth — nunca é guardado no aparelho.
 */
export function PasswordField({ label, hint, error, onFocus, onBlur, ref, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.gold : colors.hairline;

  return (
    <View style={styles.field}>
      <AppText variant="label" tone="secondary">{label}</AppText>
      <View>
        <TextInput
          ref={ref}
          {...rest}
          secureTextEntry={!visible}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          autoCapitalize="none"
          autoCorrect={false}
          // Um pouco acima do limite do bcrypt, para a validação explicar o motivo em vez de cortar.
          maxLength={PASSWORD_MAX_BYTES + 8}
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((value) => !value)}
          style={styles.toggle}>
          <Icon name={visible ? 'olhoFechado' : 'olho'} size={20} color={colors.gold} />
        </Pressable>
      </View>
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
    paddingLeft: space.lg,
    paddingRight: touchTarget + space.sm,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  toggle: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
