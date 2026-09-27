import { Fragment, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { OTP_LENGTH, digitsForCode } from '@/features/auth/credentials';
import { useTheme } from '@/theme/theme';
import { fonts, radius, space } from '@/theme/tokens';

import { AppText } from './text';

/** Um quadrado por símbolo, como no canvas: 56 pt de altura e 7 pt entre eles. */
const BOX_HEIGHT = 56;
const BOX_GAP = 7;

type Props = Omit<
  TextInputProps,
  'style' | 'placeholderTextColor' | 'value' | 'onChangeText' | 'maxLength' | 'inputMode' | 'secureTextEntry' | 'multiline'
> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Quantos quadrados desenhar. O código pode ser mais curto: a tela é que valida o tamanho. */
  length?: number;
  /** Como limpar o que a pessoa digita ou cola. O padrão guarda só dígitos (código do e-mail). */
  sanitize?: (text: string, length: number) => string;
  /** Desenha um traço depois deste quadrado, como no código da Legião (XXXX-XXXX). */
  separatorAfter?: number;
  hint?: string;
  error?: string | null;
};

/**
 * Campo de código com um quadrado por símbolo (`CodigoDigitos` no canvas de design).
 *
 * O desenho é decoração: quem recebe o que se digita é um único campo de texto invisível esticado
 * sobre os quadrados. É isso que mantém o preenchimento automático do código do e-mail, a colagem
 * e o leitor de tela funcionando — oito campos separados anunciariam oito coisas e quebrariam os
 * dois. O cursor fica preso no fim do valor, senão um toque no meio da faixa invisível apagaria
 * um símbolo do meio sem a pessoa ver onde está.
 *
 * O campo fica invisível por `opacity`, não por cor transparente: no Android o texto aparecia por
 * cima dos quadrados mesmo com `color: 'transparent'` (achado no teste em aparelho de 22/09).
 */
export function CodeField({
  label,
  value,
  onChangeText,
  length = OTP_LENGTH,
  sanitize = digitsForCode,
  separatorAfter,
  hint,
  error,
  onFocus,
  onBlur,
  keyboardType = 'number-pad',
  ...rest
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const input = useRef<TextInput>(null);

  const numerico = keyboardType === 'number-pad';
  const symbols = Array.from({ length }, (_, index) => value[index] ?? '');
  const caret = focused && value.length < length ? value.length : -1;

  return (
    <View style={styles.field}>
      <AppText variant="label" tone="secondary">{label}</AppText>

      <Pressable accessible={false} onPress={() => input.current?.focus()}>
        {/* Só o campo invisível fala com o leitor de tela; os quadrados são desenho. */}
        <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {symbols.map((symbol, index) => {
            const filled = symbol !== '';
            const borderColor = error
              ? colors.danger
              : index === caret
                ? colors.goldHighlight
                : filled
                  ? colors.hairlineStrong
                  : colors.hairlineSoft;
            // O traço fica entre os quadrados, fora deles: dentro, ele roubava a largura do 4º.
            return (
              <Fragment
                // A posição é a identidade do quadrado: o de número 3 continua sendo o terceiro.
                key={index}>
                <View style={[styles.box, { borderColor, backgroundColor: filled ? colors.surface : 'transparent' }]}>
                  {/* O quadrado não pode crescer, então o símbolo cresce menos que o resto do texto. */}
                  <AppText style={[styles.symbol, { color: colors.text }]} maxFontSizeMultiplier={1.3}>{symbol}</AppText>
                </View>
                {separatorAfter === index + 1 ? (
                  <View style={[styles.separator, { backgroundColor: colors.hairlineStrong }]} />
                ) : null}
              </Fragment>
            );
          })}
        </View>

        {/* O preenchimento automático de código só vale para o do e-mail; o da Legião é digitado. */}
        <TextInput
          ref={input}
          keyboardType={keyboardType}
          autoComplete={numerico ? 'one-time-code' : 'off'}
          textContentType={numerico ? 'oneTimeCode' : 'none'}
          autoCapitalize={numerico ? 'none' : 'characters'}
          autoCorrect={false}
          importantForAutofill="yes"
          {...rest}
          value={value}
          onChangeText={(text) => onChangeText(sanitize(text, length))}
          selection={{ start: value.length, end: value.length }}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint ?? `Código de ${length} símbolos.`}
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
          style={styles.input}
        />
      </Pressable>

      {error ? (
        <AppText variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">{hint}</AppText>
      ) : (
        <AppText variant="caption" tone="muted">Um símbolo por quadrado. Colar preenche tudo de uma vez.</AppText>
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
    alignItems: 'center',
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
  separator: {
    width: BOX_GAP * 1.5,
    height: 1.5,
  },
  symbol: {
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
    // Invisível de verdade: no Android o texto atravessava os quadrados com `color: 'transparent'`.
    opacity: 0,
    fontSize: 22,
    textAlign: 'center',
  },
});
