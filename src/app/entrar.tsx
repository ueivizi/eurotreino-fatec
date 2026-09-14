import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankMedallion } from '@/components/rank/rank-medallion';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { AUTH_MESSAGES, authErrorMessage } from '@/features/auth/auth-errors';
import {
  EMAIL_MAX_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  isValidEmail,
  isValidOtp,
  normalizeEmail,
  normalizeOtp,
} from '@/features/auth/credentials';
import { getSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type Step = { kind: 'email' } | { kind: 'code'; email: string };

/** Portões (RF001): entrada com código enviado ao e-mail, sem senha. */
export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>({ kind: 'email' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

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
    if (step.kind !== 'code') return;
    const token = normalizeOtp(code);
    if (!isValidOtp(token)) {
      setFieldError('O código tem só números. Confira o e-mail que enviamos.');
      return;
    }
    void run(async () => {
      const { error: verifyError } = await getSupabase().auth.verifyOtp({ email: step.email, token, type: 'email' });
      // Com sucesso, a sessão muda e o layout raiz leva à próxima tela.
      if (verifyError) setError(authErrorMessage(verifyError));
    });
  }

  function resendCode() {
    if (step.kind !== 'code' || cooldown > 0) return;
    void run(async () => {
      if (await sendCode(step.email)) setInfo('Enviamos um código novo. Confira também a caixa de spam.');
    });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xxxl },
        ]}>
        <View style={styles.hero}>
          <RankMedallion tier={7} size={112} accessibilityLabel="Medalhão do Olimpo" />
          <AppText variant="title" style={styles.brand}>EUROTREINO</AppText>
          <AppText variant="motto" tone="gold" style={styles.center}>Treine em legião, conquiste o Olimpo.</AppText>
        </View>

        {step.kind === 'email' ? (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Entrar</AppText>
              <AppText tone="secondary">Receba um código no seu e-mail. Não há senha para lembrar.</AppText>
            </View>
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
            <AppText variant="caption" tone="muted" style={styles.center}>
              Usamos seu e-mail só para você entrar no EuroTreino.
            </AppText>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Digite o código</AppText>
              <AppText tone="secondary">{`Enviamos um código para ${step.email}.`}</AppText>
            </View>
            <TextField
              label="Código"
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setFieldError(null);
              }}
              placeholder="000000"
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
              <Button
                variant="ghost"
                label="Usar outro e-mail"
                onPress={() => {
                  setStep({ kind: 'email' });
                  setFieldError(null);
                  setError(null);
                  setInfo(null);
                }}
                disabled={busy}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xxxl,
  },
  hero: {
    alignItems: 'center',
    gap: space.sm,
  },
  brand: {
    letterSpacing: 4,
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
});
