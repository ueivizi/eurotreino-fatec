import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button, tapFeedback } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { FormScrollView } from '@/components/ui/form-scroll';
import { requestExercise, takePickedExercise } from '@/features/training/exercise-picker';
import { fetchExerciseCatalog } from '@/features/training/exercises-api';
import { ROUTINE_LIMITS, deleteRoutine, fetchMyRoutines, saveRoutine, type RoutineItem } from '@/features/training/routines-api';
import { formatLoad } from '@/features/workouts/metrics';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

function StepButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={[styles.stepButton, { borderColor: colors.hairline, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={16} color={colors.gold} strokeWidth={1.8} />
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  format,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  format: (value: number) => string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next / step) * step));
  return (
    <View style={styles.stepperRow}>
      <AppText variant="caption" tone="muted" style={styles.stepperLabel}>{label}</AppText>
      <View style={styles.stepper}>
        <StepButton icon="menos" label={`Diminuir ${label.toLowerCase()}`} disabled={value <= min} onPress={() => onChange(clamp(value - step))} />
        <AppText variant="bodyMedium" style={styles.stepperValue}>{format(value)}</AppText>
        <StepButton icon="mais" label={`Aumentar ${label.toLowerCase()}`} disabled={value >= max} onPress={() => onChange(clamp(value + step))} />
      </View>
    </View>
  );
}

/** Editor de ficha: nome e lista de exercícios com séries, repetições e carga previstas. */
export default function RoutineEditorScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id?: string }>();
  const isNew = params.id === 'nova';
  const routineId = isNew ? null : (params.id ?? null);

  const routines = useQuery({ queryKey: queryKeys.routines, queryFn: fetchMyRoutines });
  const catalog = useQuery({ queryKey: queryKeys.exercises, queryFn: fetchExerciseCatalog, staleTime: 10 * 60_000 });
  const existing = routineId ? routines.data?.find((item) => item.id === routineId) ?? null : null;

  const [name, setName] = useState<string | null>(null);
  const [items, setItems] = useState<RoutineItem[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Enquanto a ficha não chega do servidor, o formulário espelha o que já existe.
  const currentName = name ?? existing?.name ?? '';
  const currentItems = items ?? existing?.items ?? [];

  // Ao voltar do catálogo, o exercício escolhido entra no fim da lista.
  useFocusEffect(
    useCallback(() => {
      const picked = takePickedExercise();
      if (!picked) return;
      setItems((current) => {
        const base = current ?? existing?.items ?? [];
        if (base.some((item) => item.exerciseId === picked) || base.length >= ROUTINE_LIMITS.maxItems) return base;
        return [...base, { exerciseId: picked, targetSets: 3, targetReps: 10, targetLoadKg: null, restSeconds: 60 }];
      });
    }, [existing]),
  );

  const save = useMutation({
    mutationFn: () => saveRoutine(routineId, currentName.trim(), currentItems),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.routines });
      if (router.canGoBack()) router.back();
      else router.replace('/fichas');
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteRoutine(routineId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.routines });
      router.replace('/fichas');
    },
  });

  function update(index: number, change: Partial<RoutineItem>) {
    setItems(currentItems.map((item, position) => (position === index ? { ...item, ...change } : item)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= currentItems.length) return;
    const next = [...currentItems];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItems(next);
  }

  function nameOf(exerciseId: string): string {
    return catalog.data?.exercises.find((exercise) => exercise.id === exerciseId)?.name ?? exerciseId;
  }

  if (!isNew && routines.isSuccess && !existing) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: colors.background }]}>
        <Notice message="Esta ficha não existe mais." />
        <Button label="Voltar para as fichas" onPress={() => router.replace('/fichas')} />
      </View>
    );
  }

  const canSave = currentName.trim().length >= 2 && currentItems.length >= 1 && !save.isPending;

  return (
    <FormScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title={isNew ? 'Nova ficha' : 'Editar ficha'} subtitle="Exercícios, séries e carga previstos" />

      {routines.isPending && !isNew ? <ActivityIndicator color={colors.gold} /> : null}

      <TextField
        label="Nome da ficha"
        value={currentName}
        onChangeText={setName}
        placeholder="Ex.: Treino A · Peito e tríceps"
        maxLength={40}
      />

      {currentItems.map((item, index) => (
        <Card key={item.exerciseId} style={styles.item}>
          <View style={styles.itemHeader}>
            <AppText variant="bodyMedium" style={styles.flex} numberOfLines={2}>{`${index + 1}. ${nameOf(item.exerciseId)}`}</AppText>
            <StepButton icon="chevronDown" label="Descer na ordem" disabled={index === currentItems.length - 1} onPress={() => move(index, 1)} />
            <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remover ${nameOf(item.exerciseId)}`}
      onPress={() => {
                tapFeedback();
                setItems(currentItems.filter((_, position) => position !== index));
      }}
      style={styles.remove}>
      <Icon name="fechar" size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          <Stepper
            label="Séries"
            value={item.targetSets}
            format={(value) => String(value)}
            min={ROUTINE_LIMITS.sets.min}
            max={ROUTINE_LIMITS.sets.max}
            step={1}
            onChange={(value) => update(index, { targetSets: value })}
          />
          <Stepper
            label="Repetições"
            value={item.targetReps}
            format={(value) => String(value)}
            min={ROUTINE_LIMITS.reps.min}
            max={ROUTINE_LIMITS.reps.max}
            step={1}
            onChange={(value) => update(index, { targetReps: value })}
          />
          <Stepper
            label="Carga"
            value={item.targetLoadKg ?? 0}
            format={(value) => (value > 0 ? formatLoad(value) : 'Livre')}
            min={0}
            max={ROUTINE_LIMITS.load.max}
            step={ROUTINE_LIMITS.load.step}
            onChange={(value) => update(index, { targetLoadKg: value > 0 ? value : null })}
          />
          <Stepper
            label="Descanso"
            value={item.restSeconds ?? 0}
            format={(value) => (value > 0 ? `${value} s` : 'Sem marcar')}
            min={0}
            max={ROUTINE_LIMITS.rest.max}
            step={ROUTINE_LIMITS.rest.step}
            onChange={(value) => update(index, { restSeconds: value >= ROUTINE_LIMITS.rest.min ? value : null })}
          />
        </Card>
      ))}

      <Button
        label="Adicionar exercício"
        icon="mais"
        variant="secondary"
        onPress={() => {
          requestExercise({ kind: 'routine', routineId });
          router.push('/exercicios');
        }}
        disabled={currentItems.length >= ROUTINE_LIMITS.maxItems}
      />
      {currentItems.length >= ROUTINE_LIMITS.maxItems ? (
        <Notice message={`Uma ficha leva até ${ROUTINE_LIMITS.maxItems} exercícios.`} />
      ) : null}

      <Button label={save.isPending ? 'Salvando…' : 'Salvar ficha'} icon="check" onPress={() => save.mutate()} disabled={!canSave} />
      {save.isError ? <Notice tone="danger" message={errorMessage(save.error)} /> : null}

      {!isNew ? (
        confirmDelete ? (
          <View style={styles.block}>
            <Notice message="A ficha será apagada. Os treinos que você já registrou por ela continuam no histórico." />
            <Button label={remove.isPending ? 'Apagando…' : 'Apagar ficha'} variant="secondary" icon="excluir" onPress={() => remove.mutate()} disabled={remove.isPending} />
            <Button label="Cancelar" variant="ghost" onPress={() => setConfirmDelete(false)} disabled={remove.isPending} />
            {remove.isError ? <Notice tone="danger" message={errorMessage(remove.error)} /> : null}
          </View>
        ) : (
          <Button label="Apagar ficha" variant="ghost" icon="excluir" onPress={() => setConfirmDelete(true)} />
        )
      ) : null}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  block: {
    gap: space.sm,
  },
  item: {
    gap: space.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xs,
  },
  flex: {
    flex: 1,
  },
  remove: {
    width: touchTarget - 8,
    height: touchTarget - 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  stepperLabel: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  stepperValue: {
    minWidth: 92,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stepButton: {
    width: touchTarget - 8,
    height: touchTarget - 8,
    borderWidth: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
