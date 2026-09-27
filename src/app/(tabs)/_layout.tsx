import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet } from 'react-native';

import { TabBar } from '@/components/tab-bar';
import { CelebrationHost } from '@/features/celebrations/celebration-host';
import { TrophyWatcher } from '@/features/legions/trophy-watcher';

/**
 * Abas do app.
 *
 * O `TabSlot` fica com o desenho padrão do expo-router de propósito: a tentativa de embrulhar cada
 * aba num `Screen` próprio (para dar travessia à troca) parou a navegação — a URL mudava e a tela
 * não. A travessia de cada aba mora dentro das telas, no `TabFade`, que não mexe em navegação.
 */
export default function TabsLayout() {
  return (
    <Tabs>
      {/* `detachInactiveScreens` fica no padrão: desligá-lo empilha as abas e a tela nunca muda. */}
      <TabSlot style={styles.fill} />
      {/* Lista oculta: define as rotas das abas; a barra visível é a TabBar. */}
      <TabList style={styles.none}>
        <TabTrigger name="inicio" href="/" />
        <TabTrigger name="arena" href="/arena" />
        <TabTrigger name="mapa" href="/mapa" />
        <TabTrigger name="legiao" href="/legiao" />
        {/* Sem botão na barra: o Perfil abre pela foto no topo das abas. */}
        <TabTrigger name="perfil" href="/perfil" />
      </TabList>
      <TabBar />
      {/* Cerimônias de conquista tocam por cima das abas, depois que a folha de registro fecha. */}
      <CelebrationHost />
      {/* Apura as temporadas competitivas e enfileira a cerimônia dos Triunfos novos. */}
      <TrophyWatcher />
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
});
