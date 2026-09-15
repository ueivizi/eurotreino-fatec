import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Monogram } from '@/components/brand/monogram';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { takeAccountDeleted } from '@/features/account/deletion-notice';
import { AUTH_MESSAGES, authErrorMessage } from '@/features/auth/auth-errors';
import {
  EMAIL_MAX_LENGTH,
  OTP_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  isValidEmail,
  isValidOtp,
  normalizeEmail,
  normalizeOtp,
} from '@/features/auth/credentials';
import { OAUTH_CANCELLED_MESSAGE, fetchAuthProviders, signInWithGoogle } from '@/features/auth/oauth';
import { getSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type Step = { kind: 'gates' } | { kind: 'email' } | { kind: 'code'; email: string };

/** Faixa de grega (meandro) sob o nome, como no canvas. */
function Meander() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={132} height={12} viewBox="0 0 132 12">
        <Defs>
          <Pattern id="grega" width={12} height={12} patternUnits="userSpaceOnUse">
            <Path d="M0 11.5 H12 M10 11.5 V1.5 H3 V8.5 H7.5 V4.5" fill="none" stroke="#C9A24A" strokeWidth={1.1} />
          </Pattern>
        </Defs>
        <Rect width={132} height={12} fill="url(#grega)" opacity={0.8} />
      </Svg>
    </View>
  );
}

/** Portões (RF001): entrada com Google, quando configurado, ou com código enviado ao e-mail. */
export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const providers = useQuery({ queryKey: ['auth-providers'], queryFn: fetchAuthProviders, staleTime: 5 * 60_000 });
  const googleEnabled = providers.data?.google === true;

  const [step, setStep] = useState<Step>({ kind: 'gates' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(() => (takeAccountDeleted() ? 'Sua conta e seus dados foram excluídos.' : null));
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Sem Google configurado, os Portões levam direto ao e-mail: um botão sozinho seria um toque a mais.
  const current: Step = step.kind === 'gates' && !providers.isPending && !googleEnabled ? { kind: 'email' } : step;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await action();
    } catch {
      setError(AUTH_MESSAGES.generic);
    } finally {
      setBusy(false);
    }
  }

  function continueWithGoogle() {
    void run(async () => {
      const result = await signInWithGoogle();
      // Com sucesso, a sessão muda e o layout raiz leva à próxima tela.
      if (result.status === 'error') setError(result.message);
      else if (result.status === 'cancelled') setInfo(OAUTH_CANCELLED_MESSAGE);
    });
  }

  async function sendCode(target: string): Promise<boolean> {
    const { error: requestError } = await getSupabase().auth.signInWithOtp({
      email: target,
      options: { shouldCreateUser: true },
    });
    if (requestError) {
      setError(authErrorMessage(requestError));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  function submitEmail() {
    const target = normalizeEmail(email);
    if (!isValidEmail(target)) {
      setFieldError('Digite um e-mail válido, como voce@exemplo.com.');
      return;
    }
    void run(async () => {
      if (await sendCode(target)) {
        setCode('');
        setStep({ kind: 'code', email: target });
      }
    });
  }

  function submitCode() {
    if (current.kind !== 'code') return;
    const token = normalizeOtp(code);
    if (!isValidOtp(token)) {
      setFieldError('O código tem só números. Confira o e-mail que enviamos.');
      return;
    }
    void run(async () => {
      const { error: verifyError } = await getSupabase().auth.verifyOtp({ email: current.email, token, type: 'email' });
      if (verifyError) setError(authErrorMessage(verifyError));
    });
  }

  function resendCode() {
    if (current.kind !== 'code' || cooldown > 0) return;
    void run(async () => {
      if (await sendCode(current.email)) setInfo('Enviamos um código novo. Confira também a caixa de spam.');
    });
  }

  function goTo(next: Step) {
    setStep(next);
    setFieldError(null);
    setError(null);
    setInfo(null);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxl }]}>
        <View style={styles.hero}>
          <Monogram size={current.kind === 'gates' ? 132 : 96} />
          <AppText variant="title" tone="goldHighlight" style={styles.brand}>EUROTREINO</AppText>
          <Meander />
          {current.kind === 'gates' ? (
            <>
              <View style={styles.motto}>
                <AppText variant="motto" style={styles.center}>Mens sana in corpore sano</AppText>
                <AppText variant="label" tone="muted" style={styles.center}>Mente sã em corpo são</AppText>
              </View>
              <AppText tone="secondary" style={[styles.center, styles.tagline]}>
                Treine com seus amigos, conquiste Glória e suba do Recruta ao Olimpiano.
              </AppText>
            </>
          ) : null}
        </View>

        {current.kind === 'gates' ? (
          <View style={styles.form}>
            {providers.isPending ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              <>
                <Button label={busy ? 'Abrindo o Google…' : 'Continuar com Google'} onPress={continueWithGoogle} disabled={busy} />
                <Button label="Receber código por e-mail" icon="email" variant="ghost" onPress={() => goTo({ kind: 'email' })} disabled={busy} />
              </>
            )}
            {error ? <Notice tone="danger" message={error} /> : info ? <Notice message={info} /> : null}
          </View>
        ) : current.kind === 'email' ? (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Entrar com e-mail</AppText>
              <AppText tone="secondary">Receba um código no seu e-mail. Não há senha para lembrar.</AppText>
            </View>
            {info ? <Notice message={info} /> : null}
            <TextField
              label="E-mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setFieldError(null);
              }}
              placeholder="voce@exemplo.com"
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={EMAIL_MAX_LENGTH}
              returnKeyType="send"
              onSubmitEditing={submitEmail}
              error={fieldError}
            />
            <Button label={busy ? 'Enviando…' : 'Receber código'} onPress={submitEmail} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            {googleEnabled ? <Button label="Voltar" variant="ghost" onPress={() => goTo({ kind: 'gates' })} disabled={busy} /> : null}
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Digite o código</AppText>
              <AppText tone="secondary">{`Enviamos um código de ${OTP_LENGTH} dígitos para ${current.email}.`}</AppText>
            </View>
            <TextField
              label="Código"
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setFieldError(null);
              }}
              placeholder={'0'.repeat(OTP_LENGTH)}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={12}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitCode}
              error={fieldError}
            />
            <Button label={busy ? 'Entrando…' : 'Entrar'} onPress={submitCode} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : info ? <Notice message={info} /> : null}
            <View style={styles.secondaryActions}>
              <Button
                variant="ghost"
                label={cooldown > 0 ? `Reenviar código em ${cooldown} s` : 'Reenviar código'}
                onPress={resendCode}
                disabled={busy || cooldown > 0}
              />
              <Button variant="ghost" label="Usar outro e-mail" onPress={() => goTo({ kind: 'email' })} disabled={busy} />
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.inline}>
            <Icon name="escudo" size={16} color={colors.gold} />
            <AppText variant="label" tone="secondary">Sua Glória só é vista pela sua Legião.</AppText>
          </View>
          <AppText variant="caption" tone="muted" style={styles.center}>
            {'Ao continuar, você aceita os '}
            <AppText variant="caption" tone="gold" accessibilityRole="link" onPress={() => router.push('/termos')}>
              Termos de Uso
            </AppText>
            {' e a '}
            <AppText variant="caption" tone="gold" accessibilityRole="link" onPress={() => router.push('/privacidade')}>
              Política de Privacidade
            </AppText>
            .
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    gap: space.xxl,
  },
  hero: {
    alignItems: 'center',
    gap: space.md,
  },
  brand: {
    letterSpacing: 5,
  },
  motto: {
    gap: 2,
  },
  tagline: {
    maxWidth: 300,
  },
  center: {
    textAlign: 'center',
  },
  form: {
    gap: space.lg,
  },
  intro: {
    gap: space.xs,
  },
  secondaryActions: {
    gap: space.xs,
  },
  footer: {
    marginTop: 'auto',
    gap: space.sm,
    alignItems: 'center',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
