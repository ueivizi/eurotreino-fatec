import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

import { tapFeedback } from './button';
import { Icon } from './icon';
import { NumberField } from './number-field';
import { AppText } from './text';

type Props = {
  label: string;
  hint: string;
  value: number | null;
  format: (value: number) => string;
  step: number;
  min: number;
  max: number;
  /** Valor sugerido ao ligar o detalhe. */
  start: number;
  /** Medidas que aceitam meio quilo ou meio quilômetro. */
  decimals?: boolean;
  disabled?: boolean;
  onChange: (value: number | null) => void;
};

/**
 * Detalhe opcional da modalidade (distância, séries, carga, frequência). Começa desligado: o fluxo
 * de 3 toques continua intacto para quem só quer registrar e sair. Quem liga, ajusta com os botões
 * de passo ou digitando o valor -- e pode remover de novo, que é o que diz ao servidor "esta medida
 * não existe neste treino".
 */
export function DetailRow({ label, hint, value, format, step, min, max, start, decimals, disabled = false, onChange }: Props) {
  const { colors } = useTheme();
  const active = value !== null;

  return (
    <View style={styles.group}>
      <View style={styles.row}>
        <View style={styles.headerText}>
          <AppText variant="bodyMedium">{label}</AppText>
          <AppText variant="caption" tone="muted">{active ? hint : 'Opcional'}</AppText>
        </View>
        {active ? (
          <NumberField
            label={label}
            value={value}
            onChange={onChange}
            min={min}
            max={max}
            step={step}
            format={format}
            decimals={decimals}
            disabled={disabled}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Informar ${label.toLowerCase()}`}
            disabled={disabled}
            onPress={() => {
              tapFeedback();
              onChange(start);
            }}
            style={[styles.chip, { borderColor: colors.hairline }]}>
            <Icon name="mais" size={16} color={colors.gold} />
            <AppText variant="label" tone="secondary">Informar</AppText>
          </Pressable>
        )}
      </View>
      {active ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remover ${label.toLowerCase()}`}
          disabled={disabled}
          onPress={() => {
            tapFeedback();
            onChange(null);
          }}
          style={styles.remove}>
          <AppText variant="caption" tone="muted">Remover</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: {
    flexShrink: 1,
    gap: space.xs,
  },
  chip: {
    minHeight: touchTarget - 4,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  remove: {
    alignSelf: 'flex-end',
    minHeight: touchTarget - 16,
    justifyContent: 'center',
    paddingHorizontal: space.xs,
  },
});
