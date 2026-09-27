import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion/reveal';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

import type { RankingEntry } from './arena-parsers';
import { rivalryFor } from './rivalry';

/** "Na sua mira": a próxima pessoa a passar no Coliseu da semana, e o que custa. */
export function RivalCard({ entries }: { entries: readonly RankingEntry[] }) {
  const { colors } = useTheme();
  const rivalry = rivalryFor(entries);
  if (!rivalry) return null;

  const title =
    rivalry.kind === 'chasing' ? 'Na sua mira' : rivalry.kind === 'tied' ? 'Empate no Coliseu' : 'Você lidera o Coliseu';
  const text =
    rivalry.kind === 'chasing'
      ? `Faltam ${rivalry.gap} de Glória para passar ${rivalry.rival.displayName}: cerca de ${rivalry.workouts} ${rivalry.workouts === 1 ? 'treino' : 'treinos'} de 30 min.`
      : rivalry.kind === 'tied'
        ? `Você e ${rivalry.rival.displayName} estão empatados. Um treino desempata.`
        : rivalry.rival
          ? `${rivalry.margin} de Glória à frente de ${rivalry.rival.displayName}. Segure até domingo.`
          : 'Você abriu a disputa da semana. Ninguém pontuou ainda além de você.';

  return (
    <Reveal delay={600}>
      <Card style={styles.card}>
        <View style={styles.row}>
          {rivalry.rival ? (
            <EmblemAvatar emblem={rivalry.rival.emblem} color={rivalry.rival.emblemColor} size={40} />
          ) : (
            <View style={[styles.icon, { borderColor: colors.gold }]}>
              <Icon name="arena" size={20} color={colors.goldHighlight} />
            </View>
          )}
          <View style={styles.text}>
            <AppText variant="overline" tone="gold">{title}</AppText>
            <AppText variant="label" tone="secondary">{text}</AppText>
          </View>
        </View>
        {rivalry.kind === 'chasing' ? (
          <ProgressBar value={rivalry.progress} delay={700} accessibilityLabel={`Sua Glória da semana perto da de ${rivalry.rival.displayName}`} />
        ) : null}
      </Card>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
