import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegionBanner } from '@/components/legion/legion-banner';
import { LegionHero } from '@/components/legion/legion-hero';
import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { LegionPanel, refetchLegionPanel } from '@/features/legions/legion-panel';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { SeasonSummary } from '@/features/legions/season-summary';
import { isUuid } from '@/lib/parse';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/** Uma Legião aberta a partir do Perfil ou de um link; a aba Legião mostra o mesmo painel. */
export default function LegionDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string; nova?: string }>();
  const legionId = isUuid(params.id) ? params.id : null;
  // Logo depois de fundar: "Convoque sua Legião" (quadro 2.2), com o estandarte descendo.
  const justFounded = params.nova === '1';

  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const legion = legions.data?.find((item) => item.id === legionId) ?? null;

  if (!legionId || (legions.isSuccess && !legion)) {
    return (
      <StatusScreen
        icon="legiao"
        title="Legião não encontrada"
        description="Talvez você tenha saído dela, ou o link esteja incompleto."
        actions={[{ label: 'Ver minhas Legiões', onPress: () => router.replace('/legiao') }]}
      />
    );
  }

  if (!legion) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: colors.background }]}>
        {legions.isError ? (
          <View style={styles.errorBlock}>
            <Notice tone="danger" message={errorMessage(legions.error)} />
            <Button label="Tentar de novo" variant="secondary" onPress={() => void legions.refetch()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.gold} />
        )}
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}
      refreshControl={
        <RefreshControl
          refreshing={legions.isRefetching}
          onRefresh={() => {
            void legions.refetch();
            void refetchLegionPanel(queryClient, legion.id);
          }}
          tintColor={colors.gold}
        />
      }>
      <ScreenHeader
        title={legion.name}
        subtitle={`${legion.role === 'owner' ? 'Você é o fundador · ' : ''}${legion.memberCount} de 50 membros`}
      />
      {justFounded ? (
        <Reveal style={styles.founded}>
          <LegionBanner emblem={legion.emblem} color={legion.bannerColor} width={120} delay={200} />
          <AppText variant="title" style={styles.center}>Convoque sua Legião</AppText>
          <AppText tone="secondary" style={styles.center}>
            {legion.mode === 'competitiva'
              ? 'Mande o código: quem entrar até domingo larga junto na primeira temporada.'
              : 'Quem entrar com o código já disputa o Coliseu desta semana.'}
          </AppText>
        </Reveal>
      ) : (
        <LegionHero legion={legion} showName={false} />
      )}
      <SeasonSummary legion={legion} />
      <LegionPanel legion={legion} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  founded: {
    alignItems: 'center',
    gap: space.sm,
  },
  errorBlock: {
    alignSelf: 'stretch',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
});
