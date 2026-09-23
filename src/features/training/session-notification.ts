import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatLoad } from '@/features/workouts/metrics';
import { workoutModule, workoutTypeLabel } from '@/features/workouts/workout-types';

import { elapsedMs, formatElapsed, setsOf, type Session } from './session';

/**
 * Treinar com a tela apagada.
 *
 * Enquanto a sessão corre, uma notificação fixa mostra o cronômetro e o exercício da vez, com
 * botões que marcam a série, mexem na carga e marcam volta — sem desbloquear o aparelho e sem
 * abrir o app. É o caminho combinado com o usuário em 22/09: **nada de serviço em primeiro plano**,
 * que mudaria a lista de permissões. A consequência honesta é que isto vale enquanto o sistema
 * mantém o app vivo em segundo plano; se ele matar o app, a notificação some e a sessão continua
 * guardada no aparelho, para retomar ao abrir de novo.
 *
 * A tela de bloqueio não tem seletor: o que cabe é um passo por toque. Está documentado em
 * `docs/treino-na-tela-bloqueada.md`.
 */

const CHANNEL_ID = 'sessao';
export const SESSION_NOTIFICATION_ID = 'eurotreino-sessao';

/** No navegador não há tela de bloqueio para atender: a Web segue sem notificação nenhuma. */
const SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';

/** Categorias (os botões) por família de treino. */
const CATEGORY = { forca: 'sessao-forca', resistencia: 'sessao-resistencia', outro: 'sessao-outro' } as const;

/** Identificador de cada botão; o app traduz em ação na sessão. */
export const SESSION_ACTIONS = {
  setDone: 'serie-feita',
  loadUp: 'carga-mais',
  loadDown: 'carga-menos',
  lap: 'volta',
  pause: 'pausar',
  resume: 'retomar',
} as const;

export type SessionAction = (typeof SESSION_ACTIONS)[keyof typeof SESSION_ACTIONS];

export function isSessionAction(value: string): value is SessionAction {
  return Object.values(SESSION_ACTIONS).some((action) => action === value);
}

/** O passo de carga da notificação: o mesmo da tela. */
export const NOTIFICATION_LOAD_STEP = 2.5;

let ready = false;

/**
 * Prepara canal e categorias uma vez por execução. Pedir permissão aqui seria pedir cedo demais:
 * quem nunca abriu uma sessão não precisa ser incomodado.
 */
async function prepare(): Promise<void> {
  if (ready || !SUPPORTED) return;

  /* Com o app aberto a notificação não precisa chamar atenção, mas precisa **existir**: é ela que
     estará lá quando a tela apagar. Então nada de banner nem som; só a linha na gaveta. */
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Treino em andamento',
      importance: Notifications.AndroidImportance.LOW,
      // Treino não é aviso urgente: sem som, sem vibrar, só presente.
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
      showBadge: false,
    });
  }

  const step = (identifier: string, title: string) => ({
    identifier,
    buttonTitle: title,
    options: { opensAppToForeground: false },
  });

  await Notifications.setNotificationCategoryAsync(CATEGORY.forca, [
    step(SESSION_ACTIONS.loadDown, `− ${NOTIFICATION_LOAD_STEP.toString().replace('.', ',')}`),
    step(SESSION_ACTIONS.setDone, 'Série feita'),
    step(SESSION_ACTIONS.loadUp, `+ ${NOTIFICATION_LOAD_STEP.toString().replace('.', ',')}`),
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY.resistencia, [
    step(SESSION_ACTIONS.lap, 'Marcar volta'),
    step(SESSION_ACTIONS.pause, 'Pausar'),
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY.outro, [step(SESSION_ACTIONS.pause, 'Pausar')]);
  ready = true;
}

/**
 * Permissão de notificação (Android 13+ e iOS pedem). Só é chamada quando uma sessão começa —
 * e um "não" não impede treinar: a sessão segue, só não aparece na tela de bloqueio.
 */
export async function ensureSessionNotificationPermission(): Promise<boolean> {
  if (!SUPPORTED) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

type Labels = {
  /** Nome do exercício da vez, resolvido pelo catálogo. */
  exerciseName: string | null;
  /** Nome da ficha, quando a sessão veio de uma. */
  routineName: string | null;
};

/** O texto da notificação: quem lê está de tela apagada, então o essencial vem primeiro. */
export function notificationText(session: Session, labels: Labels, now: Date): { title: string; body: string } {
  const clock = formatElapsed(elapsedMs(session, now));
  const heading = labels.routineName ?? workoutTypeLabel(session.workoutType);
  const title = session.pausedAt ? `${heading} · pausado em ${clock}` : `${heading} · ${clock}`;

  if (workoutModule(session.workoutType) === 'forca') {
    if (!session.focus || !labels.exerciseName) {
      return { title, body: `${session.sets.length} ${session.sets.length === 1 ? 'série feita' : 'séries feitas'}` };
    }
    const done = setsOf(session, session.focus.exerciseId).length;
    const load = session.focus.loadKg === null ? 'peso livre' : formatLoad(session.focus.loadKg);
    return {
      title,
      body: `${labels.exerciseName} · série ${done + 1} · ${session.focus.reps} reps · ${load}`,
    };
  }

  const laps = session.laps.length;
  return { title, body: laps === 0 ? 'Sem voltas marcadas' : `${laps} ${laps === 1 ? 'volta' : 'voltas'}` };
}

/** Publica (ou repinta) a notificação da sessão. O mesmo identificador substitui a anterior. */
export async function showSessionNotification(session: Session, labels: Labels, now = new Date()): Promise<void> {
  if (!SUPPORTED) return;
  await prepare();
  const { title, body } = notificationText(session, labels, now);
  const module = workoutModule(session.workoutType);
  await Notifications.scheduleNotificationAsync({
    identifier: SESSION_NOTIFICATION_ID,
    content: {
      title,
      body,
      categoryIdentifier: module === 'forca' ? CATEGORY.forca : module === 'resistencia' ? CATEGORY.resistencia : CATEGORY.outro,
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.LOW,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export async function clearSessionNotification(): Promise<void> {
  if (!SUPPORTED) return;
  await Notifications.dismissNotificationAsync(SESSION_NOTIFICATION_ID).catch(() => undefined);
  await Notifications.cancelScheduledNotificationAsync(SESSION_NOTIFICATION_ID).catch(() => undefined);
}
