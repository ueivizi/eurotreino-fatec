import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { useProfile } from '@/features/auth/session';
import { rankFromGlory } from '@/features/ranks/tiers';
import { CAPTURE_FEEDBACK, shareViewAsImage, type CaptureOutcome } from '@/features/share/capture';
import { shareLayout } from '@/features/share/layouts';
import { CARD_RATIO, ShareCard } from '@/features/share/share-card';
import { fetchHistoryWorkouts, type HistoryWorkout } from '@/features/workouts/history-api';
import { fetchMyProgress } from '@/features/workouts/workouts-api';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/** Primeiro dia do mês corrente, no relógio do aparelho (igual aos Anais). */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * Compartilhar o treino como imagem (P5/P6).
 *
 * Dois modos, no mesmo cartão: só o treino, sobre o fundo Ônix, ou o treino sobre uma foto da
 * própria pessoa. **A foto não sai do aparelho**: ela é escolhida aqui, desenhada aqui e a imagem
 * final vai direto para a folha de partilha do sistema. Nada disso passa pelo servidor.
 */
function ShareComposer({ workout }: { workout: HistoryWorkout }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const profile = useProfile();
  const card = useRef<View>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CaptureOutcome | null>(null);
  const [working, setWorking] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const progress = useQuery({ queryKey: queryKeys.progress, queryFn: fetchMyProgress });
  const rank = rankFromGlory(progress.data?.totalGlory ?? 0);

  // O cartão é desenhado no tamanho que couber na tela; a imagem sai sempre em 1080 × 1920.
  const available = Math.min(width - space.xl * 2, 320);
  const cardWidth = Math.round(Math.min(available, 520 / CARD_RATIO));

  async function pick(from: 'camera' | 'galeria') {
    setPermissionDenied(false);
    const permission =
      from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      // O recorte já vem na proporção do cartão: assim ninguém perde a cabeça no enquadramento.
      aspect: [9, 16],
      quality: 0.9,
    };
    const result = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const uri = result.canceled ? null : (result.assets[0]?.uri ?? null);
    if (uri) setPhotoUri(uri);
  }

  async function share() {
    setWorking(true);
    setOutcome(await shareViewAsImage(card));
    setWorking(false);
  }

  const layout = shareLayout({
    type: workout.type,
    durationMin: workout.durationMin,
    intensity: workout.intensity,
    distanceM: workout.distanceM,
    setsCount: workout.setsCount,
    loadKg: workout.loadKg,
    points: workout.points,
    isScored: workout.isScored,
    note: workout.note,
    performedAt: workout.performedAt,
  });

  return (
    <>
      <View style={styles.preview}>
        <ShareCard
          ref={card}
          layout={layout}
          displayName={profile?.displayName ?? 'Atleta'}
          rankLabel={rank.label}
          photoUri={photoUri}
          width={cardWidth}
        />
      </View>

      <View style={styles.photoRow}>
        {Platform.OS === 'web' ? null : (
          <View style={styles.flex}>
            <Button label="Tirar foto" icon="camera" variant="secondary" onPress={() => void pick('camera')} />
          </View>
        )}
        <View style={styles.flex}>
          <Button label={photoUri ? 'Trocar foto' : 'Escolher foto'} icon="imagem" variant="secondary" onPress={() => void pick('galeria')} />
        </View>
      </View>
      {photoUri ? <Button label="Tirar a foto do cartão" variant="ghost" onPress={() => setPhotoUri(null)} /> : null}
      {permissionDenied ? (
        <Notice message="Sem essa permissão não dá para pegar a foto. Você pode liberar nos ajustes do aparelho — ou compartilhar sem foto mesmo." />
      ) : null}

      <Button
        label={working ? 'Gerando imagem…' : 'Compartilhar imagem'}
        icon="compartilhar"
        onPress={() => void share()}
        disabled={working}
      />
      {outcome && CAPTURE_FEEDBACK[outcome] ? (
        <Notice tone={outcome === 'failed' ? 'danger' : 'info'} message={CAPTURE_FEEDBACK[outcome]} />
      ) : null}

      <View style={styles.note}>
        <Icon name="cadeado" size={18} color={colors.gold} />
        <AppText variant="caption" tone="muted" style={styles.flex}>
          A imagem é montada neste aparelho e a foto não é enviada para lugar nenhum. O cartão mostra
          só o seu treino: nada da sua Legião, nem de quem treina com você.
        </AppText>
      </View>
    </>
  );
}

export default function ShareWorkoutScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; mes?: string }>();
  const month = typeof params.mes === 'string' && /^\d{4}-\d{2}-01$/.test(params.mes) ? params.mes : currentMonth();

  const workouts = useQuery({ queryKey: queryKeys.history(month), queryFn: () => fetchHistoryWorkouts(month) });
  const workout = workouts.data?.find((item) => item.id === params.id) ?? null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Compartilhar treino" subtitle="Com ou sem foto sua" fallbackHref="/anais" />

      {workouts.isPending ? (
        <ActivityIndicator color={colors.gold} style={styles.loading} />
      ) : workouts.isError ? (
        <View style={styles.block}>
          <Notice tone="danger" message={errorMessage(workouts.error)} />
          <Button label="Tentar de novo" variant="secondary" onPress={() => void workouts.refetch()} />
        </View>
      ) : !workout ? (
        <Notice message="Este treino não está mais neste mês. Volte aos Anais e escolha de novo." />
      ) : (
        <ShareComposer key={workout.id} workout={workout} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  preview: {
    alignItems: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    gap: space.md,
  },
  block: {
    gap: space.md,
  },
  note: {
    flexDirection: 'row',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
  loading: {
    marginTop: space.xl,
  },
});
