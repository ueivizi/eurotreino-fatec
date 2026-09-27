import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { ScreenHeader } from '@/components/screen-header';
import { StatusScreen } from '@/components/status-screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText, textVariantStyle } from '@/components/ui/text';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { useLegionPhotos } from '@/features/profile/photo';
import {
  MESSAGE_MAX_LENGTH,
  clearMessageReports,
  deleteMessage,
  fetchMural,
  postMessage,
  reportMessage,
  type MuralMessage,
} from '@/features/mural/mural-api';
import { isUuid } from '@/lib/parse';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

/** Enquanto a tela está aberta, o mural se atualiza sozinho: conversa parada parece quebrada. */
const REFRESH_MS = 20_000;

const { fontFamily, fontSize } = textVariantStyle('input');

function timeAgo(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ontem' : `há ${days} dias`;
}

type Actions = {
  onDelete: () => void;
  onReport: () => void;
  onClear: () => void;
  busy: boolean;
  isOwner: boolean;
};

/**
 * Uma mensagem, e as ações que ela aceita — que aparecem ao tocar nela: **denúncia em dois toques**,
 * como o desenho pede. Quem escreveu apaga a própria; o fundador apaga qualquer uma e ainda pode
 * liberar o que foi retido por denúncias.
 */
function Message({ message, now, actions, index, photoUri }: { message: MuralMessage; now: Date; actions: Actions; index: number; photoUri?: string }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const canDelete = message.isMine || actions.isOwner;

  return (
    <Reveal index={Math.min(index, 8)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${message.displayName}, ${timeAgo(message.createdAt, now)}: ${message.body}`}
        accessibilityHint="Toque para denunciar ou apagar"
        onPress={() => setOpen((value) => !value)}
        style={[
          styles.message,
          {
            borderColor: message.isHeld ? colors.danger : colors.hairlineSoft,
            backgroundColor: message.isMine ? colors.selectedFill : colors.surface,
          },
        ]}>
        <EmblemAvatar emblem={message.emblem} color={message.emblemColor} size={32} photoUri={photoUri} />
        <View style={styles.flex}>
          <View style={styles.messageHead}>
            <AppText variant="bodyMedium" numberOfLines={1} style={styles.flex}>
              {message.isMine ? `${message.displayName} · você` : message.displayName}
            </AppText>
            <AppText variant="caption" tone="muted">{timeAgo(message.createdAt, now)}</AppText>
          </View>
          {message.isFromOwner ? <AppText variant="caption" tone="gold">Fundador</AppText> : null}
          <AppText variant="body" tone="secondary">{message.body}</AppText>
          {message.isHeld ? (
            <AppText variant="caption" tone="danger">
              {actions.isOwner
                ? `Retida por ${message.reportsCount} ${message.reportsCount === 1 ? 'denúncia' : 'denúncias'}. Só você está vendo.`
                : 'Retida por denúncias. O fundador vai decidir.'}
            </AppText>
          ) : null}
        </View>
      </Pressable>

      {open ? (
        <View style={styles.actions}>
          {canDelete ? <Button label="Apagar" icon="excluir" variant="danger" onPress={actions.onDelete} disabled={actions.busy} /> : null}
          {actions.isOwner && message.isHeld ? (
            <Button label="Liberar" icon="check" variant="secondary" onPress={actions.onClear} disabled={actions.busy} />
          ) : null}
          {message.isMine ? null : (
            <Button label="Denunciar" icon="info" variant="ghost" onPress={actions.onReport} disabled={actions.busy} />
          )}
        </View>
      ) : null}
    </Reveal>
  );
}

/** Mural da Legião (P7): conversa entre membros, com moderação desde o primeiro commit. */
export default function MuralScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string }>();
  const legionId = isUuid(params.id) ? params.id : null;

  const [draft, setDraft] = useState('');
  // O relógio anda junto: "há 5 min" que não avança envelhece a conversa na tela.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });
  const legion = legions.data?.find((item) => item.id === legionId) ?? null;
  const photos = useLegionPhotos(legionId);

  const mural = useQuery({
    queryKey: queryKeys.mural(legionId ?? ''),
    queryFn: () => fetchMural(legionId as string),
    enabled: legion !== null,
    refetchInterval: REFRESH_MS,
    staleTime: 0,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.mural(legionId ?? '') });

  const send = useMutation({
    mutationFn: () => postMessage(legionId as string, draft.trim()),
    onSuccess: async () => {
      setDraft('');
      await refresh();
    },
  });
  const remove = useMutation({ mutationFn: deleteMessage, onSuccess: refresh });
  const report = useMutation({ mutationFn: reportMessage, onSuccess: refresh });
  const clear = useMutation({ mutationFn: clearMessageReports, onSuccess: refresh });

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

  const busy = remove.isPending || report.isPending || clear.isPending;
  const failure = [send.error, remove.error, report.error, clear.error].find((error) => error !== null);
  const canSend = draft.trim().length > 0 && !send.isPending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
      keyboardVerticalOffset={insets.top}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}
        refreshControl={
          <RefreshControl refreshing={mural.isRefetching} onRefresh={() => void mural.refetch()} tintColor={colors.gold} />
        }>
        <ScreenHeader
          title="Mural"
          subtitle={legion ? `${legion.name} · ${legion.memberCount} membros` : 'Carregando…'}
          fallbackHref="/legiao"
        />

        {mural.isPending ? (
          <ActivityIndicator color={colors.gold} style={styles.loading} />
        ) : mural.isError ? (
          <View style={styles.block}>
            <Notice tone="danger" message={errorMessage(mural.error)} />
            <Button label="Tentar de novo" variant="secondary" onPress={() => void mural.refetch()} />
          </View>
        ) : mural.data.length === 0 ? (
          <Notice message="O Mural está vazio. Combine o treino do fim de semana, chame a Legião para a disputa — o que a Legião escrever fica só aqui." />
        ) : (
          <View style={styles.list}>
            {mural.data.map((message, index) => (
              <Message
                key={message.id}
                message={message}
                now={now}
                index={index}
                photoUri={photos[message.authorId]}
                actions={{
                  isOwner: legion?.role === 'owner',
                  busy,
                  onDelete: () => remove.mutate(message.id),
                  onReport: () => report.mutate(message.id),
                  onClear: () => clear.mutate(message.id),
                }}
              />
            ))}
          </View>
        )}

        {failure ? <Notice tone="danger" message={errorMessage(failure)} /> : null}

        <Card style={styles.rules}>
          <AppText variant="overline" tone="gold">Regras do Mural</AppText>
          <AppText variant="caption" tone="secondary">
            Só membros escrevem, e só dentro da Legião. Sem foto, sem link e sem mensagem privada. Quem
            escreveu apaga a própria mensagem, e o fundador apaga qualquer uma.
          </AppText>
          <AppText variant="caption" tone="muted">
            Denunciar tira a mensagem da sua vista na hora. Com três denúncias, ela some para todos até
            o fundador decidir.
          </AppText>
        </Card>
      </ScrollView>

      <View
        style={[
          styles.composer,
          { borderTopColor: colors.hairlineSoft, backgroundColor: colors.background, paddingBottom: insets.bottom + space.md },
        ]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Escreva para a Legião…"
          placeholderTextColor={colors.textMuted}
          maxLength={MESSAGE_MAX_LENGTH}
          multiline
          maxFontSizeMultiplier={1.4}
          accessibilityLabel="Mensagem para a Legião"
          editable={!send.isPending}
          style={[styles.input, { color: colors.text, borderColor: colors.hairline, backgroundColor: colors.surface }]}
        />
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={() => send.mutate()}
          style={[styles.send, { backgroundColor: canSend ? colors.gold : colors.track }]}>
          <Icon name="enviar" size={20} color={canSend ? colors.onGold : colors.textMuted} strokeWidth={1.8} />
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  list: {
    gap: space.sm,
  },
  message: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  messageHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: space.sm,
    marginTop: space.xs,
  },
  rules: {
    gap: space.xs,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: touchTarget,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    fontFamily,
    fontSize,
  },
  send: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  block: {
    gap: space.md,
  },
  flex: {
    flex: 1,
  },
  loading: {
    marginTop: space.xl,
  },
});
