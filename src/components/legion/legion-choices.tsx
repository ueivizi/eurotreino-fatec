import { Pressable, StyleSheet, View } from 'react-native';

import { BANNER_CLOTH } from '@/components/legion/legion-banner';
import { tapFeedback } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { LOUROS, SEASON_WEEKS } from '@/features/legions/louros';
import { WEEKLY_MINIMUMS, type LegionMode } from '@/features/legions/legions-parsers';
import { EMBLEM_COLORS, EMBLEM_COLOR_LABELS, type EmblemColor } from '@/features/profile/emblems';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const MODES: { id: LegionMode; icon: IconName; title: string; motto: string; points: string[] }[] = [
  {
    id: 'classica',
    icon: 'escudo',
    title: 'Clássica',
    motto: 'Leve, para criar o hábito',
    points: ['Todo treino soma Glória', 'Coliseu semanal com os amigos', 'Ninguém perde nada por faltar'],
  },
  {
    id: 'competitiva',
    icon: 'espadas',
    title: 'Competitiva',
    motto: 'Para quem quer ser cobrado',
    points: [
      `Temporadas de ${SEASON_WEEKS} semanas, com tabela de Louros`,
      `Cumpriu o mínimo: +${LOUROS.met}. Falhou: ${LOUROS.missed}`,
      `Pódio da semana: +${LOUROS.podium.join(', +')}`,
      'O pódio da temporada ganha Triunfos para o perfil',
    ],
  },
];

/** Clássica ou competitiva (modos de Legião). A Glória de ninguém cai em nenhum dos dois. */
export function ModePicker({ value, onChange, disabled = false }: { value: LegionMode; onChange: (mode: LegionMode) => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Modo da Legião">
      {MODES.map((mode) => {
        const selected = mode.id === value;
        return (
          <Pressable
            key={mode.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityLabel={`${mode.title}. ${mode.motto}. ${mode.points.join('. ')}.`}
            disabled={disabled}
            onPress={() => {
              tapFeedback();
              onChange(mode.id);
            }}
            style={[
              styles.mode,
              {
                backgroundColor: selected ? colors.selectedFill : colors.surface,
                borderColor: selected ? colors.gold : colors.hairlineSoft,
                borderWidth: selected ? 1.5 : 1,
              },
            ]}>
            <View style={styles.modeHead}>
              <View style={[styles.modeIcon, { borderColor: selected ? colors.gold : colors.hairline }]}>
                <Icon name={mode.icon} size={22} color={selected ? colors.goldHighlight : colors.textSecondary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="subheading">{mode.title}</AppText>
                <AppText variant="motto" tone="gold">{mode.motto}</AppText>
              </View>
              <View style={[styles.radio, { borderColor: selected ? colors.gold : colors.hairline }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: colors.gold }]} /> : null}
              </View>
            </View>
            {mode.points.map((point) => (
              <View key={point} style={styles.point}>
                <View style={[styles.bullet, { backgroundColor: selected ? colors.gold : colors.hairline }]} />
                <AppText variant="caption" tone="secondary" style={styles.flex}>{point}</AppText>
              </View>
            ))}
          </Pressable>
        );
      })}
    </View>
  );
}

const MINIMUM_OPTIONS = WEEKLY_MINIMUMS.map((minimum): { id: number; label: string } => ({ id: minimum, label: `${minimum} treinos` }));

/** Mínimo semanal da competitiva: quem fica abaixo perde Louros. */
export function MinimumPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (minimum: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.group}>
      <AppText variant="label" tone="secondary">Mínimo por semana</AppText>
      <SegmentedControl options={MINIMUM_OPTIONS} value={value} onChange={onChange} accessibilityLabel="Mínimo de treinos por semana" disabled={disabled} />
      <AppText variant="caption" tone="muted">
        {`Contam os treinos pontuados, até 2 por dia. Abaixo do mínimo, a semana tira ${Math.abs(LOUROS.missed)} Louros.`}
      </AppText>
    </View>
  );
}

/** Cor do pano do estandarte, mostrada no tom de tecido. */
export function BannerColorPicker({ value, onChange }: { value: EmblemColor; onChange: (color: EmblemColor) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <AppText variant="label" tone="secondary">Cor do pano</AppText>
      <View style={styles.swatches} accessibilityRole="radiogroup" accessibilityLabel="Cor do pano do estandarte">
        {EMBLEM_COLORS.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={EMBLEM_COLOR_LABELS[option]}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                tapFeedback();
                onChange(option);
              }}
              style={[
                styles.swatch,
                {
                  backgroundColor: BANNER_CLOTH[option].top,
                  borderColor: selected ? colors.goldHighlight : colors.hairlineSoft,
                  borderWidth: selected ? 3 : 1,
                },
              ]}
            />
          );
        })}
      </View>
      <AppText variant="caption" tone="muted">{EMBLEM_COLOR_LABELS[value]}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: space.sm,
  },
  mode: {
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
  },
  modeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: 44 + space.md,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  flex: {
    flex: 1,
  },
});
