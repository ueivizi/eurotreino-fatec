import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankMedallion } from '@/components/rank/rank-medallion';
import { ScreenHeader } from '@/components/screen-header';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { TIERS, rankFromGlory } from '@/features/ranks/tiers';
import { fetchMyProgress } from '@/features/workouts/workouts-api';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { toRoman } from '@/lib/week';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const number = new Intl.NumberFormat('pt-BR');

/** Cursus Gloriae: a escada completa de ranks, com o estado bloqueado dos que faltam. */
export default function RanksScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });
  const rank = progress.data ? rankFromGlory(progress.data.totalGlory) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Cursus Gloriae" subtitle="Da Legião ao Olimpo" />

      <AppText tone="secondary">
        A Glória acumulada define o rank e nunca diminui. Cada rank tem três divisões, III, II e I. A disputa semanal
        entre amigos acontece à parte, na Arena.
      </AppText>

      {progress.isError ? <Notice tone="danger" message={errorMessage(progress.error)} /> : null}

      <View style={styles.list} accessibilityRole="list">
        {TIERS.map((tier) => {
          const unlocked = rank !== null && rank.glory >= tier.thresholds[0];
          const current = rank?.tierId === tier.id;
          const thresholds = tier.thresholds.map((value) => number.format(value)).join(' · ');
          const status = !rank
            ? thresholds
            : current
              ? `Você está aqui · ${rank.label}`
              : unlocked
                ? 'Conquistado'
                : `Libera com ${number.format(tier.thresholds[0])} de Glória`;

          return (
            <Card
              key={tier.id}
              style={[styles.tier, current && { borderColor: colors.gold }]}
              accessible
              accessibilityLabel={`${toRoman(tier.id)}, ${tier.name}, ${tier.material}. Divisões a partir de ${thresholds} de Glória. ${status}.`}>
              <RankMedallion tier={tier.id} size={72} locked={!unlocked} accessibilityLabel={tier.name} />
              <View style={styles.tierText}>
                <AppText variant="overline" tone="muted">{toRoman(tier.id)}</AppText>
                <AppText variant="subheading" tone={unlocked ? 'primary' : 'secondary'}>{tier.name}</AppText>
                <AppText variant="caption" tone="muted">{`${tier.material} · ${thresholds}`}</AppText>
                <AppText variant="label" tone={current ? 'goldHighlight' : 'secondary'}>{status}</AppText>
              </View>
            </Card>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  list: {
    gap: space.md,
  },
  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  tierText: {
    flex: 1,
    gap: 2,
  },
});
