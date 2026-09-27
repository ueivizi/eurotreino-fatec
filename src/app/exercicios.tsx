import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ScreenHeader } from '@/components/screen-header';
import { Button, tapFeedback } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { FormScrollView } from '@/components/ui/form-scroll';
import { pickExercise } from '@/features/training/exercise-picker';
import { createExercise, fetchExerciseCatalog, searchExercises, type Exercise } from '@/features/training/exercises-api';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

/**
 * Catálogo de exercícios: busca, filtro por grupo muscular e criação do que faltar. A lista vem do
 * servidor — o catálogo do app mais os exercícios da própria pessoa, que ninguém mais enxerga.
 */
export default function ExerciseCatalogScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const catalog = useQuery({ queryKey: queryKeys.exercises, queryFn: fetchExerciseCatalog, staleTime: 10 * 60_000 });
  const [term, setTerm] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEquipment, setNewEquipment] = useState('halteres');

  const list = useMemo(() => {
    const exercises = catalog.data?.exercises ?? [];
    const filtered = group ? exercises.filter((exercise) => exercise.muscleGroup === group) : exercises;
    return searchExercises(filtered, term);
  }, [catalog.data, group, term]);

  const create = useMutation({
    mutationFn: () => createExercise(newName, group ?? 'corpo-inteiro', newEquipment),
    onSuccess: (exercise) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.exercises });
      choose(exercise.id);
    },
  });

  function choose(exerciseId: string) {
    pickExercise(exerciseId);
    if (router.canGoBack()) router.back();
  }

  const groups = catalog.data?.muscleGroups ?? [];
  const equipmentLabel = (id: string) => catalog.data?.equipment.find((item) => item.id === id)?.label ?? id;

  return (
    <FormScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Exercícios" subtitle="Escolha um do catálogo ou crie o seu" />

      <TextField
        label="Buscar"
        value={term}
        onChangeText={setTerm}
        placeholder="supino, agachamento, rosca…"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {[{ id: null, label: 'Todos' }, ...groups.map((item) => ({ id: item.id as string | null, label: item.label }))].map(
          (option) => {
            const selected = option.id === group;
            return (
      <PressableScale
                key={option.id ?? 'todos'}
                haptic="select"
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => setGroup(option.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.gold : colors.hairlineSoft,
                    backgroundColor: selected ? colors.selectedFill : 'transparent',
                  },
                ]}>
                <AppText variant="label" tone={selected ? 'goldHighlight' : 'secondary'}>{option.label}</AppText>
      </PressableScale>
            );
          },
        )}
      </ScrollView>

      {catalog.isPending ? (
        <ActivityIndicator color={colors.gold} />
      ) : catalog.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(catalog.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void catalog.refetch()} />
        </View>
      ) : (
        <View>
          {list.map((exercise) => (
            <ExerciseRow key={exercise.id} exercise={exercise} equipmentLabel={equipmentLabel(exercise.equipment)} onPress={() => choose(exercise.id)} />
          ))}
          {list.length === 0 ? (
            <Notice message="Nenhum exercício com esse nome. Crie o seu logo abaixo." />
          ) : null}
        </View>
      )}

      {creating ? (
        <View style={styles.block}>
          <AppText variant="overline" tone="muted">Novo exercício</AppText>
          <TextField
            label="Nome"
            value={newName}
            onChangeText={setNewName}
            placeholder="Ex.: Remada na máquina do meu ginásio"
            maxLength={60}
            autoFocus
          />
          <AppText variant="label" tone="secondary">Equipamento</AppText>
          <View style={styles.chips}>
            {(catalog.data?.equipment ?? []).map((item) => {
      const selected = item.id === newEquipment;
      return (
                <Pressable
                  key={item.id}
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    tapFeedback();
                    setNewEquipment(item.id);
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: selected ? colors.gold : colors.hairlineSoft,
                      backgroundColor: selected ? colors.selectedFill : 'transparent',
                    },
                  ]}>
                  <AppText variant="label" tone={selected ? 'goldHighlight' : 'secondary'}>{item.label}</AppText>
                </Pressable>
      );
            })}
          </View>
          <AppText variant="caption" tone="muted">
            {group
      ? `Vai entrar em ${groups.find((item) => item.id === group)?.label ?? group}.`
      : 'Escolha um grupo muscular acima antes de criar; sem escolha, entra em Corpo inteiro.'}
          </AppText>
          <Button
            label={create.isPending ? 'Criando…' : 'Criar e escolher'}
            onPress={() => create.mutate()}
            disabled={create.isPending || newName.trim().length < 2}
          />
          {create.isError ? <Notice tone="danger" message={errorMessage(create.error)} /> : null}
          <Button label="Cancelar" variant="ghost" onPress={() => setCreating(false)} disabled={create.isPending} />
        </View>
      ) : (
        <Button label="Criar exercício" icon="mais" variant="secondary" onPress={() => setCreating(true)} />
      )}
    </FormScrollView>
  );
}

function ExerciseRow({ exercise, equipmentLabel, onPress }: { exercise: Exercise; equipmentLabel: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${equipmentLabel}${exercise.isCustom ? ', exercício seu' : ''}`}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.hairlineSoft }]}>
      <View style={styles.rowText}>
        <AppText variant="bodyMedium" numberOfLines={1}>{exercise.name}</AppText>
        <AppText variant="caption" tone="muted">
          {exercise.isCustom ? `${equipmentLabel} · seu exercício` : equipmentLabel}
        </AppText>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textMuted} />
    </PressableScale>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget - 12,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  row: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});
