import { TabFade } from '@/components/motion/tab-fade';
import { StatusScreen } from '@/components/status-screen';
import { EXPLORE_MAP_AVAILABLE, ExploreMap } from '@/features/map/explore-map';

/** Aba Mapa: posição, ciclovias, lugares por perto e rotas para treinar. */
export default function MapTab() {
  if (!EXPLORE_MAP_AVAILABLE) {
    return (
      <TabFade>
        <StatusScreen
          icon="mapa"
          title="O mapa é do app instalado"
          description="Ciclovias, lugares por perto e rotas usam o mapa do celular. Abra o EuroTreino no Android ou no iPhone."
        />
      </TabFade>
    );
  }
  return (
    <TabFade>
      <ExploreMap />
    </TabFade>
  );
}
