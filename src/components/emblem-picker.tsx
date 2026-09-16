import { Pressable, StyleSheet, View } from 'react-native';

import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { tapFeedback } from '@/components/ui/button';
import { AppText } from '@/components/ui/text';
import {
  EMBLEMS,
  EMBLEM_COLORS,
  EMBLEM_COLOR_LABELS,
  EMBLEM_COLOR_TONES,
  EMBLEM_LABELS,
  type EmblemColor,
  type EmblemName,
} from '@/features/profile/emblems';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type Props = {
  label: string;
  value: EmblemName;
  onChange: (emblem: EmblemName) => void;
  /** Cor escolhida: o emblema inteiro é desenhado nela. Sem cor, a fileira não aparece
      (o estandarte da Legião usa o tom neutro do tema). */
  color?: EmblemColor;
  onChangeColor?: (color: EmblemColor) => void;
};

/** Emblema e cor no lugar de foto de perfil: nenhuma imagem para enviar, guardar ou moderar. */
export function EmblemPicker({ label, value, onChange, color, onChangeColor }: Props) {
  const { colors, name: themeName } = useTheme();
  return (
    <View style={styles.wrapper}>
      <AppText variant="label" tone="secondary">{label}</AppText>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {EMBLEMS.map((emblem) => {
          const selected = emblem === value;
          return (
            <Pressable
              key={emblem}
              accessibilityRole="radio"
              accessibilityLabel={EMBLEM_LABELS[emblem]}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                tapFeedback();
                onChange(emblem);
              }}
              style={[
                styles.option,
                {
                  backgroundColor: selected ? colors.selectedFill : 'transparent',
                  borderColor: selected ? colors.gold : colors.hairlineSoft,
                  borderWidth: selected ? 1.5 : 1,
                },
              ]}>
              <EmblemAvatar emblem={emblem} color={color} size={48} />
              <AppText variant="caption" tone={selected ? 'goldHighlight' : 'secondary'}>
                {EMBLEM_LABELS[emblem]}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {color && onChangeColor ? (
        <>
      <AppText variant="label" tone="secondary">Cor</AppText>
      <View style={styles.colors} accessibilityRole="radiogroup" accessibilityLabel="Cor do emblema">
        {EMBLEM_COLORS.map((option) => {
          const selected = option === color;
          const tone = EMBLEM_COLOR_TONES[option][themeName];
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={EMBLEM_COLOR_LABELS[option]}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                tapFeedback();
                onChangeColor(option);
              }}
              style={[
                styles.color,
                {
                  backgroundColor: tone,
                  borderColor: selected ? colors.text : colors.hairlineSoft,
                  borderWidth: selected ? 3 : 1,
                },
              ]}
            />
          );
        })}
      </View>
      <AppText variant="caption" tone="muted">{EMBLEM_COLOR_LABELS[color]}</AppText>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  color: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  wrapper: {
    gap: space.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  option: {
    width: '23.5%',
    paddingVertical: space.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    gap: space.xs,
  },
});
