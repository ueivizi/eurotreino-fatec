import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemPicker } from '@/components/emblem-picker';
import { LegionBanner } from '@/components/legion/legion-banner';
import { BannerColorPicker, MinimumPicker, ModePicker } from '@/components/legion/legion-choices';
import { ScreenHeader } from '@/components/screen-header';
import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchMyLegions, updateLegion } from '@/features/legions/legions-api';
import type { LegionMode, LegionSummary } from '@/features/legions/legions-parsers';
import type { EmblemColor, EmblemName } from '@/features/profile/emblems';
import { isUuid } from '@/lib/parse';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

function Editor({ legion }: { legion: LegionSummary }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [emblem, setEmblem] = useState<EmblemName>(legion.emblem);
  const [bannerColor, setBannerColor] = useState<EmblemColor>(legion.bannerColor);
  const [mode, setMode] = useState<LegionMode>(legion.mode);
  const [minimum, setMinimum] = useState(legion.weeklyMinimum ?? 3);

  const wasCompetitive = legion.mode === 'competitiva';
  const save = useMutation({
    mutationFn: () => updateLegion(legion.id, { emblem, bannerColor, mode, weeklyMinimum: mode === 'competitiva' ? minimum : null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.legions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
      router.back();
    },
  });

  function change(apply: () => void) {
    apply();
    save.reset();
  }

  return (
    <>
      <View style={styles.preview}>
        <LegionBanner emblem={emblem} color={bannerColor} width={104} />
        <AppText variant="heading" style={styles.center}>{legion.name}</AppText>
      </View>

      <EmblemPicker label="Emblema do estandarte" value={emblem} onChange={(value) => change(() => setEmblem(value))} />
      <BannerColorPicker value={bannerColor} onChange={(value) => change(() => setBannerColor(value))} />

      <View style={styles.group}>
        <AppText variant="label" tone="secondary">Modo da Legião</AppText>
        <ModePicker value={mode} onChange={(value) => change(() => setMode(value))} />
      </View>

      {mode === 'competitiva' ? (
        <MinimumPicker value={minimum} onChange={(value) => change(() => setMinimum(value))} disabled={wasCompetitive} />
      ) : null}

      {wasCompetitive && mode === 'competitiva' ? (
        <Notice message="O mínimo fica o mesmo durante a competitiva: mudar no meio reescreveria semanas já disputadas." />
      ) : null}
      {!wasCompetitive && mode === 'competitiva' ? (
        <Notice message="A primeira temporada começa na próxima segunda, para todo mundo largar junto. Avise a Legião antes." />
      ) : null}
      {wasCompetitive && mode === 'classica' ? (
        <Notice tone="danger" message="Voltar para clássica encerra a temporada em andamento sem Triunfos. Os Triunfos já ganhos continuam nos perfis." />
      ) : null}

      <Button label={save.isPending ? 'Salvando…' : 'Salvar estandarte e modo'} onPress={() => save.mutate()} disabled={save.isPending} />
      {save.isError ? <Notice tone="danger" message={errorMessage(save.error)} /> : null}
    </>
  );
}

/** Só o fundador: troca o estandarte e o modo da Legião. */
export default function LegionSettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const legionId = isUuid(params.id) ? params.id : null;
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const legion = legions.data?.find((item) => item.id === legionId) ?? null;

  if (!legionId || (legions.isSuccess && (!legion || legion.role !== 'owner'))) {
    return (
      <StatusScreen
        icon="legiao"
        title="Só o fundador muda o estandarte"
        description="Esta Legião não é sua, ou você saiu dela."
        actions={[{ label: 'Voltar', onPress: () => (router.canGoBack() ? router.back() : router.replace('/legiao')) }]}
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Estandarte e modo" subtitle="Só o fundador vê esta tela" fallbackHref="/legiao" />
      {legion ? <Editor legion={legion} /> : <ActivityIndicator color={colors.gold} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  preview: {
    alignItems: 'center',
    gap: space.xs,
  },
  center: {
    textAlign: 'center',
  },
  group: {
    gap: space.sm,
  },
});
