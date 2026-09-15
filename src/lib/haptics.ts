import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Retorno tátil sincronizado com o movimento.
 * É sempre opcional: na Web não existe e aparelhos sem motor de vibração rejeitam a chamada,
 * então a falha é ignorada de propósito e o fluxo segue igual.
 */

const enabled = Platform.OS !== 'web';

function ignore() {
  // Sem vibração o app continua completo: nada a fazer.
}

/** Toque em botão ou chip. */
export function tap() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignore);
}

/** Troca de seleção (tipo de treino, intensidade, aba). */
export function select() {
  if (!enabled) return;
  Haptics.selectionAsync().catch(ignore);
}

/** Treino registrado, meta cumprida. */
export function success() {
  if (!enabled) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore);
}

const pending = new Set<ReturnType<typeof setTimeout>>();

/** Cerimônia (Ascensão, pódio, recorde): forte → médio → sucesso, no ritmo da cunhagem. */
export function ceremony() {
  if (!enabled) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore);
  const steps: [number, () => void][] = [
    [180, () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignore)],
    [360, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore)],
  ];
  for (const [delay, run] of steps) {
    const timer = setTimeout(() => {
      pending.delete(timer);
      run();
    }, delay);
    pending.add(timer);
  }
}

/** Interrompe a sequência de uma cerimônia pulada. */
export function cancelCeremony() {
  for (const timer of pending) clearTimeout(timer);
  pending.clear();
}
