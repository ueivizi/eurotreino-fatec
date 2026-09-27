import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CodeField } from '@/components/ui/code-field';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { FormScrollView } from '@/components/ui/form-scroll';
import { ACCOUNT_DELETION_REDIRECT, deleteAccount, type DeleteAccountResult } from '@/features/account/account-api';
import { markAccountDeleted } from '@/features/account/deletion-notice';
import { AUTH_MESSAGES, authErrorMessage } from '@/features/auth/auth-errors';
import { OTP_LENGTH, RESEND_COOLDOWN_SECONDS, isValidOtp, normalizeOtp } from '@/features/auth/credentials';
import { useSession } from '@/features/auth/session';
import { CONTACT_EMAIL } from '@/features/legal/documents';
import { fetchMyLegions } from '@/features/legions/legions-api';
import { useOfflineQueue } from '@/features/workouts/offline-queue-provider';
import { queryKeys } from '@/lib/query-client';
import { RPC_MESSAGES } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const FAILURES: Record<Exclude<DeleteAccountResult, { ok: true }>['reason'], string> = {
  reauthentication_required: 'A confirmação venceu. Peça um código novo e tente de novo.',
  not_authenticated: 'Sua sessão terminou. Entre de novo para excluir a conta.',
  network: RPC_MESSAGES.network,
  failed: `Não foi possível excluir agora. Tente de novo em instantes; se continuar, escreva para ${CONTACT_EMAIL}.`,
};

function Item({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.item}>
      <Icon name="check" size={16} color={colors.gold} />
      <AppText variant="label" tone="secondary" style={styles.flex}>{text}</AppText>
    </View>
  );
}

/** RF011 · LGPD: exclusão definitiva da conta, confirmada com código enviado ao e-mail. */
export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state } = useSession();
  const queue = useOfflineQueue();
  const legions = useQuery({ queryKey: queryKeys.legions, queryFn: fetchMyLegions });

  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (state.status !== 'ready') return null;
  const email = state.email;

  const owned = (legions.data ?? []).filter((legion) => legion.role === 'owner');
  const passedOn = owned.filter((legion) => legion.memberCount > 1).map((legion) => legion.name);
  const removed = owned.filter((legion) => legion.memberCount <= 1).map((legion) => legion.name);

  async function sendCode() {
    if (!email) {
      setError(`Sua conta não tem e-mail para confirmar a exclusão. Escreva para ${CONTACT_EMAIL}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // O endereço de retorno só marca o pedido: o e-mail chega como confirmação de exclusão, não de entrada.
      const { error: requestError } = await getSupabase().auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: ACCOUNT_DELETION_REDIRECT },
      });
      if (requestError) {
        setError(authErrorMessage(requestError));
      } else {
        setCodeSent(true);
        setCode('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } catch {
      setError(AUTH_MESSAGES.generic);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeletion() {
    if (!email) return;
    const token = normalizeOtp(code);
    if (!isValidOtp(token)) {
      setError('O código tem só números. Confira o e-mail que enviamos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // O código renova a prova de identidade; sem ela, o servidor recusa a exclusão.
      const { error: verifyError } = await getSupabase().auth.verifyOtp({ email, token, type: 'email' });
      if (verifyError) {
        setError(authErrorMessage(verifyError));
        return;
      }
      const result = await deleteAccount();
      if (!result.ok) {
        setError(`${FAILURES[result.reason]} Referência: ${result.reference}.`);
        return;
      }
      markAccountDeleted();
      await queue.discardMine();
      queryClient.clear();
      // A conta já não existe no servidor: basta encerrar a sessão neste aparelho.
      await getSupabase().auth.signOut({ scope: 'local' });
    } catch (caught) {
      const name = caught instanceof Error && /^\w{1,40}$/.test(caught.name) ? caught.name : 'erro';
      setError(`${RPC_MESSAGES.generic} Referência: app ${name}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Excluir conta" subtitle="Esta ação não pode ser desfeita" />

      <Card style={styles.card}>
        <AppText variant="subheading">O que é apagado</AppText>
        <Item text="Seu perfil: nome de exibição e emblema." />
        <Item text="Todos os seus treinos e toda a sua Glória." />
        <Item text="Sua participação em todas as Legiões e Coliseus." />
        <Item text="Seu acesso: o e-mail deixa de entrar no EuroTreino." />
        {queue.pending.length > 0 ? (
          <Item text={`${queue.pending.length} ${queue.pending.length === 1 ? 'treino guardado' : 'treinos guardados'} neste aparelho, ainda sem envio.`} />
        ) : null}
      </Card>

      {passedOn.length > 0 ? (
        <Notice message={`Você é fundador de ${passedOn.join(', ')}. O membro mais antigo passa a ser o fundador.`} />
      ) : null}
      {removed.length > 0 ? (
        <Notice message={`Você é o único membro de ${removed.join(', ')}. Essas Legiões também são apagadas.`} />
      ) : null}

      {!codeSent ? (
        <View style={styles.actions}>
          <AppText tone="secondary">
            {email
      ? `Para confirmar que é você, enviamos um código para ${email}.`
      : 'Para confirmar que é você, precisamos enviar um código ao seu e-mail.'}
          </AppText>
          <Button label={busy ? 'Enviando…' : 'Enviar código de confirmação'} variant="danger" onPress={() => void sendCode()} disabled={busy} />
          {error ? <Notice tone="danger" message={error} /> : null}
          <Button label="Cancelar" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))} disabled={busy} />
        </View>
      ) : (
        <View style={styles.actions}>
          <CodeField
            label="Código de confirmação"
            value={code}
            onChangeText={(text) => {
      setCode(text);
      setError(null);
            }}
            hint={`Enviamos um código de ${OTP_LENGTH} dígitos para ${email ?? 'seu e-mail'}. Confira também a caixa de spam.`}
          />
          <Button
            label={busy ? 'Excluindo…' : 'Excluir conta definitivamente'}
            icon="excluir"
            variant="danger"
            onPress={() => void confirmDeletion()}
            disabled={busy}
          />
          {error ? <Notice tone="danger" message={error} /> : null}
          <Button
            label={cooldown > 0 ? `Reenviar código em ${cooldown} s` : 'Reenviar código'}
            variant="ghost"
            onPress={() => void sendCode()}
            disabled={busy || cooldown > 0}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))} disabled={busy} />
        </View>
      )}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  card: {
    gap: space.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
  actions: {
    gap: space.md,
  },
});
