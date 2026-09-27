import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { TabFade } from '@/components/motion/tab-fade';
import { LegionHero } from '@/components/legion/legion-hero';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { LegionPanel, refetchLegionPanel } from '@/features/legions/legion-panel';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { SeasonSummary } from '@/features/legions/season-summary';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const MAX_LEGIONS = 10;

export default function LegionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = legions.data ?? [];
  const atLimit = list.length >= MAX_LEGIONS;
  // A aba mostra a Legião direto (quadro 2.4): convidar é o que faz o Coliseu existir.
  const legion = list.find((item) => item.id === selectedId) ?? list[0] ?? null;

  const moreLegions = (
        <View style={styles.block}>
          <Button
            label={list.length === 0 ? 'Fundar Legião' : 'Fundar outra Legião'}
            icon="mais"
            onPress={() => router.push('/legioes/nova')}
            disabled={atLimit}
            variant={list.length === 0 ? 'primary' : 'secondary'}
          />
          <Button label="Entrar com código" variant="secondary" onPress={() => router.push('/legioes/entrar')} disabled={atLimit} />
          {atLimit ? (
            <AppText variant="caption" tone="muted" style={styles.center}>
              Você está no limite de 10 Legiões. Saia de uma para fundar ou entrar em outra.
            </AppText>
          ) : null}
        </View>
  );

  return (
    <TabFade>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={legions.isRefetching}
          onRefresh={() => {
            void legions.refetch();
            if (legion) void refetchLegionPanel(queryClient, legion.id);
          }}
          tintColor={colors.gold}
        />
      }>
      <AppText variant="title">Legião</AppText>

      {legions.isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : legions.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(legions.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void legions.refetch()} />
        </View>
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.circle, { borderColor: colors.hairline }]}>
            <Icon name="legiao" size={40} color={colors.gold} />
          </View>
          <AppText variant="heading" style={styles.center}>Seu Coliseu começa aqui</AppText>
          <AppText tone="secondary" style={styles.center}>
            Funde uma Legião e convide seus amigos, ou entre com o código que alguém te mandou. Só quem está na
            Legião vê o Coliseu e os perfis.
          </AppText>
          {moreLegions}
        </View>
      ) : legion ? (
        <>
          {list.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {list.map((item) => {
                const selected = item.id === legion.id;
                return (
                  <PressableScale
                    key={item.id}
                    haptic="select"
                    accessibilityRole="button"
                    accessibilityLabel={`Ver a ${item.name}`}
                    accessibilityState={{ selected }}
                    onPress={() => setSelectedId(item.id)}
                    style={[
                      styles.chip,
                      { borderColor: selected ? colors.gold : colors.hairlineSoft, backgroundColor: selected ? colors.selectedFill : 'transparent' },
                    ]}>
                    <AppText variant="label" tone={selected ? 'goldHighlight' : 'secondary'} numberOfLines={1}>{item.name}</AppText>
                  </PressableScale>
                );
              })}
            </ScrollView>
          ) : null}

          <LegionHero key={`topo-${legion.id}`} legion={legion} />
          <SeasonSummary legion={legion} />

          <LegionPanel key={legion.id} legion={legion}>
            {moreLegions}
          </LegionPanel>
        </>
      ) : null}

    </ScrollView>
    </TabFade>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl * 3,
    gap: space.xl,
  },
  loading: {
    marginTop: space.xxxl,
  },
  block: {
    alignSelf: 'stretch',
    gap: space.md,
  },
  empty: {
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
    maxWidth: 340,
  },
  chips: {
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderRadius: radius.full,
  },
});
