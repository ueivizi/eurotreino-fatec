import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar, type Laurel } from '@/components/rank/emblem-avatar';
import { RankMedallion } from '@/components/rank/rank-medallion';
import { ScreenHeader } from '@/components/screen-header';
import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { TrophyShelf } from '@/features/legions/trophy-shelf';
import { rankFromGlory } from '@/features/ranks/tiers';
import { isUuid } from '@/lib/parse';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const LAURELS: Record<number, Laurel> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

/**
 * Perfil de membro (visão restrita, RF009): só o que o Coliseu já mostra à Legião — nome, emblema,
 * rank, Glória da semana e posição. Os treinos de cada pessoa continuam privados.
 */
export default function MemberProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; legiao?: string }>();
  const memberId = isUuid(params.id) ? params.id : null;
  const legionId = isUuid(params.legiao) ? params.legiao : null;

  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const legion = legions.data?.find((item) => item.id === legionId) ?? null;
  const ranking = useQuery({
    queryKey: queryKeys.ranking(legionId ?? '', 0),
    queryFn: () => fetchWeeklyRanking(legionId as string, 0),
    enabled: legion !== null,
  });
  const member = ranking.data?.entries.find((entry) => entry.userId === memberId) ?? null;

  const notFound = !memberId || !legionId || (legions.isSuccess && !legion) || (ranking.isSuccess && !member);
  if (notFound) {
    return (
      <StatusScreen
        icon="legiao"
        title="Membro não encontrado"
        description="A pessoa pode ter saído da Legião, ou você não faz mais parte dela."
        actions={[{ label: 'Voltar para o Coliseu', onPress: () => router.replace('/arena') }]}
      />
    );
  }

  const failed = legions.isError ? legions.error : ranking.isError ? ranking.error : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title={member?.displayName ?? 'Membro'} subtitle={legion ? `Coliseu · ${legion.name}` : undefined} fallbackHref="/arena" />

      {failed ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(failed)} />
          <Button
            label="Tentar de novo"
            variant="secondary"
            onPress={() => {
              void legions.refetch();
              void ranking.refetch();
            }}
          />
        </View>
      ) : !member || !legion ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : (
        <>
          <View style={styles.identity}>
            <EmblemAvatar
              emblem={member.emblem}
              color={member.emblemColor}
              size={120}
              laurel={member.weekGlory > 0 ? LAURELS[member.place] : undefined}
            />
            <AppText variant="title" style={styles.center}>{member.isMe ? `${member.displayName} · você` : member.displayName}</AppText>
            <AppText tone="secondary" style={styles.center}>
              {`${member.role === 'owner' ? 'Fundador' : 'Membro'} da ${legion.name}`}
            </AppText>
          </View>

          <Card style={styles.rankCard}>
            <RankMedallion tier={rankFromGlory(member.totalGlory).tierId} size={64} accessibilityLabel={rankFromGlory(member.totalGlory).label} />
            <View style={styles.flex}>
              <AppText variant="caption" tone="muted">Rank</AppText>
              <AppText variant="subheading">{rankFromGlory(member.totalGlory).label}</AppText>
            </View>
          </Card>

          <View style={styles.stats}>
            <Card style={styles.stat}>
              <AppText variant="caption" tone="muted">Glória da semana</AppText>
              <AppText variant="stat" tone="goldHighlight">{String(member.weekGlory)}</AppText>
            </Card>
            <Card style={styles.stat}>
              <AppText variant="caption" tone="muted">Posição no Coliseu</AppText>
              <AppText variant="stat">{`${member.place}º`}</AppText>
            </Card>
          </View>

          <TrophyShelf userId={member.isMe ? undefined : member.userId} />

          <View style={styles.privacy}>
            <Icon name="escudo" size={16} color={colors.gold} />
            <AppText variant="label" tone="secondary" style={styles.flex}>
              {member.isMe
                ? 'É assim que os membros da Legião veem você. Seus treinos continuam privados.'
                : `Os treinos de ${member.displayName} são privados. Na Legião aparecem só o rank, a Glória da semana, a posição no Coliseu e os Triunfos.`}
            </AppText>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  block: {
    gap: space.md,
  },
  loading: {
    marginVertical: space.xxxl,
  },
  identity: {
    alignItems: 'center',
    gap: space.xs,
  },
  center: {
    textAlign: 'center',
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  stats: {
    flexDirection: 'row',
    gap: space.md,
  },
  stat: {
    flex: 1,
    gap: space.xs,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
});
