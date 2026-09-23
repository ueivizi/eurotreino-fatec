import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { useProfile } from '@/features/auth/session';
import { enqueueCelebrations } from '@/features/celebrations/celebration-store';
import { celebrationsForWorkout } from '@/features/celebrations/detect';
import {
  BRAND_INFO,
  DEVICE_BRANDS,
  DEVICE_BRAND_STORAGE_KEY,
  DEVICE_ORIGIN_STORAGE_KEY,
  IOS_PENDING_MESSAGE,
  isDeviceBrand,
  type DeviceBrand,
} from '@/features/devices/brands';
import { pickGpxWorkout } from '@/features/devices/gpx-import';
import { healthConnect } from '@/features/devices/health-connect';
import { HEALTH_CONNECT_STATUS_MESSAGES } from '@/features/devices/health-connect-types';
import {
  ELIGIBILITY_MESSAGES,
  durationMinutesOf,
  importEligibility,
  importRequestId,
  likelyDuplicate,
  toWorkoutInput,
  type ImportedWorkout,
} from '@/features/devices/imported-workout';
import { originsFound, type OriginFound } from '@/features/devices/origins';
import { fetchRecentWorkouts } from '@/features/devices/recent-workouts-api';
import { formatDistance } from '@/features/workouts/metrics';
import { LATE_LOG_WINDOW_MS, describePerformedAt } from '@/features/workouts/performed-at';
import { INTENSITIES, WORKOUT_TYPES, workoutModule, type IntensityId, type WorkoutTypeId } from '@/features/workouts/workout-types';
import { fetchMyProgress, logWorkout } from '@/features/workouts/workouts-api';
import { deviceStorage } from '@/lib/device-storage';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

const DEVICE_QUERY = ['dispositivos'] as const;

function BrandOption({ brand, selected, onPress }: { brand: DeviceBrand; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={BRAND_INFO[brand].label}
      onPress={onPress}
      style={[
        styles.brand,
        { borderColor: selected ? colors.gold : colors.hairline, backgroundColor: selected ? colors.selectedFill : colors.surface },
      ]}>
      <Icon name="relogio" size={20} color={selected ? colors.gold : colors.textSecondary} />
      <View style={styles.flex}>
        <AppText variant="bodyMedium">{BRAND_INFO[brand].label}</AppText>
        <AppText variant="caption" tone="muted">App {BRAND_INFO[brand].companionApp}</AppText>
      </View>
      {selected ? <Icon name="check" size={18} color={colors.gold} /> : null}
    </Pressable>
  );
}

/** Uma permissão do Health Connect, lida ou não. */
function PermissionRow({ label, granted, note }: { label: string; granted: boolean; note?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityLabel={`${label}: ${granted ? 'lido' : 'não lido'}`}>
      <Icon name={granted ? 'check' : 'fechar'} size={16} color={granted ? colors.success : colors.textMuted} />
      <AppText variant="label" tone={granted ? 'secondary' : 'muted'} style={styles.flex}>
        {note ? `${label} · ${note}` : label}
      </AppText>
    </View>
  );
}

function TypeChip({ id, selected, onPress }: { id: WorkoutTypeId; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const type = WORKOUT_TYPES.find((item) => item.id === id);
  if (!type) return null;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={type.label}
      onPress={onPress}
      style={[styles.chip, { borderColor: selected ? colors.gold : colors.hairlineSoft, backgroundColor: selected ? colors.selectedFill : 'transparent' }]}>
      <Icon name={type.icon} size={16} color={selected ? colors.gold : colors.textSecondary} />
      <AppText variant="label" tone={selected ? 'primary' : 'secondary'}>{type.label}</AppText>
    </Pressable>
  );
}

/** Um treino vindo de fora: a pessoa confere tipo e intensidade antes de virar registro. */
function ImportCard({ workout, healthConsent }: { workout: ImportedWorkout; healthConsent: boolean }) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [now] = useState(() => new Date());
  const [type, setType] = useState<WorkoutTypeId>(workout.suggestedType ?? 'outro');
  const [intensity, setIntensity] = useState<IntensityId>('moderado');
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const eligibility = importEligibility(workout, now);

  const recent = useQuery({
    queryKey: [...DEVICE_QUERY, 'recentes'],
    queryFn: () => fetchRecentWorkouts(new Date(Date.now() - LATE_LOG_WINDOW_MS - 3 * 3600_000)),
    enabled: eligibility === 'ok',
  });
  const duplicate = recent.data ? likelyDuplicate(workout, type, recent.data) : false;

  const save = useMutation({
    mutationFn: async () => {
      const previous = queryClient.getQueryData<Awaited<ReturnType<typeof fetchMyProgress>>>(queryKeys.progress);
      const requestId = await importRequestId(workout);
      const logged = await logWorkout(toWorkoutInput(workout, { type, intensity, requestId, healthConsent }));
      return { logged, previousTotalWorkouts: previous?.totalWorkouts ?? null };
    },
    onSuccess: ({ logged, previousTotalWorkouts }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rankings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.records });
      void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyGoal });
      void queryClient.invalidateQueries({ queryKey: queryKeys.historyAll });
      void queryClient.invalidateQueries({ queryKey: [...DEVICE_QUERY, 'recentes'] });
      enqueueCelebrations(celebrationsForWorkout({ result: logged, previousTotalWorkouts, arenas: [] }));
    },
  });

  const minutes = durationMinutesOf(workout);
  const details = [
    `${minutes} min`,
    workout.distanceM !== null && workoutModule(type) === 'resistencia' ? formatDistance(workout.distanceM) : null,
    healthConsent && workout.avgHeartRate !== null ? `${Math.round(workout.avgHeartRate)} bpm de média` : null,
  ].filter(Boolean);

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Icon name={WORKOUT_TYPES.find((item) => item.id === type)?.icon ?? 'outro'} size={22} color={colors.gold} />
        <View style={styles.flex}>
          <AppText variant="bodyMedium">{describePerformedAt(workout.startedAt, now)}</AppText>
          <AppText variant="caption" tone="muted">{details.join(' · ')}</AppText>
        </View>
      </View>

      {eligibility !== 'ok' ? (
        <AppText variant="caption" tone="muted">{ELIGIBILITY_MESSAGES[eligibility]}</AppText>
      ) : save.isSuccess ? (
        <Notice
          message={
            save.data.logged.replayed
              ? 'Esse treino já estava registrado. Nada mudou na sua Glória.'
              : save.data.logged.isScored
                ? `Registrado: +${save.data.logged.points} de Glória.`
                : 'Registrado. Passou do limite de 2 treinos pontuados no dia, então não rendeu Glória.'
          }
        />
      ) : (
        <>
          <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Tipo de treino">
            {WORKOUT_TYPES.map((item) => (
              <TypeChip key={item.id} id={item.id} selected={type === item.id} onPress={() => setType(item.id)} />
            ))}
          </View>
          <SegmentedControl options={INTENSITIES} value={intensity} onChange={setIntensity} accessibilityLabel="Intensidade" />
          {duplicate && !confirmDuplicate ? (
            <>
              <Notice message="Já existe um treino desse tipo registrado perto desse horário. Se for o mesmo, não registre de novo: contaria duas vezes." />
              <Button label="É outro treino, registrar" variant="secondary" onPress={() => setConfirmDuplicate(true)} />
            </>
          ) : (
            <Button
              label={save.isPending ? 'Registrando…' : 'Registrar treino'}
              icon="check"
              onPress={() => save.mutate()}
              disabled={save.isPending || recent.isPending}
            />
          )}
          {save.isError ? <Notice tone="danger" message={errorMessage(save.error)} /> : null}
        </>
      )}
    </Card>
  );
}

/** Relógios: escolha da marca, conexão com o Health Connect e importação de treinos e de arquivo GPX. */
export default function DevicesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useProfile();
  const healthConsent = profile?.healthConsentAt !== null && profile?.healthConsentAt !== undefined;
  const [manualBrand, setManualBrand] = useState<DeviceBrand | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [showBrands, setShowBrands] = useState(false);
  const [showWorkouts, setShowWorkouts] = useState(false);
  const [files, setFiles] = useState<ImportedWorkout[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    deviceStorage
      .getItem(DEVICE_BRAND_STORAGE_KEY)
      .then((value) => setManualBrand(isDeviceBrand(value) ? value : null))
      .catch(() => setManualBrand(null));
    deviceStorage
      .getItem(DEVICE_ORIGIN_STORAGE_KEY)
      .then((value) => setChosenId(typeof value === 'string' && value !== '' ? value : null))
      .catch(() => setChosenId(null));
  }, []);

  function chooseDevice(origin: OriginFound) {
    setChosenId(origin.id);
    setShowBrands(false);
    deviceStorage.setItem(DEVICE_ORIGIN_STORAGE_KEY, origin.id).catch(() => undefined);
  }

  function chooseBrand(next: DeviceBrand) {
    setManualBrand(next);
    setShowBrands(false);
    // Preferência deste aparelho; sem conseguir guardar, vale nesta abertura do app.
    deviceStorage.setItem(DEVICE_BRAND_STORAGE_KEY, next).catch(() => undefined);
  }

  const status = useQuery({ queryKey: [...DEVICE_QUERY, 'status'], queryFn: healthConnect.status });
  const available = status.data === 'available';
  const grant = useQuery({ queryKey: [...DEVICE_QUERY, 'permissoes'], queryFn: healthConnect.granted, enabled: available });
  const workouts = useQuery({
    queryKey: [...DEVICE_QUERY, 'treinos', healthConsent],
    queryFn: () => healthConnect.readWorkouts({ since: new Date(Date.now() - LATE_LOG_WINDOW_MS), until: new Date(), heartRate: healthConsent }),
    enabled: available && grant.data?.exercise === true,
  });
  const connect = useMutation({
    mutationFn: () => healthConnect.connect({ heartRate: healthConsent }),
    onSuccess: () => {
      void grant.refetch();
      void workouts.refetch();
    },
  });
  const pick = useMutation({
    mutationFn: pickGpxWorkout,
    onSuccess: (result) => {
      if (result.kind === 'error') setFileError(result.message);
      if (result.kind === 'ok') {
        setFileError(null);
        setFiles((list) => [result.workout, ...list.filter((item) => item.sourceId !== result.workout.sourceId)]);
      }
    },
  });

  /*
   * O aparelho vem dos treinos lidos, não de uma lista de marcas: é o app que gravou o treino que
   * diz qual relógio é. Um celular costuma ter mais de um app escrevendo no Health Connect, então
   * a tela mostra todos os encontrados e a pessoa aponta o dela -- essa escolha fica guardada e
   * manda, inclusive na hora de filtrar os treinos que aparecem para importar.
   */
  const found = originsFound(workouts.data ?? []);
  const recognized = found.find((item) => item.id === chosenId) ?? found[0] ?? null;
  const importable = (workouts.data ?? []).filter((item) => !recognized || item.origin === recognized.id);
  const brand = recognized?.brand ?? manualBrand;
  const info = brand ? BRAND_INFO[brand] : null;
  const platform = Platform.OS === 'android' ? 'android' : Platform.OS === 'ios' ? 'ios' : null;
  const steps = info && platform ? info.setup[platform] : null;
  const unsupported = info && platform ? info.unsupported?.[platform] : undefined;
  const connected = available && grant.data?.exercise === true;
  // A lista de marcas serve para instalar e para nomear aparelho desconhecido: fica atrás do botão.
  const brandsOpen = showBrands || (!recognized && !manualBrand);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Relógios" subtitle="Traga os treinos do seu relógio" />

      {recognized ? (
        <View style={styles.block}>
          <AppText variant="overline" tone="muted">Seu relógio</AppText>
          <Card style={styles.card}>
            <View style={styles.row}>
              <Icon name="relogio" size={22} color={colors.gold} />
              <View style={styles.flex}>
                <AppText variant="subheading">
                  {recognized.brand ? BRAND_INFO[recognized.brand].label : recognized.appLabel}
                </AppText>
                <AppText variant="caption" tone="muted">
                  {recognized.brand
                    ? `Reconhecido pelo ${recognized.appLabel}, via Health Connect`
                    : 'Foi este app que gravou o treino, via Health Connect'}
                </AppText>
              </View>
              {connected ? (
                <View style={styles.state}>
                  <Icon name="check" size={16} color={colors.success} />
                  <AppText variant="label" tone="success">Conectado</AppText>
                </View>
              ) : null}
            </View>

            <AppText variant="caption" tone="muted">
              {`Última leitura: ${describePerformedAt(new Date(workouts.dataUpdatedAt), new Date())} · ${
                recognized.count === 1 ? '1 treino deste aparelho' : `${recognized.count} treinos deste aparelho`
              }`}
            </AppText>

            <View style={styles.permissions}>
              <PermissionRow label="Exercícios" granted={grant.data?.exercise === true} />
              <PermissionRow label="Distância" granted={grant.data?.distance === true} />
              <PermissionRow
                label="Frequência cardíaca"
                granted={grant.data?.heartRate === true}
                note={healthConsent ? undefined : 'desligada no Perfil'}
              />
              {/* O trajeto existe no Health Connect, mas o app não pede: mapa de rota é outra história. */}
              <PermissionRow label="Trajeto" granted={false} note="não lido" />
            </View>

            {!recognized.known ? (
              <Notice
                message={`Este treino veio do app ${recognized.id}, que não está na nossa lista de relógios. Se for o seu, escolha a marca em "Trocar de relógio" para ver os passos certos.`}
              />
            ) : null}

            <Button
              label={workouts.isFetching ? 'Buscando…' : 'Buscar treinos'}
              icon="repetir"
              onPress={() => void workouts.refetch()}
              disabled={workouts.isFetching}
            />
            {importable.length > 0 ? (
              <Button
                label={showWorkouts ? 'Esconder treinos' : `Ver ${importable.length === 1 ? 'o treino' : `os ${importable.length} treinos`}`}
                icon={showWorkouts ? 'chevronDown' : 'chevronRight'}
                variant="secondary"
                onPress={() => setShowWorkouts((open) => !open)}
              />
            ) : null}
            <Button
              label={found.length > 1 ? `Trocar de relógio (${found.length} encontrados)` : 'Trocar de relógio'}
              variant="secondary"
              onPress={() => setShowBrands((open) => !open)}
            />
            <Button label="Abrir o Health Connect" variant="ghost" onPress={healthConnect.openSettings} />
            <AppText variant="caption" tone="muted">
              Desconectar é retirar a permissão no Health Connect: o app avisa e para de ler na hora.
            </AppText>
          </Card>
        </View>
      ) : null}

      {brandsOpen && found.length > 0 ? (
        <View style={styles.block} accessibilityRole="radiogroup" accessibilityLabel="Aparelho que gravou os treinos">
          <AppText variant="overline" tone="muted">Aparelhos encontrados</AppText>
          <AppText variant="caption" tone="muted">
            Estes apps gravaram treino no Health Connect nas últimas 48 horas. Aponte o seu: os outros
            somem da lista de importação.
          </AppText>
          {found.map((item) => {
            const selected = item.id === recognized?.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={item.brand ? BRAND_INFO[item.brand].label : item.appLabel}
                onPress={() => chooseDevice(item)}
                style={[
                  styles.brand,
                  { borderColor: selected ? colors.gold : colors.hairline, backgroundColor: selected ? colors.selectedFill : colors.surface },
                ]}>
                <Icon name="relogio" size={20} color={selected ? colors.gold : colors.textSecondary} />
                <View style={styles.flex}>
                  <AppText variant="bodyMedium">{item.brand ? BRAND_INFO[item.brand].label : item.appLabel}</AppText>
                  <AppText variant="caption" tone="muted">
                    {`${item.brand ? `App ${item.appLabel}` : item.known ? 'App' : 'App desconhecido'} · ${
                      item.count === 1 ? '1 treino' : `${item.count} treinos`
                    } · ${describePerformedAt(item.lastAt, new Date())}`}
                  </AppText>
                </View>
                {selected ? <Icon name="check" size={18} color={colors.gold} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {brandsOpen ? (
        <View style={styles.block} accessibilityRole="radiogroup" accessibilityLabel="Marca do relógio">
          <AppText variant="overline" tone="muted">{found.length > 0 ? 'Outras marcas' : 'Sua marca'}</AppText>
          {DEVICE_BRANDS.map((item) => (
            <BrandOption key={item} brand={item} selected={brand === item} onPress={() => chooseBrand(item)} />
          ))}
        </View>
      ) : null}

      {info && (brandsOpen || !recognized) ? (
        <View style={styles.block}>
          <AppText variant="overline" tone="muted">Como ligar</AppText>
          {unsupported ? <Notice message={unsupported} /> : null}
          {platform === 'ios' && !unsupported ? <Notice message={IOS_PENDING_MESSAGE} /> : null}
          {platform === null ? <Notice message="No navegador não há leitura do relógio. Importe o arquivo GPX exportado pelo app da marca." /> : null}
          {steps ? (
            <Card style={styles.card}>
              <AppText variant="label" tone="secondary">
                O relógio envia os treinos para o {info.companionApp}, que os grava no Health Connect. O EuroTreino lê de lá.
              </AppText>
              {steps.map((step, index) => (
                <View key={step} style={styles.row}>
                  <AppText variant="label" tone="gold" style={styles.stepNumber}>{index + 1}</AppText>
                  <AppText variant="label" style={styles.flex}>{step}</AppText>
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      {platform === 'android' && info && !unsupported && !recognized ? (
        <View style={styles.block}>
          <AppText variant="overline" tone="muted">Health Connect</AppText>
          {status.isPending ? (
            <ActivityIndicator color={colors.gold} />
          ) : status.data && status.data !== 'available' ? (
            <Notice message={HEALTH_CONNECT_STATUS_MESSAGES[status.data]} />
          ) : (
            <>
              <AppText variant="label" tone="secondary">
                {grant.data?.exercise
                  ? `Conectado: exercícios${grant.data.distance ? ', distância' : ''}${grant.data.heartRate ? ' e frequência cardíaca' : ''}.`
                  : 'Ainda não conectado. O EuroTreino só lê; nada é gravado no Health Connect.'}
              </AppText>
              {!healthConsent ? (
                <AppText variant="caption" tone="muted">
                  A frequência cardíaca só é lida com o registro ligado em Perfil › Privacidade.
                </AppText>
              ) : null}
              <Button
                label={connect.isPending ? 'Abrindo…' : grant.data?.exercise ? 'Revisar permissões' : 'Conectar ao Health Connect'}
                icon="relogio"
                variant={grant.data?.exercise ? 'secondary' : 'primary'}
                onPress={() => connect.mutate()}
                disabled={connect.isPending}
              />
              {grant.data?.exercise ? (
                <Button label="Abrir o Health Connect" variant="ghost" onPress={healthConnect.openSettings} />
              ) : null}
              {connect.isError ? <Notice tone="danger" message="Não foi possível abrir o Health Connect. Tente de novo." /> : null}
            </>
          )}
        </View>
      ) : null}

      {available && grant.data?.exercise && (showWorkouts || !recognized) ? (
        <View style={styles.block}>
          <AppText variant="overline" tone="muted">Treinos das últimas 48 horas</AppText>
          {workouts.isPending ? (
            <ActivityIndicator color={colors.gold} />
          ) : workouts.isError ? (
            <>
              <Notice tone="danger" message="Não foi possível ler o Health Connect agora." />
              <Button label="Tentar de novo" variant="secondary" onPress={() => void workouts.refetch()} />
            </>
          ) : importable.length === 0 ? (
            <Notice message={`Nenhum treino nas últimas 48 horas. Confira se o ${info?.companionApp ?? 'app do relógio'} já sincronizou.`} />
          ) : (
            importable.map((item) => <ImportCard key={item.sourceId} workout={item} healthConsent={healthConsent} />)
          )}
          {/* Com o relógio reconhecido, quem busca de novo é o botão do cartão. */}
          {recognized ? null : <Button label="Atualizar lista" variant="ghost" onPress={() => void workouts.refetch()} />}
        </View>
      ) : null}

      <View style={styles.block}>
        <AppText variant="overline" tone="muted">Arquivo GPX</AppText>
        <AppText variant="label" tone="secondary">
          Exporte o treino em GPX no app do relógio (Garmin Connect, Zepp, Strava) e escolha o arquivo aqui.
        </AppText>
        <Button label={pick.isPending ? 'Abrindo…' : 'Importar arquivo GPX'} icon="nuvem" variant="secondary" onPress={() => pick.mutate()} disabled={pick.isPending} />
        {fileError ? <Notice tone="danger" message={fileError} /> : null}
        {pick.isError ? <Notice tone="danger" message="Não foi possível abrir o arquivo." /> : null}
        {files.map((item) => (
          <ImportCard key={item.sourceId} workout={item} healthConsent={healthConsent} />
        ))}
      </View>

      <AppText variant="caption" tone="muted">
        O trajeto não sai do aparelho. Do relógio, só vão para o servidor horário, duração, distância e, com seu
        consentimento, a frequência cardíaca. A Glória segue a mesma regra de qualquer treino.
      </AppText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  block: {
    gap: space.md,
  },
  card: {
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  flex: {
    flex: 1,
  },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  permissions: {
    gap: space.sm,
  },
  brand: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.full,
  },
  stepNumber: {
    width: 20,
    textAlign: 'center',
  },
});
