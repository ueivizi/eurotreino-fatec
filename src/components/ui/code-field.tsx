import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { OTP_LENGTH, digitsForCode } from '@/features/auth/credentials';
import { useTheme } from '@/theme/theme';
import { fonts, radius, space } from '@/theme/tokens';

import { AppText } from './text';

/** Um quadrado por dígito, como no canvas: 56 pt de altura e 7 pt entre eles. */
const BOX_HEIGHT = 56;
const BOX_GAP = 7;

type Props = Omit<
  TextInputProps,
  'style' | 'placeholderTextColor' | 'value' | 'onChangeText' | 'maxLength' | 'keyboardType' | 'inputMode' | 'secureTextEntry' | 'multiline'
> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Quantos quadrados desenhar. O código pode ser mais curto: a tela é que valida o tamanho. */
  length?: number;
  hint?: string;
  error?: string | null;
};

/**
 * Campo de código com um quadrado por dígito (`CodigoDigitos` no canvas de design).
 *
 * O desenho é decoração: quem recebe o que se digita é um único campo de texto invisível esticado
 * sobre os quadrados. É isso que mantém o preenchimento automático do código do e-mail, a colagem
 * e o leitor de tela funcionando — oito campos separados anunciariam oito coisas e quebrariam os
 * dois. O cursor fica preso no fim do valor, senão um toque no meio da faixa invisível apagaria
 * um dígito do meio sem a pessoa ver onde está.
 */
export function CodeField({
  label,
  value,
  onChangeText,
  length = OTP_LENGTH,
  hint,
  error,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);

  const digits = Array.from({ length }, (_, index) => value[index] ?? '');
  const caret = focused && value.length < length ? value.length : -1;

  return (
    <View style={styles.field}>
      <AppText variant="label" tone="secondary">{label}</AppText>

      <Pressable accessible={false} onPress={() => input.current?.focus()}>
        {/* Só o campo invisível fala com o leitor de tela; os quadrados são desenho. */}
        <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {digits.map((digit, index) => {
            const filled = digit !== '';
            const borderColor = error
              ? colors.danger
              : index === caret
                ? colors.goldHighlight
                : filled
                  ? colors.hairlineStrong
                  : colors.hairlineSoft;
            return (
              <View
                // A posição é a identidade do quadrado: o de número 3 continua sendo o terceiro.
                key={index}
                style={[styles.box, { borderColor, backgroundColor: filled ? colors.surface : 'transparent' }]}>
                {/* O quadrado não pode crescer, então o dígito cresce menos que o resto do texto. */}
                <AppText style={[styles.digit, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{digit}</AppText>
              </View>
            );
          })}
        </View>

        <TextInput
          ref={input}
          {...rest}
          value={value}
          onChangeText={(text) => onChangeText(digitsForCode(text, length))}
          selection={{ start: value.length, end: value.length }}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint ?? `Código de ${length} dígitos.`}
          keyboardType="number-pad"
          inputMode="numeric"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          importantForAutofill="yes"
          maxLength={length}
          caretHidden
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, { color: 'transparent' }]}
        />
      </Pressable>

      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">{hint}</AppText>
      ) : (
        <AppText variant="caption" tone="muted">Um dígito por quadrado. Colar preenche tudo de uma vez.</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: space.xs,
  },
  row: {
    flexDirection: 'row',
    gap: BOX_GAP,
  },
  box: {
    flex: 1,
    height: BOX_HEIGHT,
    borderWidth: 1.5,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 28,
  },
  input: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // O texto de verdade fica transparente: os dígitos visíveis são os dos quadrados.
    fontSize: 22,
    textAlign: 'center',
  },
});
