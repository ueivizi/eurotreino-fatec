import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { LegionPanel, refetchLegionPanel } from '@/features/legions/legion-panel';
import { fetchMyLegions } from '@/features/legions/legions-api';
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
  const params = useLocalSearchParams<{ id: string }>();
  const legionId = isUuid(params.id) ? params.id : null;

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
  },
  errorBlock: {
    alignSelf: 'stretch',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
});
