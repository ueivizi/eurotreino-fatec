import type { RoutePoint } from './route';

/** O MapLibre deste app é o nativo: na Web a tela de rota explica e manda para o app instalado. */
export const ROUTE_MAP_AVAILABLE = false;

type Props = {
  points: RoutePoint[];
  onAddPoint: (point: RoutePoint) => void;
  frame: readonly RoutePoint[] | null;
  myPosition?: RoutePoint | null;
};

export function RouteMap(_props: Props) {
  return null;
}
