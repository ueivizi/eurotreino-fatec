import { StyleSheet, View } from 'react-native';

import { LegionBanner } from '@/components/legion/legion-banner';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import type { LegionStyle } from '@/features/legions/legions-parsers';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/** Selo do modo: clássica em tom neutro, competitiva em ouro com o mínimo da semana. */
export function ModeBadge({ mode, weeklyMinimum }: Pick<LegionStyle, 'mode' | 'weeklyMinimum'>) {
  const { colors } = useTheme();
  const competitive = mode === 'competitiva';
  return (
    <View
      style={[styles.badge, { borderColor: competitive ? colors.gold : colors.hairline, backgroundColor: competitive ? colors.selectedFill : 'transparent' }]}
      accessibilityLabel={competitive ? `Legião competitiva, mínimo de ${weeklyMinimum} treinos por semana` : 'Legião clássica'}>
      <Icon name={competitive ? 'espadas' : 'escudo'} size={13} color={competitive ? colors.goldHighlight : colors.textMuted} />
      <AppText variant="overline" tone={competitive ? 'goldHighlight' : 'muted'}>
        {competitive ? `Competitiva · mínimo ${weeklyMinimum}` : 'Clássica'}
      </AppText>
    </View>
  );
}

type Props = {
  legion: LegionStyle & { name: string; memberCount: number; role: 'owner' | 'member' };
  /** Na tela própria da Legião o nome já está no cabeçalho. */
  showName?: boolean;
};

/** Topo da Legião (quadro 2.4): o estandarte balançando, o nome, o modo e quantos são. */
export function LegionHero({ legion, showName = true }: Props) {
  return (
    <View style={styles.hero}>
      <LegionBanner emblem={legion.emblem} color={legion.bannerColor} width={84} />
      <View style={styles.text}>
        {showName ? (
          <AppText variant="heading" numberOfLines={2} accessibilityRole="header">{legion.name}</AppText>
        ) : null}
        <AppText variant="caption" tone="muted">
          {`${legion.role === 'owner' ? 'Você é o fundador · ' : ''}${legion.memberCount} de 50 membros`}
        </AppText>
        <ModeBadge mode={legion.mode} weeklyMinimum={legion.weeklyMinimum} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  text: {
    flex: 1,
    gap: space.xs,
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
  },
});
