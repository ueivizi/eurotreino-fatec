import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const MAX_LEGIONS = 10;

export default function LegionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });

  const list = legions.data ?? [];
  const atLimit = list.length >= MAX_LEGIONS;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl refreshing={legions.isRefetching} onRefresh={() => void legions.refetch()} tintColor={colors.gold} />
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
          <AppText variant="heading" style={styles.center}>Sua Arena começa aqui</AppText>
          <AppText tone="secondary" style={styles.center}>
            Funde uma Legião e convide seus amigos, ou entre com o código que alguém te mandou. Só quem está na
            Legião vê a Arena e os perfis.
          </AppText>
        </View>
      ) : (
        <View style={styles.list} accessibilityRole="list">
          {list.map((legion) => (
            <Pressable
              key={legion.id}
              accessibilityRole="button"
              accessibilityLabel={`${legion.name}, ${legion.memberCount} de 50 membros${legion.role === 'owner' ? ', você é o fundador' : ''}`}
              onPress={() => router.push({ pathname: '/legioes/[id]', params: { id: legion.id } })}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.hairlineSoft },
                pressed && styles.pressed,
              ]}>
              <EmblemAvatar emblem={legion.emblem} size={48} />
              <View style={styles.cardText}>
                <AppText variant="subheading" numberOfLines={1}>{legion.name}</AppText>
                <AppText variant="caption" tone="muted">
                  {`${legion.role === 'owner' ? 'Fundador · ' : ''}${legion.memberCount} de 50 membros`}
                </AppText>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      {legions.isSuccess ? (
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
      ) : null}
    </ScrollView>
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
  list: {
    gap: space.md,
  },
  card: {
    minHeight: touchTarget + 24,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cardText: {
    flex: 1,
    gap: space.xxs,
  },
  pressed: {
    opacity: 0.85,
  },
});
