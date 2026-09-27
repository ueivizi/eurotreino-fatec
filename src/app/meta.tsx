import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { NumberField } from '@/components/ui/number-field';
import { AppText } from '@/components/ui/text';
import { FormScrollView } from '@/components/ui/form-scroll';
import { GOAL_MAX, fetchWeeklyGoal, setWeeklyGoal, type WeeklyGoal } from '@/features/goals/goal-api';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

const RING = 190;
const RADIUS = 76;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Iniciais dos dias, de segunda a domingo — a mesma ordem que o servidor devolve. */
const DAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const DAY_NAMES = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

function ringLabel(goal: WeeklyGoal): string {
  if (goal.target === null) return `${goal.daysDone} ${goal.daysDone === 1 ? 'dia' : 'dias'} nesta semana`;
  return `de ${goal.target} ${goal.target === 1 ? 'dia' : 'dias'}`;
}

/** A frase abaixo do anel: o que falta, ou a comemoração de quem já cumpriu. */
function ringMotto(goal: WeeklyGoal): string {
  if (goal.target === null) return 'Escolha uma meta e ela aparece aqui';
  if (goal.goalMet) {
    return goal.daysDone > goal.target ? 'Juramento cumprido, e com folga' : 'Juramento cumprido';
  }
  const missing = goal.target - goal.daysDone;
  return missing === 1 ? 'Falta um dia para cumprir o juramento' : `Faltam ${missing} dias para cumprir o juramento`;
}

function GoalRing({ goal }: { goal: WeeklyGoal }) {
  const { colors } = useTheme();
  const progress = goal.target === null ? 0 : Math.min(1, goal.daysDone / goal.target);

  return (
    <View style={styles.ring} accessibilityRole="progressbar" accessibilityLabel={`${goal.daysDone} ${ringLabel(goal)}`}>
      <Svg width={RING} height={RING}>
        <Defs>
          <LinearGradient id="juramento" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.goldDeep} />
            <Stop offset="0.6" stopColor={colors.gold} />
            <Stop offset="1" stopColor={colors.goldHighlight} />
          </LinearGradient>
        </Defs>
        <Circle cx={RING / 2} cy={RING / 2} r={RADIUS} fill="none" stroke={colors.track} strokeWidth={14} />
        {progress > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#juramento)"
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <AppText variant="stat">{String(goal.daysDone)}</AppText>
        <AppText variant="caption" tone="secondary">{ringLabel(goal)}</AppText>
      </View>
    </View>
  );
}

/** Os sete dias da semana corrente, marcados onde houve treino. */
function WeekDays({ goal }: { goal: WeeklyGoal }) {
  const { colors } = useTheme();
  return (
    <View style={styles.days}>
      {goal.daysTrained.map((trained, index) => (
        <View key={DAY_NAMES[index]} style={styles.day}>
          <View
            accessibilityLabel={`${DAY_NAMES[index]}: ${trained ? 'treinou' : 'sem treino'}`}
            style={[
              styles.dayBox,
              {
                borderColor: trained ? colors.gold : colors.hairlineSoft,
                backgroundColor: trained ? colors.selectedFill : 'transparent',
              },
            ]}>
            <Icon name={trained ? 'check' : 'mais'} size={16} color={trained ? colors.goldHighlight : colors.textMuted} strokeWidth={2} />
          </View>
          <AppText variant="caption" tone="muted">{DAY_INITIALS[index]}</AppText>
        </View>
      ))}
    </View>
  );
}

/** Juramento da semana (RF015 a RF017): meta pessoal, sequência de dias e Chama de Vesta. */
export default function WeeklyGoalScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const goal = useQuery({ queryKey: queryKeys.weeklyGoal, queryFn: fetchWeeklyGoal });

  // O que a pessoa está escolhendo agora; nulo enquanto ela não mexeu no seletor.
  const [chosen, setChosen] = useState<number | null>(null);
  const saved = goal.data?.target ?? 0;
  const target = chosen ?? saved;
  const changed = goal.data !== undefined && target !== saved;

  const swear = useMutation({
    mutationFn: () => setWeeklyGoal(target),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.weeklyGoal, updated);
      setChosen(null);
    },
  });

  return (
    <FormScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Juramento da semana" subtitle="Sua meta, no seu ritmo" />

      {goal.isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : goal.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(goal.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void goal.refetch()} />
        </View>
      ) : (
        <>
          <Reveal style={styles.ringBlock}>
            <GoalRing goal={goal.data} />
            <AppText variant="motto" tone="goldHighlight" style={styles.center}>{ringMotto(goal.data)}</AppText>
          </Reveal>

          <Reveal index={1}>
            <Card style={styles.block}>
              <View style={styles.cardHead}>
                <View style={styles.cardTitle}>
                  <Icon name="chama" size={18} color={colors.gold} />
                  <AppText variant="overline" tone="gold">Chama de Vesta</AppText>
                </View>
                <AppText variant="caption" tone="secondary">
                  {goal.data.weeksInARow === 0
                    ? 'Ainda apagada'
                    : `${goal.data.weeksInARow} ${goal.data.weeksInARow === 1 ? 'semana seguida' : 'semanas seguidas'}`}
                </AppText>
              </View>
              <WeekDays goal={goal.data} />
              <AppText variant="caption" tone="muted">
                {goal.data.streakDays === 0
                  ? 'A sequência começa no próximo treino.'
                  : `${goal.data.streakDays} ${goal.data.streakDays === 1 ? 'dia seguido' : 'dias seguidos'} treinando.`}
              </AppText>
            </Card>
          </Reveal>

          <Reveal index={2}>
            <Card style={styles.block}>
              <View style={styles.cardHead}>
                <View style={styles.cardLabel}>
                  <AppText variant="bodyMedium">Minha meta</AppText>
                  <AppText variant="caption" tone="muted">Escolhida por você, não pelo app</AppText>
                </View>
                <NumberField
                  label="Meta da semana"
                  value={target}
                  onChange={setChosen}
                  min={0}
                  max={GOAL_MAX}
                  step={1}
                  format={(value) => (value === 0 ? 'Nenhuma' : `${value} ${value === 1 ? 'dia' : 'dias'}`)}
                  disabled={swear.isPending}
                />
              </View>
              {changed ? (
                <Button
                  label={swear.isPending ? 'Jurando…' : target === 0 ? 'Ficar sem meta' : `Jurar ${target} ${target === 1 ? 'dia' : 'dias'}`}
                  icon="check"
                  onPress={() => swear.mutate()}
                  disabled={swear.isPending}
                />
              ) : null}
              {swear.isError ? <Notice tone="danger" message={errorMessage(swear.error)} /> : null}
            </Card>
          </Reveal>

          <View style={styles.note}>
            <Icon name="info" size={18} color={colors.gold} />
            <AppText variant="caption" tone="muted" style={styles.flex}>
              A meta é pessoal e não muda a Glória nem o Coliseu: ela existe para você ter o próprio
              placar, mesmo na semana em que ninguém mais treinou.
            </AppText>
          </View>
        </>
      )}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  ringBlock: {
    alignItems: 'center',
    gap: space.md,
  },
  ring: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    gap: space.xxs,
  },
  block: {
    gap: space.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  cardTitle: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  cardLabel: {
    flexShrink: 1,
    gap: space.xs,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
  },
  dayBox: {
    width: '100%',
    height: 38,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    gap: space.sm,
  },
  center: {
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  loading: {
    marginTop: space.xl,
  },
});
