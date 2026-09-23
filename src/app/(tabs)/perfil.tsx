import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabFade } from '@/components/motion/tab-fade';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { RankMedallion } from '@/components/rank/rank-medallion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LinkRow } from '@/components/ui/link-row';
import { Notice } from '@/components/ui/notice';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { rankFromGlory } from '@/features/ranks/tiers';
import { fetchMyProgress } from '@/features/workouts/workouts-api';
import { profileShareMessage } from '@/features/workouts/share-workout';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { SHARE_FEEDBACK, shareText } from '@/lib/share';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

function workoutCount(total: number): string {
  if (total === 0) return 'Nenhum treino registrado ainda';
  return `${total} ${total === 1 ? 'treino registrado' : 'treinos registrados'}`;
}

/** Meu perfil: rank, Legiões, privacidade e conta (sair e excluir). */
export default function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state } = useSession();
  const [shareNote, setShareNote] = useState<string | null>(null);

  async function share(message: string) {
    setShareNote(SHARE_FEEDBACK[await shareText(message)]);
  }

  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });

  if (state.status !== 'ready') return null;
  const { profile, email } = state;
  const rank = progress.data ? rankFromGlory(progress.data.totalGlory) : null;

  return (
    <TabFade>
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl
          refreshing={progress.isRefetching || legions.isRefetching}
          onRefresh={() => {
            void progress.refetch();
            void legions.refetch();
          }}
          tintColor={colors.gold}
        />
      }>
      <AppText variant="title">Perfil</AppText>

      <View style={styles.identity}>
        <EmblemAvatar emblem={profile.emblem} color={profile.emblemColor} size={64} />
        <View style={styles.identityText}>
          <AppText variant="heading" numberOfLines={1}>{profile.displayName}</AppText>
          <AppText variant="label" tone="secondary">
            {progress.data ? workoutCount(progress.data.totalWorkouts) : ' '}
          </AppText>
          {email ? <AppText variant="caption" tone="muted" numberOfLines={1}>{email}</AppText> : null}
        </View>
      </View>
      <Button label="Editar nome e emblema" icon="editar" variant="secondary" onPress={() => router.push('/editar-perfil')} />
      {progress.data ? (
        <Button
          label="Compartilhar meu progresso"
          icon="compartilhar"
          variant="ghost"
          onPress={() => void share(profileShareMessage(profile.displayName, progress.data.totalGlory, progress.data.totalWorkouts))}
        />
      ) : null}
      {shareNote ? <Notice message={shareNote} /> : null}

      <Card style={styles.rankCard}>
        {progress.isError ? (
          <View style={styles.block}>
            <Notice tone="danger" message={errorMessage(progress.error)} />
            <Button label="Tentar de novo" variant="secondary" onPress={() => void progress.refetch()} />
          </View>
        ) : !rank ? (
          <ActivityIndicator color={colors.gold} />
        ) : (
          <>
            <View style={styles.rankRow}>
              <RankMedallion tier={rank.tierId} size={88} accessibilityLabel={`Seu rank: ${rank.label}`} />
              <View style={styles.rankText}>
                <AppText variant="subheading">{rank.label}</AppText>
                <AppText variant="stat" tone="goldHighlight">{String(rank.glory)}</AppText>
                <AppText variant="caption" tone="muted">de Glória acumulada</AppText>
              </View>
            </View>
            <ProgressBar
              value={rank.progress}
              accessibilityLabel={rank.next ? `Progresso até ${rank.next.label}` : 'Rank máximo alcançado'}
            />
            <AppText variant="caption" tone="secondary" style={styles.tabular}>
              {rank.next ? `Faltam ${rank.next.remaining} para ${rank.next.label}` : 'Você chegou ao Olimpo'}
            </AppText>
          </>
        )}
        <View style={styles.rankLinks}>
          <Button label="Anais: meus treinos" icon="pergaminho" variant="ghost" onPress={() => router.push('/anais')} />
          <Button label="Ver todos os ranks" variant="ghost" onPress={() => router.push('/ranks')} />
          <Button label="Meus recordes" variant="ghost" onPress={() => router.push('/recordes')} />
          <Button label="Minha Honra" variant="ghost" onPress={() => router.push('/honra')} />
          <Button label="Como conquistar Glória" variant="ghost" onPress={() => router.push('/gloria')} />
        </View>
      </Card>

      <View style={styles.section}>
        <AppText variant="overline" tone="muted">Legiões</AppText>
        {legions.isPending ? (
          <ActivityIndicator color={colors.gold} />
        ) : legions.isError ? (
          <Notice tone="danger" message={errorMessage(legions.error)} />
        ) : legions.data.length === 0 ? (
          <AppText tone="secondary">Você ainda não está em nenhuma Legião.</AppText>
        ) : (
          legions.data.map((legion) => (
            <LinkRow
              key={legion.id}
              label={legion.name}
              description={`${legion.role === 'owner' ? 'Fundador · ' : ''}${legion.memberCount} ${legion.memberCount === 1 ? 'membro' : 'membros'}`}
              onPress={() => router.push({ pathname: '/legioes/[id]', params: { id: legion.id } })}
            />
          ))
        )}
        <Button label="Fundar ou entrar em outra Legião" variant="ghost" icon="mais" onPress={() => router.navigate('/legiao')} />
      </View>

      {/* Perfil é quem você é; o que o app faz fica em Configurações, um toque à frente. */}
      <LinkRow
        label="Configurações"
        icon="escudo"
        description="Aparência, privacidade, relógios e conta"
        onPress={() => router.push('/configuracoes')}
      />
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
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  rankCard: {
    gap: space.md,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  rankText: {
    flex: 1,
    gap: 2,
  },
  rankLinks: {
    marginHorizontal: -space.lg,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  block: {
    gap: space.md,
  },
  section: {
    gap: space.xs,
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginBottom: space.xs,
  },
  flex: {
    flex: 1,
  },
});
