import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
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
import { confirmPasswordReset, requestPasswordReset } from '@/features/auth/password-auth';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/**
 * Trocar a senha esquecida (RF001). O código do e-mail é a prova de que a caixa é sua: sem ele não
 * há sessão de recuperação e a senha nova não é gravada. A resposta ao pedido é sempre a mesma,
 * exista ou não conta com aquele e-mail.
 */
export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [sent, setSent] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
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

  function request(target: string, again = false) {
    void run(async () => {
      const result = await requestPasswordReset(target);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setSent(target);
      if (again) setInfo('Enviamos um código novo. Confira também a caixa de spam.');
    });
  }

  function submitEmail() {
    const target = normalizeEmail(email);
    if (!isValidEmail(target)) {
      setEmailError('Digite um e-mail válido, como voce@exemplo.com.');
      return;
    }
    setCode('');
    setPassword('');
    request(target);
  }

  function submitNewPassword() {
    if (!sent) return;
    const token = normalizeOtp(code);
    if (!isValidOtp(token)) {
      setCodeError('O código tem só números. Confira o e-mail que enviamos.');
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      setPasswordError(PASSWORD_MESSAGES[problem]);
      return;
    }
    void run(async () => {
      const result = await confirmPasswordReset(sent, token, password);
      // Com a troca feita, a sessão muda e o layout raiz leva à próxima tela.
      setPassword('');
      if (result.status === 'error') setError(result.message);
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <ScreenHeader title="Esqueci minha senha" subtitle="Troque a senha com um código do e-mail" />

        {sent ? (
          <View style={styles.form}>
            <View style={styles.intro}>
              <AppText variant="heading">Escolha a senha nova</AppText>
              <AppText tone="secondary">
                {`Se houver conta com este e-mail, enviamos um código de ${OTP_LENGTH} dígitos para ${sent}.`}
              </AppText>
            </View>
            {info ? <Notice message={info} /> : null}
            <TextField
              label="Código"
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setCodeError(null);
              }}
              placeholder={'0'.repeat(OTP_LENGTH)}
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={12}
              autoFocus
              returnKeyType="next"
              error={codeError}
            />
            <PasswordField
              label="Senha nova"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError(null);
              }}
              placeholder="Crie uma senha"
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submitNewPassword}
              hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}
              error={passwordError}
            />
            <Button label={busy ? 'Trocando…' : 'Trocar senha e entrar'} onPress={submitNewPassword} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            <View style={styles.secondaryActions}>
              <Button
                variant="ghost"
                label={cooldown > 0 ? `Reenviar código em ${cooldown} s` : 'Reenviar código'}
                onPress={() => (cooldown > 0 ? undefined : request(sent, true))}
                disabled={busy || cooldown > 0}
              />
              <Button variant="ghost" label="Voltar para a entrada" onPress={() => router.replace('/entrar')} disabled={busy} />
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <AppText tone="secondary">
              Digite o e-mail da sua conta. Enviamos um código para você escolher uma senha nova.
            </AppText>
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
              returnKeyType="send"
              onSubmitEditing={submitEmail}
              error={emailError}
            />
            <Button label={busy ? 'Enviando…' : 'Enviar código'} onPress={submitEmail} disabled={busy} />
            {error ? <Notice tone="danger" message={error} /> : null}
            <Button label="Voltar para a entrada" variant="ghost" onPress={() => router.replace('/entrar')} disabled={busy} />
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
});
