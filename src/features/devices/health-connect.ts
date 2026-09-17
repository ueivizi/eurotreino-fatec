import { NO_GRANT, type HealthConnectApi } from './health-connect-types';

/** iOS e Web: não há Health Connect. A versão Android fica em health-connect.android.ts. */
export const healthConnect: HealthConnectApi = {
  status: async () => 'unsupported',
  connect: async () => NO_GRANT,
  granted: async () => NO_GRANT,
  readWorkouts: async () => [],
  openSettings: () => undefined,
};
