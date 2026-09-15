import { useSyncExternalStore } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

/**
 * "Reduzir movimento": vale a opção do sistema. A simulação só existe para a galeria de
 * desenvolvimento conferir a versão sem movimento sem mexer nas configurações do aparelho.
 */

let simulated = false;
const listeners = new Set<() => void>();

export function setSimulatedReducedMotion(value: boolean) {
  if (simulated === value) return;
  simulated = value;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSimulated() {
  return simulated;
}

/** `true` quando a pessoa pediu menos movimento: tudo vira fade curto, sem partículas nem loops. */
export function useReducedMotionPreference(): boolean {
  const system = useReducedMotion();
  const simulatedValue = useSyncExternalStore(subscribe, getSimulated, getSimulated);
  return system || simulatedValue;
}
