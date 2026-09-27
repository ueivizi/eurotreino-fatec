import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemPicker } from '@/components/emblem-picker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { LinkRow } from '@/components/ui/link-row';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { StepProgress } from '@/components/ui/step-progress';
import { TextField } from '@/components/ui/text-field';
import { useSession } from '@/features/auth/session';
import { startFirstSteps } from '@/features/onboarding/first-steps';
import { DISPLAY_NAME_MAX_LENGTH, isValidDisplayName, normalizeDisplayName } from '@/features/profile/display-name';
import { DEFAULT_EMBLEM_COLOR, type EmblemColor, type EmblemName } from '@/features/profile/emblems';
import { saveProfile } from '@/features/profile/profile-api';
import { RPC_MESSAGES } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const NAME_RULE = 'Use de 2 a 32 caracteres: letras, números, espaço, ponto, apóstrofo ou hífen.';

/** Primeiro acesso (RF002): nome de exibição e emblema, sem foto. */
export default function InitialProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, profileSaved, signOut } = useSession();

  const [name, setName] = useState('');
  const [emblem, setEmblem] = useState<EmblemName>('aguia');
  const [emblemColor, setEmblemColor] = useState<EmblemColor>(DEFAULT_EMBLEM_COLOR);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = normalizeDisplayName(name);
  const nameValid = isValidDisplayName(displayName);

  async function submit() {
    setTouched(true);
    if (!nameValid) return;
    setBusy(true);
    setError(null);
    try {
      const result = await saveProfile(displayName, emblem, emblemColor);
      if (result.ok) {
        // Depois do perfil, o Início abre "Como conquistar Glória" e a escolha da Legião.
        startFirstSteps();
        profileSaved(result.profile);
      }
      else if (result.code === 'not_authenticated') await signOut();
      else setError(result.message);
    } catch {
      setError(RPC_MESSAGES.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxxl },
        ]}>
        <View style={styles.header}>
          <StepProgress step={1} total={3} />
          <AppText variant="title">Como sua Legião vai te chamar?</AppText>
          <AppText variant="motto" tone="gold">É assim que sua Legião vai te ver.</AppText>
        </View>

        {/* Primeiro acesso: antes de pedir qualquer coisa, o app diz o que não vai pedir. Era o
            aviso que faltava no teste de 20/09 -- existia, mas embaixo de tudo, como rodapé. */}
        <Card style={styles.privacy}>
          <View style={styles.privacyTitle}>
            <Icon name="escudo" size={18} color={colors.gold} />
            <AppText variant="bodyMedium">Antes de começar</AppText>
          </View>
          <AppText variant="label" tone="secondary">
            Não pedimos foto, peso, medidas nem localização. Seu nome e seu emblema aparecem só para
            quem está nas suas Legiões, e os detalhes dos seus treinos ficam só com você.
          </AppText>
          <LinkRow label="Política de Privacidade" icon="pergaminho" onPress={() => router.push('/privacidade')} />
        </Card>

        <TextField
          label="Nome de exibição"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          placeholder="Como seus amigos te chamam"
          autoCapitalize="words"
          autoComplete="nickname"
          maxLength={DISPLAY_NAME_MAX_LENGTH + 8}
          returnKeyType="done"
          hint={NAME_RULE}
          error={touched && !nameValid ? NAME_RULE : null}
        />

        <EmblemPicker
          label="Emblema (no lugar da foto)"
          value={emblem}
          onChange={setEmblem}
          color={emblemColor}
          onChangeColor={setEmblemColor}
        />

        <Notice message="Sem foto: seu emblema representa você no Coliseu." />

        <View style={styles.actions}>
          <Button label={busy ? 'Salvando…' : 'Continuar'} onPress={() => void submit()} disabled={busy} />
          {error ? <Notice tone="danger" message={error} /> : null}
          <Button
            variant="ghost"
            label={state.status === 'needs-profile' && state.email ? `Sair de ${state.email}` : 'Sair'}
            onPress={() => void signOut()}
            disabled={busy}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  privacy: {
    gap: space.sm,
  },
  privacyTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  header: {
    gap: space.xs,
  },
  actions: {
    gap: space.md,
  },
});
