import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchExerciseCatalog } from '@/features/training/exercises-api';
import { ROUTINE_LIMITS, fetchMyRoutines, type Routine } from '@/features/training/routines-api';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/** Fichas de treino: a lista do que você montou, pronta para começar uma sessão. */
export default function RoutinesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const routines = useQuery({ queryKey: queryKeys.routines, queryFn: fetchMyRoutines });
  const catalog = useQuery({ queryKey: queryKeys.exercises, queryFn: fetchExerciseCatalog, staleTime: 10 * 60_000 });

  function nameOf(exerciseId: string): string {
    return catalog.data?.exercises.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
  }

  const atLimit = (routines.data?.length ?? 0) >= ROUTINE_LIMITS.maxRoutines;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}
      refreshControl={
        <RefreshControl refreshing={routines.isRefetching} onRefresh={() => void routines.refetch()} tintColor={colors.gold} />
      }>
      <ScreenHeader title="Fichas" subtitle="Seus treinos montados, prontos para começar" />

      {routines.isPending ? (
        <ActivityIndicator color={colors.gold} />
      ) : routines.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(routines.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void routines.refetch()} />
        </View>
      ) : routines.data.length === 0 ? (
        <Notice message="Você ainda não tem ficha. Monte uma com seus exercícios, séries e cargas — depois é só começar o treino por ela." />
      ) : (
        routines.data.map((routine, index) => (
          <RoutineCard key={routine.id} routine={routine} index={index} nameOf={nameOf} onOpen={() => router.push({ pathname: '/fichas/[id]', params: { id: routine.id } })} onStart={() => router.push({ pathname: '/sessao', params: { ficha: routine.id } })} />
        ))
      )}

      <Button
        label="Nova ficha"
        icon="mais"
        onPress={() => router.push({ pathname: '/fichas/[id]', params: { id: 'nova' } })}
        disabled={atLimit}
      />
      {atLimit ? <Notice message={`Você chegou ao limite de ${ROUTINE_LIMITS.maxRoutines} fichas. Apague uma para criar outra.`} /> : null}
    </ScrollView>
  );
}

function RoutineCard({
  routine,
  index,
  nameOf,
  onOpen,
  onStart,
}: {
  routine: Routine;
  index: number;
  nameOf: (exerciseId: string) => string;
  onOpen: () => void;
  onStart: () => void;
}) {
  const { colors } = useTheme();
  const preview = routine.items.slice(0, 3).map((item) => nameOf(item.exerciseId));
  const rest = routine.items.length - preview.length;

  return (
    <Reveal index={index}>
      <Card style={styles.card}>
        <PressableScale accessibilityRole="button" accessibilityLabel={`Editar ${routine.name}`} onPress={onOpen} style={styles.cardHeader}>
          <View style={styles.cardText}>
            <AppText variant="subheading" numberOfLines={1}>{routine.name}</AppText>
            <AppText variant="caption" tone="muted">
              {`${routine.items.length} ${routine.items.length === 1 ? 'exercício' : 'exercícios'}`}
            </AppText>
          </View>
          <Icon name="editar" size={20} color={colors.gold} />
        </PressableScale>
        <AppText variant="label" tone="secondary" numberOfLines={2}>
          {preview.join(' · ')}
          {rest > 0 ? ` · +${rest}` : ''}
        </AppText>
        <Button label="Começar treino" icon="registrar" variant="secondary" onPress={onStart} />
      </Card>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  block: {
    gap: space.md,
  },
  card: {
    gap: space.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
});
