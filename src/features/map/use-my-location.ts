import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import type { RoutePoint } from './route';

export type MyLocation =
  | { status: 'desligada' }
  | { status: 'buscando' }
  | { status: 'negada' }
  | { status: 'erro' }
  | { status: 'ativa'; position: RoutePoint; accuracy: number | null };

/**
 * Posição da pessoa enquanto o mapa está na tela. Só liga com a escolha "Localização" ativa e a
 * permissão do aparelho já dada (quem pede a permissão é a tela de escolhas). A posição fica na
 * memória: não é gravada nem enviada.
 */
export function useMyLocation(enabled: boolean): MyLocation {
  const [state, setState] = useState<MyLocation>({ status: 'buscando' });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        if (alive) setState({ status: 'negada' });
        return;
      }
      // Precisão equilibrada basta para o mapa: gasta menos bateria que a do GPS de treino.
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 3000 },
        (location) => {
          const { latitude, longitude, accuracy } = location.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          setState({ status: 'ativa', position: { lat: latitude, lng: longitude }, accuracy: accuracy ?? null });
        },
      );
      if (alive) subscription = watcher;
      else watcher.remove();
    })().catch(() => {
      if (alive) setState({ status: 'erro' });
    });

    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [enabled]);

  return enabled ? state : { status: 'desligada' };
}
