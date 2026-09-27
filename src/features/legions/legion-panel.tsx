import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/motion/pressable-scale';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { fetchWeeklyRanking } from '@/features/arena/arena-api';
import { formatInviteCode, inviteShareMessage } from '@/features/legions/invite-code';
import { fetchInvite, leaveLegion, regenerateInvite } from '@/features/legions/legions-api';
import type { LegionSummary } from '@/features/legions/legions-parsers';
import { rankFromGlory } from '@/features/ranks/tiers';
import { useLegionPhotos } from '@/features/profile/photo';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const expiryFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

type Confirmation = 'regenerate' | 'leave' | null;

function Tag({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { borderColor: colors.gold }]}>
      <AppText variant="overline" tone="goldHighlight" style={styles.tagText}>{label}</AppText>
    </View>
  );
}

/** Recarrega o que o painel mostra: convite e membros de uma Legião. */
export function refetchLegionPanel(queryClient: QueryClient, legionId: string) {
  return Promise.all([
    queryClient.refetchQueries({ queryKey: queryKeys.invite(legionId) }),
    queryClient.refetchQueries({ queryKey: queryKeys.ranking(legionId, 0) }),
  ]);
}

/**
 * O que se faz numa Legião (quadro 2.4): convite, novo código, Mural, membros por rank e sair.
 * Aparece direto na aba Legião e também em `/legioes/[id]`, aberta a partir do Perfil.
 */
export function LegionPanel({ legion, children }: { legion: LegionSummary; children?: ReactNode }) {
  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const legionId = legion.id;

  const [confirming, setConfirming] = useState<Confirmation>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const invite = useQuery({ queryKey: queryKeys.invite(legionId), queryFn: () => fetchInvite(legionId) });
  const members = useQuery({ queryKey: queryKeys.ranking(legionId, 0), queryFn: () => fetchWeeklyRanking(legionId, 0) });

  const regenerate = useMutation({
    mutationFn: () => regenerateInvite(legionId),
    onSuccess: (newInvite) => {
      queryClient.setQueryData(queryKeys.invite(legionId), newInvite);
      setConfirming(null);
      setCopyState('idle');
    },
  });

  const leave = useMutation({
    mutationFn: () => leaveLegion(legionId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.invite(legionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.legions });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
      router.replace('/legiao');
    },
  });

  const isOwner = legion.role === 'owner';
  const photos = useLegionPhotos(legion.id);
  const code = invite.data?.code ?? null;

  async function share() {
    if (!code) return;
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
    <View style={styles.panel}>
      <Card style={styles.inviteCard}>
        <AppText variant="overline" tone="muted">Convite</AppText>
        {invite.isPending ? (
          <ActivityIndicator color={colors.gold} />
        ) : invite.isError ? (
          <Notice tone="danger" message={errorMessage(invite.error)} />
        ) : code ? (
          <>
            <AppText
              variant="code"
              style={{ color: colors.goldHighlight }}
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

      {isOwner ? (
        <Button
          label="Estandarte e modo"
          icon="legiao"
          variant="ghost"
          onPress={() => router.push({ pathname: '/legioes/estandarte/[id]', params: { id: legion.id } })}
        />
      ) : null}

      <Button
        label="Abrir o Mural"
        icon="mural"
        variant="secondary"
        onPress={() => router.push({ pathname: '/mural/[id]', params: { id: legion.id } })}
      />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="subheading">Membros</AppText>
          <Button
            label="Ver Coliseu"
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
            .sort((a, b) => b.totalGlory - a.totalGlory || a.displayName.localeCompare(b.displayName, 'pt-BR'))
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
                <EmblemAvatar emblem={member.emblem} color={member.emblemColor} size={36} photoUri={photos[member.userId]} />
                <View style={styles.memberText}>
                  <AppText variant="bodyMedium" numberOfLines={1}>{member.displayName}</AppText>
                  <AppText variant="caption" tone="muted">{rankFromGlory(member.totalGlory).label}</AppText>
                </View>
                {/* Selos do quadro 2.4: quem fundou e quem é você. */}
                {member.role === 'owner' ? <Tag label="Fundador" /> : null}
                {member.isMe ? <Tag label="Você" /> : null}
                <Icon name="chevronRight" size={18} color={colors.textMuted} />
              </PressableScale>
            ))
        )}
      </View>

      {/* O que a tela quiser acrescentar entra aqui: sair da Legião fecha a lista, por ser destrutivo. */}
      {children}

      {confirming === 'leave' ? (
        <View style={styles.confirm}>
          <Notice
            message={
              isOwner && legion.memberCount > 1
                ? 'Você sai do Coliseu desta Legião e o membro mais antigo vira fundador. Sua Glória acumulada continua com você.'
                : legion.memberCount <= 1
                  ? 'Você é o último membro: a Legião será apagada. Sua Glória acumulada continua com você.'
                  : 'Você sai do Coliseu desta Legião. Sua Glória acumulada continua com você.'
            }
          />
          <Button label={leave.isPending ? 'Saindo…' : 'Sair da Legião'} variant="danger" onPress={() => leave.mutate()} disabled={leave.isPending} />
          <Button label="Cancelar" variant="ghost" onPress={() => setConfirming(null)} disabled={leave.isPending} />
          {leave.isError ? <Notice tone="danger" message={errorMessage(leave.error)} /> : null}
        </View>
      ) : (
        <Button label="Sair da Legião" variant="danger" onPress={() => setConfirming('leave')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.xl,
  },
  inviteCard: {
    gap: space.sm,
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
  tag: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tagText: {
    fontSize: 10,
    lineHeight: 14,
  },
});
