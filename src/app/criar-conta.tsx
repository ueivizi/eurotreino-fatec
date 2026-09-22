import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { CodeField } from '@/components/ui/code-field';
import { Notice } from '@/components/ui/notice';
import { PasswordField } from '@/components/ui/password-field';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { AUTH_MESSAGES } from '@/features/auth/auth-errors';
import {
  EMAIL_MAX_LENGTH,
  OTP_LENGTH,
  PASSWORD_MESSAGES,
  PASSWORD_MIN_LENGTH,
  RESEND_COOLDOWN_SECONDS,
  isValidEmail,
  isValidOtp,
  normalizeEmail,
  normalizeOtp,
  passwordProblem,
} from '@/features/auth/credentials';
import { confirmSignUp, resendSignUpCode, signUpWithPassword } from '@/features/auth/password-auth';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/**
 * Criar conta (RF001): e-mail e senha, e o código do e-mail confirma o cadastro. A senha só existe
 * no estado desta tela e vai direto para o Supabase Auth, que faz o hash no servidor.
 *
 * O aviso depois do cadastro é o mesmo para e-mail novo e para e-mail já cadastrado: dizer a
 * diferença revelaria quem já usa o app.
 */
export default function SignUpScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [sent, setSent] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [code, setCode] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [repeatedError, setRepeatedError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
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

  function submit() {
    const target = normalizeEmail(email);
    if (!isValidEmail(target)) {
      setEmailError('Digite um e-mail válido, como voce@exemplo.com.');
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      setPasswordError(PASSWORD_MESSAGES[problem]);
      return;
    }
    if (password !== repeated) {
      setRepeatedError('As duas senhas precisam ser iguais.');
      return;
    }
    void run(async () => {
      const result = await signUpWithPassword(target, password);
      if (result.status === 'error') {
        setError(result.message);
        return;
      }
      // A senha já cumpriu seu papel: não fica mais no estado da tela.
      setPassword('');
      setRepeated('');
      if (result.status === 'needs-code') {
        setCode('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setSent(target);
      }
    });
  }

  function submitCode() {
    if (!sent) return;
    const token = normalizeOtp(code);
    if (!isValidOtp(token)) {
      setCodeError('O código tem só números. Confira o e-mail que enviamos.');
      return;
    }
    void run(async () => {
      // Com a conta confirmada, a sessão muda e o layout raiz leva ao perfil inicial.
      const result = await confirmSignUp(sent, token);
      if (result.status === 'error') setError(result.message);
    });
  }

  function resend() {
    if (!sent || cooldown > 0) return;
    void run(async () => {
      const result = await resendSignUpCode(sent);
      if (result.ok) {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setInfo('Enviamos um código novo. Confira também a caixa de spam.');
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <ScreenHeader title="Criar conta" subtitle="Comece sua jornada do Recruta ao Olimpo" />

        {sent ? (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Confirme seu e-mail</AppText>
              <AppText tone="secondary">
                {`Se este e-mail ainda não tiver conta, enviamos um código de ${OTP_LENGTH} dígitos para ${sent}.`}
              </AppText>
            </View>
            {info ? <Notice message={info} /> : null}
            {/* Sem isto a pessoa fica esperando um código que nunca vem: quando o e-mail já tem
                conta, o Supabase não envia nada (e não avisa, para não revelar quem é cadastrado). */}
            <Notice message="Não chegou nada? Pode ser que este e-mail já tenha conta — nesse caso não enviamos código. Entre com sua senha ou use “Esqueci minha senha”." />
            <CodeField
              label="Código"
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setCodeError(null);
              }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitCode}
              error={codeError}
            />
            <Button label={busy ? 'Confirmando…' : 'Confirmar e entrar'} onPress={submitCode} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            <View style={styles.secondaryActions}>
              <Button
                variant="ghost"
                label={cooldown > 0 ? `Reenviar código em ${cooldown} s` : 'Reenviar código'}
                onPress={resend}
                disabled={busy || cooldown > 0}
              />
              <Button variant="ghost" label="Esqueci minha senha" onPress={() => router.replace('/recuperar-senha')} disabled={busy} />
              <Button variant="ghost" label="Já tenho conta" onPress={() => router.replace('/entrar')} disabled={busy} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
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
            <PasswordField
              label="Senha"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(null);
              }}
              placeholder="Crie uma senha"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}
              error={passwordError}
            />
            <PasswordField
              label="Repita a senha"
              value={repeated}
              onChangeText={(text) => {
                setRepeated(text);
                setRepeatedError(null);
              }}
              placeholder="A mesma senha"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
              error={repeatedError}
            />
            <Button label={busy ? 'Criando…' : 'Criar conta'} onPress={submit} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            <AppText variant="caption" tone="muted" style={styles.center}>
              {'Ao criar a conta, você aceita os '}
              <AppText variant="caption" tone="gold" accessibilityRole="link" onPress={() => router.push('/termos')}>
                Termos de Uso
              </AppText>
              {' e a '}
              <AppText variant="caption" tone="gold" accessibilityRole="link" onPress={() => router.push('/privacidade')}>
                Política de Privacidade
              </AppText>
              {', e declara ter 16 anos ou mais.'}
            </AppText>
            <Button label="Já tenho conta" variant="ghost" onPress={() => router.replace('/entrar')} disabled={busy} />
          </View>
        )}
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
  form: {
    gap: space.lg,
  },
  intro: {
    gap: space.xs,
  },
  secondaryActions: {
    gap: space.xs,
  },
  center: {
    textAlign: 'center',
  },
});
