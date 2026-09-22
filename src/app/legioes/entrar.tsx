import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { CodeField } from '@/components/ui/code-field';
import {
  INVITE_CODE_LENGTH,
  inviteCodeFromLink,
  isValidInviteCode,
  normalizeInviteCode,
} from '@/features/legions/invite-code';
import { joinLegion, previewInvite } from '@/features/legions/legions-api';
import type { InvitePreview, JoinResult } from '@/features/legions/legions-parsers';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const INVALID_CODE = 'Código inválido, vencido ou substituído. Peça um código novo a quem te convidou.';
const RATE_LIMITED = 'Muitas tentativas com código errado. Aguarde uma hora e tente de novo.';

function joinProblem(result: JoinResult): string | null {
  switch (result.status) {
    case 'invalid':
      return INVALID_CODE;
    case 'rate_limited':
      return RATE_LIMITED;
    case 'group_full':
      return `A ${result.legionName} já tem 50 membros.`;
    case 'group_limit_reached':
      return 'Você já está em 10 Legiões. Saia de uma para entrar nesta.';
    default:
      return null;
  }
}

/** RF005: entrar em Legião por código, com prévia antes de confirmar. */
export default function JoinLegionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ codigo?: string }>();
  const linkCode = inviteCodeFromLink(params.codigo);

  // O valor é o código limpo; o traço de XXXX-XXXX é desenho do campo.
  const [code, setCode] = useState(linkCode ? normalizeInviteCode(linkCode) : '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const normalized = normalizeInviteCode(code);

  // Prévia e entrada são ações (mutations): uma consulta automática gastaria tentativas do limite.
  const preview = useMutation({ mutationFn: (value: string) => previewInvite(value) });
  const join = useMutation({
    mutationFn: (value: string) => joinLegion(value),
    onSuccess: (result) => {
      if (result.status === 'joined' || result.status === 'already_member') {
        void queryClient.invalidateQueries({ queryKey: queryKeys.legions });
        void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
        router.replace({ pathname: '/legioes/[id]', params: { id: result.legionId } });
      }
    },
  });

  const autoPreviewed = useRef(false);
  useEffect(() => {
    // Código vindo de um link: mostra a prévia direto, uma vez.
    if (linkCode && !autoPreviewed.current) {
      autoPreviewed.current = true;
      preview.mutate(linkCode);
    }
  }, [linkCode, preview]);

  function showPreview() {
    if (!isValidInviteCode(normalized)) {
      setFieldError('O código tem 8 letras e números, como ABCD-2345.');
      return;
    }
    join.reset();
    preview.mutate(normalized);
  }

  const previewData: InvitePreview | undefined = preview.data;
  const joinResult = join.data;
  const problem = joinResult ? joinProblem(joinResult) : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <ScreenHeader title="Entrar com código" subtitle="Peça o código a quem fundou a Legião" />

        <CodeField
          label="Código de convite"
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setFieldError(null);
            preview.reset();
            join.reset();
          }}
          length={INVITE_CODE_LENGTH}
          sanitize={(text, length) => normalizeInviteCode(text).slice(0, length)}
          separatorAfter={4}
          keyboardType="default"
          hint="Oito símbolos, sem os parecidos: nada de 0, O, 1 nem I."
          returnKeyType="search"
          onSubmitEditing={showPreview}
          error={fieldError}
        />

        {!previewData || previewData.status !== 'ok' ? (
          <Button label={preview.isPending ? 'Buscando…' : 'Ver Legião'} onPress={showPreview} disabled={preview.isPending} />
        ) : null}

        {preview.isError ? <Notice tone="danger" message={errorMessage(preview.error)} /> : null}
        {previewData?.status === 'invalid' ? <Notice tone="danger" message={INVALID_CODE} /> : null}
        {previewData?.status === 'rate_limited' ? <Notice tone="danger" message={RATE_LIMITED} /> : null}

        {previewData?.status === 'ok' ? (
          <View style={styles.previewBlock}>
            <Card style={styles.preview}>
              <EmblemAvatar emblem={previewData.emblem} size={64} />
              <View style={styles.previewText}>
                <AppText variant="heading" numberOfLines={2}>{previewData.name}</AppText>
                <AppText variant="label" tone="muted">{`${previewData.memberCount} de 50 membros`}</AppText>
              </View>
            </Card>

            {previewData.isMember ? (
              <>
                <Notice message="Você já faz parte desta Legião." />
                <Button label="Ver minhas Legiões" variant="secondary" onPress={() => router.replace('/legiao')} />
              </>
            ) : (
              <Button
                label={join.isPending ? 'Entrando…' : 'Entrar na Legião'}
                onPress={() => join.mutate(normalized)}
                disabled={join.isPending}
              />
            )}
            {join.isError ? <Notice tone="danger" message={errorMessage(join.error)} /> : null}
            {problem ? <Notice tone="danger" message={problem} /> : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  previewBlock: {
    gap: space.md,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  previewText: {
    flex: 1,
    gap: space.xs,
  },
});
