import { requireOptionalNativeModule } from 'expo';
import { useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';

import { parseCardEvents, type CardEvent, type CardState } from './lock-card';

type NativeCard = {
  show(json: string): void;
  hide(): void;
  drainEvents(): string;
  isLocked(): boolean;
  setShowWhenLocked(enabled: boolean): void;
  requestUnlock(): void;
  addListener(event: 'onAction', listener: () => void): { remove(): void };
  addListener(event: 'onLockChange', listener: (payload: { locked?: unknown }) => void): { remove(): void };
};

/** Módulo nativo do cartão (modules/treino-bloqueio). Só existe no Android instalado. */
const native = Platform.OS === 'android' ? requireOptionalNativeModule<NativeCard>('TreinoBloqueio') : null;

export const LOCK_CARD_AVAILABLE = native !== null;

export function showLockCard(state: CardState): void {
  native?.show(JSON.stringify(state));
}

export function hideLockCard(): void {
  native?.hide();
}

/** Toques feitos no cartão ainda não aplicados; a fila é esvaziada na leitura. */
export function drainLockCardEvents(): CardEvent[] {
  return native ? parseCardEvents(native.drainEvents()) : [];
}

/** Avisa quando alguém toca no cartão com o app aberto. */
export function onLockCardAction(listener: () => void): () => void {
  const subscription = native?.addListener('onAction', listener);
  return () => subscription?.remove();
}

/*
 * Treino sobre a tela bloqueada. Durante a sessão, o app pode aparecer por cima do bloqueio; enquanto
 * o aparelho está bloqueado, só a tela do treino fica acessível (o resto pede desbloqueio).
 */
export const LOCK_SCREEN_AVAILABLE = native !== null;

export function setShowWhenLocked(enabled: boolean): void {
  native?.setShowWhenLocked(enabled);
}

export function requestUnlock(): void {
  native?.requestUnlock();
}

let locked = false;

function readLocked(): boolean {
  try {
    return native ? native.isLocked() === true : false;
  } catch {
    // Sem resposta do sistema, fica como desbloqueado: a tela comum já exige o desbloqueio do Android.
    return false;
  }
}

function subscribeLocked(onChange: () => void): () => void {
  if (!native) return () => undefined;
  const refresh = () => {
    locked = readLocked();
    onChange();
  };
  const lockSubscription = native.addListener('onLockChange', refresh);
  // Ao acender a tela por cima do bloqueio, o app volta a ficar ativo: é a hora de conferir.
  const appSubscription = AppState.addEventListener('change', (status) => {
    if (status === 'active') refresh();
  });
  locked = readLocked();
  return () => {
    lockSubscription.remove();
    appSubscription.remove();
  };
}

function lockedSnapshot(): boolean {
  return locked;
}

/** O aparelho está bloqueado (o app aparece por cima da tela de bloqueio). */
export function useDeviceLocked(): boolean {
  return useSyncExternalStore(subscribeLocked, lockedSnapshot, () => false);
}
