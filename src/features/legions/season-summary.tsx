import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Reveal } from '@/components/motion/reveal';
import { RollingNumber } from '@/components/motion/rolling-number';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { LOUROS, SEASON_WEEKS, missingForMinimum } from '@/features/legions/louros';
import type { LegionSummary } from '@/features/legions/legions-parsers';
import { fetchSeasonTable } from '@/features/legions/season-api';
import { queryKeys } from '@/lib/query-client';
import { spring, staggerDelay } from '@/theme/motion';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

/** Um treino do mínimo: acende com um "pop" quando conta. */
function MinimumDot({ done, index }: { done: boolean; index: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const scale = useSharedValue(reduced ? 1 : 0.4);

  useEffect(() => {
    scale.set(reduced ? 1 : withDelay(staggerDelay(index, 200), withSpring(1, spring.pop)));
  }, [reduced, index, scale, done]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { borderColor: done ? colors.gold : colors.hairline, backgroundColor: done ? colors.gold : 'transparent' },
        style,
      ]}>
      {done ? <Icon name="check" size={14} color={colors.onGold} strokeWidth={2} /> : null}
    </Animated.View>
  );
}

/**
 * Cartão da temporada competitiva: Louros, posição e o mínimo da semana em bolinhas. É o lembrete
 * de que faltar custa — sem mexer na Glória de ninguém.
 */
export function SeasonSummary({ legion }: { legion: LegionSummary }) {
  const { colors } = useTheme();
  const router = useRouter();
  const season = useQuery({
    queryKey: queryKeys.season(legion.id, 0),
    queryFn: () => fetchSeasonTable(legion.id, 0),
    enabled: legion.mode === 'competitiva',
  });

  if (legion.mode !== 'competitiva') return null;

  const me = season.data?.entries.find((entry) => entry.isMe) ?? null;
  const minimum = season.data?.weeklyMinimum ?? legion.weeklyMinimum ?? 0;
  const scored = me?.weekScored ?? 0;
  const missing = missingForMinimum(scored, minimum);
  const started = (season.data?.seasonWeek ?? 0) > 0;
  const total = season.data?.entries.length ?? 0;

  return (
    <Reveal>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.inline}>
            <Icon name="arena" size={18} color={colors.gold} />
            <AppText variant="overline" tone="gold">Temporada</AppText>
          </View>
          <AppText variant="caption" tone="muted">
            {season.data && started
              ? `semana ${season.data.seasonWeek} de ${SEASON_WEEKS}`
              : legion.modeSince
                ? `começa ${dayFormat.format(new Date(`${legion.modeSince}T00:00:00Z`))}`
                : ''}
          </AppText>
        </View>

        {season.isPending ? (
          <ActivityIndicator color={colors.gold} />
        ) : !me ? (
          <AppText tone="secondary">A tabela da temporada aparece aqui assim que ela começar.</AppText>
        ) : (
          <>
            <View style={styles.row}>
              <View>
                <RollingNumber value={me.louros} from={0} variant="stat" tone="goldHighlight" />
                <AppText variant="caption" tone="muted">Louros na temporada</AppText>
              </View>
              {started ? (
                <View style={styles.place}>
                  <AppText variant="heading">{`${me.place}º`}</AppText>
                  <AppText variant="caption" tone="muted">{`de ${total}`}</AppText>
                </View>
              ) : null}
            </View>

            <View style={styles.dots} accessible accessibilityLabel={`${Math.min(scored, minimum)} de ${minimum} treinos do mínimo desta semana`}>
              {Array.from({ length: minimum }, (_, index) => (
                <MinimumDot key={index} index={index} done={index < scored} />
              ))}
            </View>
            <AppText variant="label" tone={!started ? 'secondary' : missing === 0 ? 'success' : 'danger'}>
              {!started
                ? 'A temporada começa segunda. Até lá, os treinos contam para a Glória e para o Coliseu da semana.'
                : missing === 0
                  ? `Mínimo cumprido: +${LOUROS.met} Louros garantidos nesta semana.`
                  : `Faltam ${missing} ${missing === 1 ? 'treino' : 'treinos'} até domingo para não perder ${Math.abs(LOUROS.missed)} Louros.`}
            </AppText>
          </>
        )}

        <Button
          label="Ver tabela da temporada"
          variant="ghost"
          icon="arena"
          onPress={() => router.navigate({ pathname: '/arena', params: { legiao: legion.id, aba: 'temporada' } })}
        />
      </Card>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  place: {
    alignItems: 'flex-end',
  },
  dots: {
    flexDirection: 'row',
    gap: space.sm,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
