import Constants, { ExecutionEnvironment } from 'expo-constants';

import { isRow } from '@/lib/parse';

import { workoutTypeFromHealthConnect } from './activity-map';
import { NO_GRANT, type HealthConnectApi, type HealthConnectGrant, type HealthConnectStatus } from './health-connect-types';
import type { ImportedWorkout } from './imported-workout';

/**
 * Leitura do Health Connect (Android). Garmin Connect, Zepp e Samsung Health gravam os treinos do
 * relógio lá; o EuroTreino só lê, com a permissão que a pessoa der, e nunca grava nada no Health Connect.
 *
 * O módulo nativo é carregado sob demanda: no Expo Go ele não existe, e importar no topo derrubaria o app.
 */

type HealthConnectModule = typeof import('react-native-health-connect');

const MAX_PAGES = 5;
const MAX_WORKOUTS = 50;

let loaded: Promise<HealthConnectModule | null> | null = null;

function load(): Promise<HealthConnectModule | null> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return Promise.resolve(null);
  loaded ??= import('react-native-health-connect').then(
    (module) => module,
    () => null,
  );
  return loaded;
}

async function ready(): Promise<HealthConnectModule> {
  const module = await load();
  if (!module) throw new Error('health_connect_unavailable');
  if (!(await module.initialize())) throw new Error('health_connect_unavailable');
  return module;
}

function grantFrom(list: unknown): HealthConnectGrant {
  if (!Array.isArray(list)) return NO_GRANT;
  const reads = new Set(
    list.filter((item) => isRow(item) && item.accessType === 'read' && typeof item.recordType === 'string').map((item) => (item as { recordType: string }).recordType),
  );
  return { exercise: reads.has('ExerciseSession'), distance: reads.has('Distance'), heartRate: reads.has('HeartRate') };
}

function isoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
}

function shortText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Sessão crua do Health Connect → treino normalizado; qualquer campo fora do formato descarta a sessão. */
export function parseHealthConnectSession(record: unknown): Omit<ImportedWorkout, 'distanceM' | 'avgHeartRate' | 'maxHeartRate'> | null {
  if (!isRow(record)) return null;
  const metadata = isRow(record.metadata) ? record.metadata : null;
  const sourceId = shortText(metadata?.id, 128);
  const startedAt = isoDate(record.startTime);
  const endedAt = isoDate(record.endTime);
  if (!sourceId || !startedAt || !endedAt || endedAt.getTime() <= startedAt.getTime()) return null;
  return {
    source: 'health-connect',
    sourceId,
    origin: shortText(metadata?.dataOrigin, 200),
    suggestedType: workoutTypeFromHealthConnect(record.exerciseType),
    startedAt,
    endedAt,
  };
}

async function readStatus(): Promise<HealthConnectStatus> {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  const module = await load();
  if (!module) return 'expo-go';
  try {
    const status = await module.getSdkStatus();
    if (status === module.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === module.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update-required';
    return 'not-installed';
  } catch {
    return 'not-installed';
  }
}

export const healthConnect: HealthConnectApi = {
  status: readStatus,

  connect: async ({ heartRate }) => {
    const module = await ready();
    const granted = await module.requestPermission([
      { accessType: 'read', recordType: 'ExerciseSession' },
      { accessType: 'read', recordType: 'Distance' },
      // Frequência cardíaca é dado sensível: só é pedida depois do consentimento dado no perfil.
      ...(heartRate ? [{ accessType: 'read' as const, recordType: 'HeartRate' as const }] : []),
    ]);
    return grantFrom(granted);
  },

  granted: async () => {
    if ((await readStatus()) !== 'available') return NO_GRANT;
    const module = await ready();
    return grantFrom(await module.getGrantedPermissions());
  },

  readWorkouts: async ({ since, until, heartRate }) => {
    const module = await ready();
    const grant = grantFrom(await module.getGrantedPermissions());
    if (!grant.exercise) return [];

    const sessions: NonNullable<ReturnType<typeof parseHealthConnectSession>>[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < MAX_PAGES && sessions.length < MAX_WORKOUTS; page += 1) {
      const result = await module.readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime: until.toISOString() },
        ...(pageToken ? { pageToken } : {}),
      });
      for (const record of isRow(result) && Array.isArray(result.records) ? result.records : []) {
        const parsed = parseHealthConnectSession(record);
        if (parsed && sessions.length < MAX_WORKOUTS) sessions.push(parsed);
      }
      pageToken = isRow(result) ? shortText(result.pageToken, 500) ?? undefined : undefined;
      if (!pageToken) break;
    }

    const workouts: ImportedWorkout[] = [];
    for (const session of sessions) {
      const window = { operator: 'between' as const, startTime: session.startedAt.toISOString(), endTime: session.endedAt.toISOString() };
      const originFilter = session.origin ? { dataOriginFilter: [session.origin] } : {};

      // Medida opcional que falhar (permissão retirada, app de origem sem o dado) fica vazia: o treino
      // continua importável só com horário e tipo, e nenhum valor é inventado no lugar.
      let distanceM: number | null = null;
      if (grant.distance) {
        try {
          const total = await module.aggregateRecord({ recordType: 'Distance', timeRangeFilter: window, ...originFilter });
          const meters = finiteNumber(isRow(total) && isRow(total.DISTANCE) ? total.DISTANCE.inMeters : null);
          distanceM = meters !== null && meters > 0 ? meters : null;
        } catch {
          distanceM = null;
        }
      }

      let avgHeartRate: number | null = null;
      let maxHeartRate: number | null = null;
      if (heartRate && grant.heartRate) {
        try {
          const rate = await module.aggregateRecord({ recordType: 'HeartRate', timeRangeFilter: window, ...originFilter });
          if (isRow(rate) && (finiteNumber(rate.MEASUREMENTS_COUNT) ?? 0) > 0) {
            avgHeartRate = finiteNumber(rate.BPM_AVG);
            maxHeartRate = finiteNumber(rate.BPM_MAX);
          }
        } catch {
          avgHeartRate = null;
          maxHeartRate = null;
        }
      }

      workouts.push({ ...session, distanceM, avgHeartRate, maxHeartRate });
    }
    return workouts.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  },

  openSettings: () => {
    void load().then((module) => module?.openHealthConnectSettings());
  },
};
