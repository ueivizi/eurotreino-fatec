import { TabList, TabSlot, TabTrigger, Tabs, type TabsSlotRenderOptions } from 'expo-router/ui';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Screen } from 'react-native-screens';

import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { TabBar } from '@/components/tab-bar';
import { CelebrationHost } from '@/features/celebrations/celebration-host';
import { duration, easing } from '@/theme/motion';

type TabDescriptor = Parameters<NonNullable<React.ComponentProps<typeof TabSlot>['renderFn']>>[0];

/**
 * Uma aba, com a entrada em travessia.
 *
 * Trocar de aba não empilha tela, então a transição do Stack não vale aqui: sem isto, a aba nova
 * aparecia seca (achado do teste em aparelho de 22/09). As telas ficam montadas — `detachInactive`
 * fica desligado no `TabSlot` — para voltar a uma aba não recarregar nada nem piscar indicador.
 */
function TabScreen({ descriptor, isFocused, freeze }: { descriptor: TabDescriptor; isFocused: boolean; freeze?: boolean }) {
  const reduced = useReducedMotionPreference();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!isFocused) return;
    if (reduced) {
      opacity.set(1);
      return;
    }
    opacity.set(0);
    opacity.set(withTiming(1, { duration: duration.fast, easing: easing.standard }));
  }, [isFocused, reduced, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Screen
      enabled={false}
      activityState={isFocused ? 2 : 0}
      freezeOnBlur={freeze}
      style={[StyleSheet.absoluteFill, isFocused ? styles.focused : styles.hidden]}>
      <Animated.View style={[styles.fill, style]}>{descriptor.render()}</Animated.View>
    </Screen>
  );
}

function renderTab(descriptor: TabDescriptor, { isFocused, loaded }: TabsSlotRenderOptions) {
  const { lazy = true, unmountOnBlur, freezeOnBlur } = descriptor.options;
  if (unmountOnBlur && !isFocused) return null;
  // Aba nunca aberta não é montada à toa; depois da primeira visita, fica.
  if (lazy && !loaded && !isFocused) return null;
  return <TabScreen key={descriptor.route.key} descriptor={descriptor} isFocused={isFocused} freeze={freezeOnBlur} />;
}

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot style={styles.fill} detachInactiveScreens={false} renderFn={renderTab} />
      {/* Lista oculta: define as rotas das abas; a barra visível é a TabBar. */}
      <TabList style={styles.none}>
        <TabTrigger name="inicio" href="/" />
        <TabTrigger name="arena" href="/arena" />
        <TabTrigger name="legiao" href="/legiao" />
        <TabTrigger name="perfil" href="/perfil" />
      </TabList>
      <TabBar />
      {/* Cerimônias de conquista tocam por cima das abas, depois que a folha de registro fecha. */}
      <CelebrationHost />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  none: {
    display: 'none',
  },
  focused: {
    display: 'flex',
  },
  hidden: {
    display: 'none',
  },
});
