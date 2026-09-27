import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemPicker } from '@/components/emblem-picker';
import { LegionBanner } from '@/components/legion/legion-banner';
import { BannerColorPicker, MinimumPicker, ModePicker } from '@/components/legion/legion-choices';
import { Reveal } from '@/components/motion/reveal';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { GROUP_NAME_MAX_LENGTH, isValidGroupName, normalizeGroupName } from '@/features/legions/group-name';
import { createLegion } from '@/features/legions/legions-api';
import type { LegionMode } from '@/features/legions/legions-parsers';
import type { EmblemColor, EmblemName } from '@/features/profile/emblems';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const NAME_RULE = "De 3 a 40 caracteres: letras, números, espaço e os sinais . ' - & !";

const nextMondayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/** Segunda-feira seguinte, quando a primeira temporada competitiva começa. */
function nextMonday(now = new Date()): Date {
  const date = new Date(now);
  const daysUntil = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + daysUntil);
  return date;
}

/** RF003: fundar Legião, com estandarte e modo (quadro 2.1). */
export default function NewLegionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [emblem, setEmblem] = useState<EmblemName>('leao');
  const [bannerColor, setBannerColor] = useState<EmblemColor>('porfiro');
  const [mode, setMode] = useState<LegionMode>('classica');
  const [minimum, setMinimum] = useState(3);
  const [touched, setTouched] = useState(false);

  const legionName = normalizeGroupName(name);
  const nameValid = isValidGroupName(legionName);

  const create = useMutation({
    mutationFn: () =>
      createLegion(legionName, { emblem, bannerColor, mode, weeklyMinimum: mode === 'competitiva' ? minimum : null }),
    onSuccess: (legion) => {
      queryClient.setQueryData(queryKeys.invite(legion.id), legion.invite);
      void queryClient.invalidateQueries({ queryKey: queryKeys.legions });
      router.replace({ pathname: '/legioes/[id]', params: { id: legion.id, nova: '1' } });
    },
  });

  function change(apply: () => void) {
    apply();
    create.reset();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
        <ScreenHeader title="Fundar Legião" subtitle="Você vira o fundador e recebe o código de convite" />

        <Reveal style={styles.preview}>
          <LegionBanner emblem={emblem} color={bannerColor} width={112} />
          <AppText variant="heading" style={styles.center} numberOfLines={2}>
            {nameValid ? legionName : 'Sua Legião'}
          </AppText>
          <AppText variant="caption" tone="muted">
            {mode === 'competitiva' ? `Prévia do estandarte · competitiva, mínimo de ${minimum}` : 'Prévia do estandarte'}
          </AppText>
        </Reveal>

        <TextField
          label="Nome da Legião"
          value={name}
          onChangeText={(text) => change(() => setName(text))}
          onBlur={() => setTouched(true)}
          placeholder="Ex.: Legião Fênix"
          autoCapitalize="words"
          maxLength={GROUP_NAME_MAX_LENGTH + 8}
          hint={NAME_RULE}
          error={touched && !nameValid ? NAME_RULE : null}
        />

        <EmblemPicker label="Emblema do estandarte" value={emblem} onChange={(value) => change(() => setEmblem(value))} />
        <BannerColorPicker value={bannerColor} onChange={(value) => change(() => setBannerColor(value))} />

        <View style={styles.group}>
          <AppText variant="label" tone="secondary">Modo da Legião</AppText>
          <ModePicker value={mode} onChange={(value) => change(() => setMode(value))} />
        </View>

        {mode === 'competitiva' ? (
          <Reveal style={styles.group}>
            <MinimumPicker value={minimum} onChange={(value) => change(() => setMinimum(value))} />
            <Notice
              message={`A primeira temporada começa na segunda, ${nextMondayFormat.format(nextMonday())}, para todo mundo largar junto. A Glória de ninguém cai: os Louros são só desta Legião.`}
            />
          </Reveal>
        ) : null}

        <Notice message="Legiões são fechadas e têm até 50 membros: só entra quem receber o código, e só os membros veem o Coliseu e os perfis." />

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
  preview: {
    alignItems: 'center',
    gap: space.xs,
  },
  center: {
    textAlign: 'center',
  },
  group: {
    gap: space.sm,
  },
  actions: {
    gap: space.md,
  },
});
