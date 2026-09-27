import type { RoutePoint } from './route';

/** Na Web não há mapa nativo: a sessão segue sem o mapa ao vivo. */
export const LIVE_MAP_AVAILABLE = false;

type Props = {
  sessionKey: string;
  route: readonly RoutePoint[] | null;
  showPosition: boolean;
};

export function LiveMap(_props: Props) {
  return null;
}
