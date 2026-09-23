import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemPicker } from '@/components/emblem-picker';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { useSession } from '@/features/auth/session';
import { DISPLAY_NAME_MAX_LENGTH, isValidDisplayName, normalizeDisplayName } from '@/features/profile/display-name';
import { DEFAULT_EMBLEM_COLOR, type EmblemColor, type EmblemName } from '@/features/profile/emblems';
import { saveProfile } from '@/features/profile/profile-api';
import { queryKeys } from '@/lib/query-client';
import { RPC_MESSAGES } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const NAME_RULE = 'De 2 a 32 caracteres: letras, números, espaço, ponto, apóstrofo ou hífen.';

/** RF002: editar nome de exibição e emblema (o banco limita a 10 edições por dia). */
export default function EditProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, profileSaved, signOut } = useSession();
  const current = state.status === 'ready' ? state.profile : null;

  const [name, setName] = useState(current?.displayName ?? '');
  const [emblem, setEmblem] = useState<EmblemName>(current?.emblem ?? 'aguia');
  const [emblemColor, setEmblemColor] = useState<EmblemColor>(current?.emblemColor ?? DEFAULT_EMBLEM_COLOR);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!current) return null;

  const displayName = normalizeDisplayName(name);
  const nameValid = isValidDisplayName(displayName);
  const changed =
    displayName !== current.displayName || emblem !== current.emblem || emblemColor !== current.emblemColor;

  async function submit() {
    setTouched(true);
    if (!nameValid || !changed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await saveProfile(displayName, emblem, emblemColor);
      if (result.ok) {
        profileSaved(result.profile);
        // Nome e emblema aparecem no Coliseu e nos membros das Legiões.
        void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
        if (router.canGoBack()) router.back();
        else router.replace('/perfil');
      } else if (result.code === 'not_authenticated') {
        await signOut();
      } else {
        setError(result.message);
      }
    } catch {
      setError(RPC_MESSAGES.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <ScreenHeader title="Editar perfil" subtitle="Só as suas Legiões veem" />

        <TextField
          label="Nome de exibição"
          value={name}
          onChangeText={(text) => {
            setName(text);
            setError(null);
          }}
          onBlur={() => setTouched(true)}
          autoCapitalize="words"
          autoComplete="nickname"
          maxLength={DISPLAY_NAME_MAX_LENGTH + 8}
          returnKeyType="done"
          hint={NAME_RULE}
          error={touched && !nameValid ? NAME_RULE : null}
        />

        <EmblemPicker label="Emblema" value={emblem} onChange={setEmblem} color={emblemColor} onChangeColor={setEmblemColor} />

        <View style={styles.actions}>
          <Button label={busy ? 'Salvando…' : 'Salvar'} onPress={() => void submit()} disabled={busy || !changed} />
          {error ? <Notice tone="danger" message={error} /> : null}
          <Button label="Cancelar" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/perfil'))} disabled={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  actions: {
    gap: space.md,
  },
});
