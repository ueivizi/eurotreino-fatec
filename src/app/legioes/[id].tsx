import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { ScreenHeader } from '@/components/screen-header';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import { formatInviteCode, inviteShareMessage } from '@/features/legions/invite-code';
import { fetchInvite, fetchMyLegions, leaveLegion, regenerateInvite } from '@/features/legions/legions-api';
import { rankFromGlory } from '@/features/ranks/tiers';
import { isUuid } from '@/lib/parse';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { fonts, space } from '@/theme/tokens';

const expiryFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Confirmation = 'regenerate' | 'leave' | null;

export default function LegionDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const legionId = isUuid(params.id) ? params.id : null;

  const [confirming, setConfirming] = useState<Confirmation>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const legion = legions.data?.find((item) => item.id === legionId) ?? null;

  const invite = useQuery({
    queryKey: queryKeys.invite(legionId ?? ''),
    queryFn: () => fetchInvite(legionId as string),
    enabled: legion !== null,
  });
  const members = useQuery({
    queryKey: queryKeys.ranking(legionId ?? '', 0),
    queryFn: () => fetchWeeklyRanking(legionId as string, 0),
    enabled: legion !== null,
  });

  const regenerate = useMutation({
    mutationFn: () => regenerateInvite(legionId as string),
    onSuccess: (newInvite) => {
      queryClient.setQueryData(queryKeys.invite(legionId as string), newInvite);
      setConfirming(null);
      setCopyState('idle');
    },
  });

  const leave = useMutation({
    mutationFn: () => leaveLegion(legionId as string),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.invite(legionId as string) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.legions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
      router.replace('/legiao');
    },
  });

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

  const isOwner = legion.role === 'owner';
  const code = invite.data?.code ?? null;

  async function share() {
    if (!code || !legion) return;
    try {
      await Share.share({ message: inviteShareMessage(legion.name, code) });
    } catch {
      // Sem folha de compartilhamento (ex.: alguns navegadores): copia o código no lugar.
      await copy();
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(formatInviteCode(code));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}
      refreshControl={
        <RefreshControl
          refreshing={legions.isRefetching || invite.isRefetching || members.isRefetching}
          onRefresh={() => {
            void legions.refetch();
            void invite.refetch();
            void members.refetch();
          }}
          tintColor={colors.gold}
        />
      }>
      <ScreenHeader title={legion.name} subtitle={`${isOwner ? 'Você é o fundador · ' : ''}${legion.memberCount} de 50 membros`} />

      <Card style={styles.inviteCard}>
        <AppText variant="overline" tone="muted">Convite</AppText>
        {invite.isPending ? (
          <ActivityIndicator color={colors.gold} />
        ) : invite.isError ? (
          <Notice tone="danger" message={errorMessage(invite.error)} />
        ) : code ? (
          <>
            <AppText
              style={[styles.code, { color: colors.goldHighlight }]}
              accessibilityLabel={`Código de convite: ${code.split('').join(' ')}`}
              selectable>
              {formatInviteCode(code)}
            </AppText>
            <AppText variant="caption" tone="muted">
              {`Vale até ${expiryFormat.format(new Date(invite.data.expiresAt))}. Quem receber o código entra pela aba Legião.`}
            </AppText>
            <View style={styles.inviteActions}>
              <Button label="Compartilhar convite" icon="compartilhar" onPress={() => void share()} />
              <Button
                label={copyState === 'copied' ? 'Código copiado' : 'Copiar código'}
                icon={copyState === 'copied' ? 'check' : 'copiar'}
                variant="secondary"
                onPress={() => void copy()}
              />
            </View>
            {copyState === 'failed' ? (
              <Notice tone="danger" message="Não foi possível copiar. Anote o código acima para enviar." />
            ) : null}
          </>
        ) : null}
      </Card>

      {isOwner ? (
        confirming === 'regenerate' ? (
          <View style={styles.confirm}>
            <Notice message="O código atual deixa de funcionar na hora. Quem ainda não entrou vai precisar do novo." />
            <Button
              label={regenerate.isPending ? 'Gerando…' : 'Gerar novo código'}
              onPress={() => regenerate.mutate()}
              disabled={regenerate.isPending}
            />
            <Button label="Cancelar" variant="ghost" onPress={() => setConfirming(null)} disabled={regenerate.isPending} />
            {regenerate.isError ? <Notice tone="danger" message={errorMessage(regenerate.error)} /> : null}
          </View>
        ) : (
          <Button label="Gerar novo código" variant="ghost" onPress={() => setConfirming('regenerate')} />
        )
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="subheading">Membros</AppText>
          <Button
            label="Ver Arena"
            variant="ghost"
            icon="arena"
            onPress={() => router.navigate({ pathname: '/arena', params: { legiao: legion.id } })}
          />
        </View>
        {members.isPending ? (
          <ActivityIndicator color={colors.gold} />
        ) : members.isError ? (
          <Notice tone="danger" message={errorMessage(members.error)} />
        ) : (
          members.data.entries
            .slice()
            .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'))
            .map((member) => (
              <PressableScale
                key={member.userId}
                accessibilityRole="button"
                accessibilityLabel={`${member.displayName}${member.isMe ? ' (você)' : ''}, ${rankFromGlory(member.totalGlory).label}. Ver perfil.`}
                onPress={() =>
                  member.isMe
                    ? router.navigate('/perfil')
                    : router.push({ pathname: '/membro/[id]', params: { id: member.userId, legiao: legion.id } })
                }
                style={[styles.memberRow, { borderBottomColor: colors.hairlineSoft }]}>
                <EmblemAvatar emblem={member.emblem} size={36} />
                <View style={styles.memberText}>
                  <AppText variant="bodyMedium" numberOfLines={1}>
                    {member.isMe ? `${member.displayName} · você` : member.displayName}
                  </AppText>
                  <AppText variant="caption" tone="muted">
                    {`${rankFromGlory(member.totalGlory).label}${member.role === 'owner' ? ' · Fundador' : ''}`}
                  </AppText>
                </View>
                <Icon name="chevronRight" size={18} color={colors.textMuted} />
              </PressableScale>
            ))
        )}
      </View>

      {confirming === 'leave' ? (
        <View style={styles.confirm}>
          <Notice
            message={
              isOwner && legion.memberCount > 1
                ? 'Você sai da Arena desta Legião e o membro mais antigo vira fundador. Sua Glória acumulada continua com você.'
                : legion.memberCount <= 1
                  ? 'Você é o último membro: a Legião será apagada. Sua Glória acumulada continua com você.'
                  : 'Você sai da Arena desta Legião. Sua Glória acumulada continua com você.'
            }
          />
          <Button label={leave.isPending ? 'Saindo…' : 'Sair da Legião'} variant="danger" onPress={() => leave.mutate()} disabled={leave.isPending} />
          <Button label="Cancelar" variant="ghost" onPress={() => setConfirming(null)} disabled={leave.isPending} />
          {leave.isError ? <Notice tone="danger" message={errorMessage(leave.error)} /> : null}
        </View>
      ) : (
        <Button label="Sair da Legião" variant="danger" onPress={() => setConfirming('leave')} />
      )}
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
  inviteCard: {
    gap: space.sm,
  },
  code: {
    fontFamily: fonts.bodySemibold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: 3,
    fontVariant: ['tabular-nums'],
  },
  inviteActions: {
    gap: space.sm,
    marginTop: space.sm,
  },
  confirm: {
    gap: space.sm,
  },
  section: {
    gap: space.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  memberRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
  },
  memberText: {
    flex: 1,
  },
});
