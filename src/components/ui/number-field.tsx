import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { AppText, textVariantStyle } from './text';

/* O texto que se digita vem da escala, sem a altura de linha (o Android corta em campo de uma linha). */
const { fontFamily, fontSize } = textVariantStyle('input');

function StepButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.step, { borderColor: colors.hairline, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={18} color={colors.gold} strokeWidth={1.8} />
    </Pressable>
  );
}

type Props = {
  /** Usado nos rótulos de acessibilidade ("Aumentar carga"). */
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Como mostrar o número quando não se está digitando (ex.: "62,5 kg"). */
  format: (value: number) => string;
  /** Aceita meio quilo, meio quilômetro e afins. Sem isto, só inteiro. */
  decimals?: boolean;
  /**
   * Menor fração aceita pelo que se digita. Os botões andam de `step` em `step`, mas quem digita
   * 47 minutos quer 47, não 45 — só a granularidade que o banco exige é aplicada (meio quilo).
   */
  snap?: number;
  disabled?: boolean;
};

/**
 * Número com os dois caminhos: os botões de passo para o dedo apressado e **o teclado para quem
 * sabe o valor**. Tocar no número abre o teclado; sair dele confirma.
 *
 * Enquanto se digita, o que vale é o texto cru — é isso que deixa escrever "12,5". Ligar o campo
 * direto ao número comia a vírgula no meio da digitação: `Number('12,')` vira 12, e o campo
 * voltava para "12" antes de a pessoa terminar (achado do teste de 22/09).
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  decimals = false,
  snap = decimals ? 0.5 : 1,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const [text, setText] = useState<string | null>(null);

  /** Passo de 2,5 em ponto flutuante rende 7,500000000000001: uma casa basta para o que o app aceita. */
  const tidy = (next: number) => (decimals ? Math.round(next * 10) / 10 : Math.round(next));
  const inRange = (next: number) => Math.min(max, Math.max(min, next));
  const byStep = (next: number) => tidy(inRange(Math.round(next / step) * step));

  function commit() {
    if (text !== null) {
      const parsed = Number(text.replace(',', '.'));
      if (Number.isFinite(parsed)) onChange(tidy(inRange(Math.round(parsed / snap) * snap)));
    }
    setText(null);
  }

  return (
    <View style={styles.row}>
      <StepButton icon="menos" label={`Diminuir ${label.toLowerCase()}`} disabled={disabled || value <= min} onPress={() => onChange(byStep(value - step))} />

      {text === null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${format(value)}. Toque para digitar.`}
          disabled={disabled}
          onPress={() => setText(decimals ? String(value).replace('.', ',') : String(value))}
          style={styles.value}>
          <AppText variant="bodyMedium" style={styles.centered} accessibilityLiveRegion="polite">{format(value)}</AppText>
        </Pressable>
      ) : (
        <TextInput
          value={text}
          onChangeText={(next) => {
            // Só dígitos e, quando a medida aceita, uma vírgula (ou ponto) só.
            const allowed = decimals ? next.replace(/[^0-9.,]/g, '').replace(/[.,](?=.*[.,])/g, '') : next.replace(/[^0-9]/g, '');
            setText(allowed);
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          returnKeyType="done"
          autoFocus
          selectTextOnFocus
          maxLength={7}
          accessibilityLabel={label}
          maxFontSizeMultiplier={1.4}
          style={[styles.value, styles.input, { color: colors.text, borderColor: colors.gold }]}
        />
      )}

      <StepButton icon="mais" label={`Aumentar ${label.toLowerCase()}`} disabled={disabled || value >= max} onPress={() => onChange(byStep(value + step))} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  step: {
    width: touchTarget,
    height: touchTarget,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    minWidth: 92,
    height: touchTarget,
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  input: {
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: space.sm,
    textAlign: 'center',
    fontFamily,
    fontSize,
  },
});
