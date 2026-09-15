import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import Animated, { FadeOut } from 'react-native-reanimated';

import * as haptics from '@/lib/haptics';
import { duration } from '@/theme/motion';

import { clearCelebrations, dismissCelebration, useCurrentCelebration } from './celebration-store';
import type { Celebration } from './celebration-types';
import { ArenaScene } from './scenes/arena-scene';
import { AscensionScene } from './scenes/ascension-scene';
import { ConstancyScene } from './scenes/constancy-scene';
import { DivisionScene } from './scenes/division-scene';
import { MedalScene } from './scenes/medal-scene';
import { RecordScene } from './scenes/record-scene';

/** Espera a folha de registro terminar de fechar antes de abrir a cerimônia. */
const OPEN_DELAY_MS = 320;

export function CelebrationScene({ celebration, onContinue }: { celebration: Celebration; onContinue: () => void }) {
  switch (celebration.kind) {
    case 'ascension':
      return <AscensionScene celebration={celebration} onContinue={onContinue} />;
    case 'division':
      return <DivisionScene celebration={celebration} onContinue={onContinue} />;
    case 'arena':
      return <ArenaScene celebration={celebration} onContinue={onContinue} />;
    case 'constancy':
      return <ConstancyScene celebration={celebration} onContinue={onContinue} />;
    case 'first-workout':
      return (
        <MedalScene
          title="Primeiro passo"
          description="Seu primeiro treino está registrado. Toda Legião começa assim."
          icon="registrar"
          onContinue={onContinue}
        />
      );
    case 'medal':
      return <MedalScene title={celebration.title} description={celebration.description} icon="arena" onContinue={onContinue} />;
    case 'record':
      return <RecordScene celebration={celebration} onContinue={onContinue} />;
  }
}

/**
 * Toca a fila de celebrações por cima da tela atual. Só abre com a tela em foco: com a folha
 * de registro aberta, a cerimônia espera ela fechar.
 */
export function CelebrationHost() {
  const current = useCurrentCelebration();
  const focused = useIsFocused();
  const [openedId, setOpenedId] = useState<number | null>(null);

  useEffect(() => clearCelebrations, []);

  const currentId = current?.id ?? null;

  useEffect(() => {
    if (currentId === null || !focused) return;
    const timer = setTimeout(() => setOpenedId(currentId), OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentId, focused]);

  const visible = current !== null && focused && openedId === current.id;

  useEffect(() => {
    if (!visible || currentId === null) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissCelebration(currentId);
      return true;
    });
    return () => subscription.remove();
  }, [visible, currentId]);

  if (!visible || !current) return null;

  const done = () => {
    haptics.cancelCeremony();
    dismissCelebration(current.id);
  };

  return (
    <Animated.View key={current.id} exiting={FadeOut.duration(duration.base)} style={styles.layer}>
      <CelebrationScene celebration={current.celebration} onContinue={done} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    elevation: 50,
  },
});
