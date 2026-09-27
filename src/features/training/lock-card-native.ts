import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { parseCardEvents, type CardEvent, type CardState } from './lock-card';

type NativeCard = {
  show(json: string): void;
  hide(): void;
  drainEvents(): string;
  addListener(event: 'onAction', listener: () => void): { remove(): void };
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
