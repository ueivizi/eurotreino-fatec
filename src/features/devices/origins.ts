/**
 * Quem gravou o treino.
 *
 * O Health Connect entrega, em cada registro, o pacote Android do app que o gravou
 * (`metadata.dataOrigin`). É por aí que o relógio é reconhecido — perguntar a marca à mão fez, no
 * teste em aparelho de 20/09, um Amazfit aparecer como Apple Watch, porque a escolha da pessoa e o
 * app que gravou o treino eram coisas diferentes.
 *
 * A lista é curta de propósito e não é autoridade sobre nada: pacote que não está aqui não vira
 * marca nenhuma, e a tela mostra o nome do pacote pedindo confirmação. Afirmar a marca errada é
 * pior que admitir que não sabe. Ao encontrar um pacote novo num aparelho de verdade, acrescente
 * aqui com o nome que a Play Store mostra.
 */

import { BRAND_INFO, type DeviceBrand } from './brands';

/** Apps companheiros das marcas que o app conhece (`DEVICE_BRANDS`). */
const BRAND_PACKAGES: Record<string, DeviceBrand> = {
  'com.garmin.android.apps.connectmobile': 'garmin',
  // Zepp e as versões anteriores do app da Amazfit.
  'com.huami.midong': 'amazfit',
  'com.huami.watch.hmwatchmanager': 'amazfit',
  'com.xiaomi.hm.health': 'amazfit',
  'com.sec.android.app.shealth': 'galaxy',
};

/** Outros apps que escrevem treino no Health Connect: não são marca de relógio, mas dá para nomear. */
const OTHER_PACKAGES: Record<string, string> = {
  'com.google.android.apps.fitness': 'Google Fit',
  'com.google.android.apps.healthdata': 'Health Connect',
  'com.strava': 'Strava',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.runtastic.android': 'Adidas Running',
  'com.nike.plusgps': 'Nike Run Club',
  'je.fit': 'JEFIT',
  'com.myfitnesspal.android': 'MyFitnessPal',
};

/** Pacotes que reconhecem marca de relógio. Exposto para o teste conferir que nenhuma ficou de fora. */
export const KNOWN_BRAND_PACKAGES = Object.keys(BRAND_PACKAGES);

export type WorkoutOrigin = {
  /** O pacote como veio da origem. */
  id: string;
  /** Marca de relógio, quando o app que gravou é o companheiro de uma delas. */
  brand: DeviceBrand | null;
  /** Nome para mostrar na tela; cai no próprio pacote quando o app é desconhecido. */
  appLabel: string;
  /** Falso quando o pacote não está em nenhuma das listas: a tela pede confirmação. */
  known: boolean;
};

export function describeOrigin(origin: string | null | undefined): WorkoutOrigin | null {
  if (typeof origin !== 'string') return null;
  const id = origin.trim();
  if (id === '') return null;

  const brand = BRAND_PACKAGES[id];
  if (brand) return { id, brand, appLabel: BRAND_INFO[brand].companionApp, known: true };

  const other = OTHER_PACKAGES[id];
  if (other) return { id, brand: null, appLabel: other, known: true };

  return { id, brand: null, appLabel: id, known: false };
}

/**
 * O aparelho da vez: o treino mais recente que informou origem. Um app que sincronizou ontem não
 * pode roubar o lugar do relógio que gravou o treino de hoje.
 */
export function recognizedOrigin(
  workouts: readonly { origin: string | null; startedAt: Date }[],
): WorkoutOrigin | null {
  let newest: { at: number; origin: WorkoutOrigin } | null = null;
  for (const workout of workouts) {
    const origin = describeOrigin(workout.origin);
    if (!origin) continue;
    const at = workout.startedAt.getTime();
    if (!newest || at > newest.at) newest = { at, origin };
  }
  return newest?.origin ?? null;
}
