import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';

import { TabBar } from '@/components/tab-bar';
import { CelebrationHost } from '@/features/celebrations/celebration-host';

export default function TabsLayout() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      {/* Lista oculta: define as rotas das abas; a barra visível é a TabBar. */}
      <TabList style={{ display: 'none' }}>
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
