import type { ImportedWorkout } from './imported-workout';

/**
 * Estado do Health Connect neste aparelho. Só o Android tem Health Connect; no Expo Go o módulo
 * nativo não existe, e a leitura fica para a versão instalada do app (development build).
 */
export type HealthConnectStatus = 'unsupported' | 'expo-go' | 'not-installed' | 'update-required' | 'available';

export type HealthConnectGrant = { exercise: boolean; distance: boolean; heartRate: boolean };

export type HealthConnectApi = {
  status: () => Promise<HealthConnectStatus>;
  /** Pede leitura de exercícios e distância; frequência cardíaca só quando a pessoa consentiu no perfil. */
  connect: (options: { heartRate: boolean }) => Promise<HealthConnectGrant>;
  granted: () => Promise<HealthConnectGrant>;
  /** Treinos gravados por outros apps no intervalo, já normalizados e validados. */
  readWorkouts: (options: { since: Date; until: Date; heartRate: boolean }) => Promise<ImportedWorkout[]>;
  openSettings: () => void;
};

export const NO_GRANT: HealthConnectGrant = { exercise: false, distance: false, heartRate: false };

export const HEALTH_CONNECT_STATUS_MESSAGES: Record<Exclude<HealthConnectStatus, 'available'>, string> = {
  unsupported: 'O Health Connect existe só no Android.',
  'expo-go': 'A leitura do relógio precisa da versão instalada do EuroTreino. No Expo Go, importe o arquivo GPX.',
  'not-installed': 'Instale o Health Connect pela Play Store para ler os treinos do relógio.',
  'update-required': 'Atualize o Health Connect pela Play Store para ler os treinos do relógio.',
};
