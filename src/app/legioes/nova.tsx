import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemPicker } from '@/components/emblem-picker';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { GROUP_NAME_MAX_LENGTH, isValidGroupName, normalizeGroupName } from '@/features/legions/group-name';
import { createLegion } from '@/features/legions/legions-api';
import type { EmblemName } from '@/features/profile/emblems';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const NAME_RULE = "De 3 a 40 caracteres: letras, números, espaço e os sinais . ' - & !";

/** RF003: fundar Legião. */
export default function NewLegionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [emblem, setEmblem] = useState<EmblemName>('leao');
  const [touched, setTouched] = useState(false);

  const legionName = normalizeGroupName(name);
  const nameValid = isValidGroupName(legionName);

  const create = useMutation({
    mutationFn: () => createLegion(legionName, emblem),
    onSuccess: (legion) => {
      queryClient.setQueryData(queryKeys.invite(legion.id), legion.invite);
      void queryClient.invalidateQueries({ queryKey: queryKeys.legions });
      router.replace({ pathname: '/legioes/[id]', params: { id: legion.id } });
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <ScreenHeader title="Fundar Legião" subtitle="Você vira o fundador e recebe o código de convite" />

        <TextField
          label="Nome da Legião"
          value={name}
          onChangeText={(text) => {
            setName(text);
            create.reset();
          }}
          onBlur={() => setTouched(true)}
          placeholder="Ex.: Legião Fênix"
          autoCapitalize="words"
          maxLength={GROUP_NAME_MAX_LENGTH + 8}
          hint={NAME_RULE}
          error={touched && !nameValid ? NAME_RULE : null}
        />

        <EmblemPicker label="Estandarte" value={emblem} onChange={setEmblem} />

        <Notice message="A Legião é fechada: só entra quem receber o código, e só os membros veem a Arena e os perfis." />

        <View style={styles.actions}>
          <Button
            label={create.isPending ? 'Fundando…' : 'Fundar Legião'}
            onPress={() => {
              setTouched(true);
              if (nameValid) create.mutate();
            }}
            disabled={create.isPending}
          />
          {create.isError ? <Notice tone="danger" message={errorMessage(create.error)} /> : null}
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
