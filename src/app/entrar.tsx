import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';

import { Monogram } from '@/components/brand/monogram';
import { Button } from '@/components/ui/button';
import { CodeField } from '@/components/ui/code-field';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { Separator } from '@/components/ui/separator';
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
import { PROVIDER_LABELS, SOCIAL_PROVIDERS, fetchAuthProviders, oauthCancelledMessage, signInWithProvider, type SocialProvider } from '@/features/auth/oauth';
import { confirmSignUp, resendSignUpCode, signInWithPassword } from '@/features/auth/password-auth';
import { getSupabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/**
 * Portões (RF001). Quem já tem conta entra direto com e-mail e senha — é o caminho principal.
 * Os outros caminhos ficam um toque atrás: entrada social, código por e-mail e criar conta.
 */
type Step =
  | { kind: 'senha' }
  /** Conta criada mas ainda não confirmada: o código do e-mail libera a entrada. */
  | { kind: 'confirmar'; email: string }
  | { kind: 'email' }
  | { kind: 'codigo'; email: string };

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

export default function SignInScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { height } = useWindowDimensions();
  /* Em tela curta (os 360x640 da vida real) o brasão encolhe e o lema sai: a entrada tem de
     caber sem rolagem, porque rolar para achar o campo de senha é o primeiro atrito do app. */
  const compact = height < 700;
  const providers = useQuery({ queryKey: ['auth-providers'], queryFn: fetchAuthProviders, staleTime: 5 * 60_000 });
  const enabledProviders = SOCIAL_PROVIDERS.filter((provider) => providers.data?.[provider] === true);

  const [step, setStep] = useState<Step>({ kind: 'senha' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(() => (takeAccountDeleted() ? 'Sua conta e seus dados foram excluídos.' : null));
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

  function goTo(next: Step) {
    setStep(next);
    setEmailError(null);
    setPasswordError(null);
    setCodeError(null);
    setError(null);
    setInfo(null);
  }

  function continueWithProvider(provider: SocialProvider) {
    void run(async () => {
      const result = await signInWithProvider(provider);
      // Com sucesso, a sessão muda e o layout raiz leva à próxima tela.
      if (result.status === 'error') setError(result.message);
      else if (result.status === 'cancelled') setInfo(oauthCancelledMessage(provider));
    });
  }

  /** Entrada principal: e-mail e senha. */
  function submitPassword() {
    const target = normalizeEmail(email);
    if (!isValidEmail(target)) {
      setEmailError('Digite um e-mail válido, como voce@exemplo.com.');
      return;
    }
    if (password.length === 0) {
      setPasswordError('Digite sua senha.');
      return;
    }
    void run(async () => {
      const result = await signInWithPassword(target, password);
      if (result.status === 'error') {
        setError(result.message);
      } else if (result.status === 'needs-code') {
        setPassword('');
        setCode('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        goTo({ kind: 'confirmar', email: target });
        setInfo('Falta confirmar seu e-mail. Enviamos um código para você.');
      }
    });
  }

  /** Confirmação do cadastro: o código do e-mail abre a conta. */
  function submitConfirmation() {
    if (step.kind !== 'confirmar') return;
    const token = normalizeOtp(code);
    if (!isValidOtp(token)) {
      setCodeError('O código tem só números. Confira o e-mail que enviamos.');
      return;
    }
    void run(async () => {
      const result = await confirmSignUp(step.email, token);
      if (result.status === 'error') setError(result.message);
    });
  }

  async function sendCode(target: string): Promise<boolean> {
    const { error: requestError } = await getSupabase().auth.signInWithOtp({
      email: target,
      options: { shouldCreateUser: false },
    });
    if (requestError) {
      setError(authErrorMessage(requestError));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  /** Caminho alternativo: entrar por código, sem senha. */
  function submitEmail() {
    const target = normalizeEmail(email);
    if (!isValidEmail(target)) {
      setEmailError('Digite um e-mail válido, como voce@exemplo.com.');
      return;
    }
    void run(async () => {
      if (await sendCode(target)) {
        setCode('');
        goTo({ kind: 'codigo', email: target });
      }
    });
  }

  function submitCode() {
    if (step.kind !== 'codigo') return;
    const token = normalizeOtp(code);
    if (!isValidOtp(token)) {
      setCodeError('O código tem só números. Confira o e-mail que enviamos.');
      return;
    }
    void run(async () => {
      const { error: verifyError } = await getSupabase().auth.verifyOtp({ email: step.email, token, type: 'email' });
      if (verifyError) setError(authErrorMessage(verifyError));
    });
  }

  function resendCode() {
    if (cooldown > 0) return;
    void run(async () => {
      if (step.kind === 'codigo') {
        if (await sendCode(step.email)) setInfo('Enviamos um código novo. Confira também a caixa de spam.');
        return;
      }
      if (step.kind !== 'confirmar') return;
      const result = await resendSignUpCode(step.email);
      if (result.ok) {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setInfo('Enviamos um código novo. Confira também a caixa de spam.');
      } else {
        setError(result.message);
      }
    });
  }

  const emailField = (
    <TextField
      label="E-mail"
      value={email}
      onChangeText={(text) => {
        setEmail(text);
        setEmailError(null);
      }}
      placeholder="voce@exemplo.com"
      keyboardType="email-address"
      inputMode="email"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
      maxLength={EMAIL_MAX_LENGTH}
      returnKeyType="next"
      error={emailError}
    />
  );

  const codeField = (
    <CodeField
      label="Código"
      value={code}
      onChangeText={(text) => {
        setCode(text);
        setCodeError(null);
      }}
      autoFocus
      returnKeyType="done"
      onSubmitEditing={step.kind === 'confirmar' ? submitConfirmation : submitCode}
      error={codeError}
    />
  );

  const codeActions = (
    <View style={styles.secondaryActions}>
      <Button
        variant="ghost"
        label={cooldown > 0 ? `Reenviar código em ${cooldown} s` : 'Reenviar código'}
        onPress={resendCode}
        disabled={busy || cooldown > 0}
      />
      <Button variant="ghost" label="Voltar" onPress={() => goTo({ kind: 'senha' })} disabled={busy} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          compact && styles.contentCompact,
          { paddingTop: insets.top + (compact ? space.lg : space.xxl), paddingBottom: insets.bottom + space.xxl },
        ]}>
        <View style={styles.hero}>
          <Monogram size={step.kind === 'senha' ? (compact ? 76 : 112) : compact ? 60 : 88} />
          <AppText variant="title" tone="goldHighlight" style={styles.brand}>EUROTREINO</AppText>
          <Meander />
          {step.kind === 'senha' && !compact ? (
            <View style={styles.motto}>
              <AppText variant="motto" style={styles.center}>Mens sana in corpore sano</AppText>
              <AppText variant="label" tone="muted" style={styles.center}>Mente sã em corpo são</AppText>
            </View>
          ) : null}
        </View>

        {step.kind === 'senha' ? (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Entrar</AppText>
              <AppText tone="secondary">Use o e-mail e a senha da sua conta.</AppText>
            </View>
            {info ? <Notice message={info} /> : null}
            {emailField}
            <PasswordField
              label="Senha"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(null);
              }}
              placeholder="Sua senha"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submitPassword}
              error={passwordError}
            />
            <Button label={busy ? 'Entrando…' : 'Entrar'} onPress={submitPassword} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            <View style={styles.secondaryActions}>
              <Button label="Esqueci minha senha" variant="ghost" onPress={() => router.push('/recuperar-senha')} disabled={busy} />
              <Button label="Criar conta" variant="secondary" icon="perfil" onPress={() => router.push('/criar-conta')} disabled={busy} />
            </View>

            {providers.isPending ? (
              <ActivityIndicator color={colors.gold} />
            ) : enabledProviders.length > 0 ? (
              <View style={styles.social}>
                <View style={styles.dividerRow}>
                  <Separator style={styles.divider} />
                  <AppText variant="caption" tone="muted">ou</AppText>
                  <Separator style={styles.divider} />
                </View>
                {enabledProviders.map((provider) => (
                  <Button
                    key={provider}
                    label={`Continuar com ${PROVIDER_LABELS[provider]}`}
                    variant="secondary"
                    onPress={() => continueWithProvider(provider)}
                    disabled={busy}
                  />
                ))}
              </View>
            ) : null}

            <Button label="Entrar com código por e-mail" icon="email" variant="ghost" onPress={() => goTo({ kind: 'email' })} disabled={busy} />
          </View>
        ) : step.kind === 'confirmar' ? (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Confirme seu e-mail</AppText>
              <AppText tone="secondary">{`Enviamos um código de ${OTP_LENGTH} dígitos para ${step.email}.`}</AppText>
            </View>
            {info ? <Notice message={info} /> : null}
            {codeField}
            <Button label={busy ? 'Confirmando…' : 'Confirmar e entrar'} onPress={submitConfirmation} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            {codeActions}
          </View>
        ) : step.kind === 'email' ? (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Entrar com código</AppText>
              <AppText tone="secondary">Receba um código no e-mail da sua conta, sem digitar a senha.</AppText>
            </View>
            {info ? <Notice message={info} /> : null}
            {emailField}
            <Button label={busy ? 'Enviando…' : 'Receber código'} onPress={submitEmail} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            <Button label="Voltar" variant="ghost" onPress={() => goTo({ kind: 'senha' })} disabled={busy} />
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Digite o código</AppText>
              <AppText tone="secondary">{`Enviamos um código de ${OTP_LENGTH} dígitos para ${step.email}.`}</AppText>
            </View>
            {info ? <Notice message={info} /> : null}
            {codeField}
            <Button label={busy ? 'Entrando…' : 'Entrar'} onPress={submitCode} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            {codeActions}
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
            {', e declara ter 16 anos ou mais.'}
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
    gap: space.xl,
  },
  contentCompact: {
    gap: space.md,
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
  social: {
    gap: space.md,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  divider: {
    flex: 1,
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
