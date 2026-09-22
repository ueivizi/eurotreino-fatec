import { WORKOUT_TYPES } from '@/features/workouts/workout-types';

import { HEALTH_CONNECT_GROUPS, workoutTypeFromGpx, workoutTypeFromHealthConnect } from './activity-map';
import { BRAND_INFO, DEVICE_BRANDS } from './brands';
import { GPX_MAX_BYTES, haversineMeters, parseGpx } from './gpx';
import {
  IMPORT_WINDOW_MS,
  importEligibility,
  likelyDuplicate,
  matchingWorkout,
  toWorkoutInput,
  uuidFromHex,
  type ImportedWorkout,
} from './imported-workout';
import { KNOWN_BRAND_PACKAGES, describeOrigin, recognizedOrigin } from './origins';

const NOW = new Date('2026-09-17T12:00:00Z');

function workout(overrides: Partial<ImportedWorkout> = {}): ImportedWorkout {
  return {
    source: 'health-connect',
    sourceId: 'abc',
    origin: 'com.garmin.android.apps.connectmobile',
    suggestedType: 'corrida',
    startedAt: new Date('2026-09-17T09:00:00Z'),
    endedAt: new Date('2026-09-17T09:47:00Z'),
    distanceM: 8123.6,
    avgHeartRate: 151.4,
    maxHeartRate: 178,
    ...overrides,
  };
}

describe('mapeamento do Health Connect', () => {
  it('cada código pertence a um tipo só e todo tipo agrupado existe no app', () => {
    const codes = Object.values(HEALTH_CONNECT_GROUPS).flat();
    expect(new Set(codes).size).toBe(codes.length);
    const ids = new Set<string>(WORKOUT_TYPES.map((type) => type.id));
    for (const type of Object.keys(HEALTH_CONNECT_GROUPS)) expect(ids.has(type)).toBe(true);
  });

  it('traduz as modalidades principais e manda o resto para "outro"', () => {
    expect(workoutTypeFromHealthConnect(56)).toBe('corrida');
    expect(workoutTypeFromHealthConnect(8)).toBe('bike');
    expect(workoutTypeFromHealthConnect(74)).toBe('natacao');
    expect(workoutTypeFromHealthConnect(70)).toBe('musculacao');
    expect(workoutTypeFromHealthConnect(64)).toBe('esporte');
    expect(workoutTypeFromHealthConnect(58)).toBe('outro'); // vela
    expect(workoutTypeFromHealthConnect('56')).toBe('outro');
    expect(workoutTypeFromHealthConnect(null)).toBe('outro');
  });

  it('reconhece o tipo escrito no GPX', () => {
    expect(workoutTypeFromGpx('running')).toBe('corrida');
    expect(workoutTypeFromGpx('Road Biking')).toBe('bike');
    expect(workoutTypeFromGpx('open_water_swimming')).toBe('natacao');
    expect(workoutTypeFromGpx('hiking')).toBe('caminhada');
    expect(workoutTypeFromGpx('yoga')).toBeNull();
    expect(workoutTypeFromGpx(null)).toBeNull();
  });
});

describe('marcas', () => {
  it('toda marca tem caminho ou explicação em cada plataforma', () => {
    for (const brand of DEVICE_BRANDS) {
      const info = BRAND_INFO[brand];
      for (const platform of ['android', 'ios'] as const) {
        if (info.setup[platform] === null && platform === 'android') {
          expect(info.unsupported?.android).toBeTruthy();
        }
      }
    }
  });
});

describe('regras de importação', () => {
  it('aceita treino recente e recusa o que o servidor recusaria', () => {
    expect(importEligibility(workout(), NOW)).toBe('ok');
    expect(importEligibility(workout({ startedAt: new Date(NOW.getTime() - IMPORT_WINDOW_MS - 60_000) }), NOW)).toBe('too_old');
    expect(importEligibility(workout({ endedAt: new Date('2026-09-17T09:00:20Z') }), NOW)).toBe('too_short');
    expect(importEligibility(workout({ endedAt: new Date('2026-09-17T14:30:00Z') }), NOW)).toBe('too_long');
    expect(importEligibility(workout({ startedAt: new Date('2026-09-17T13:00:00Z'), endedAt: new Date('2026-09-17T13:30:00Z') }), NOW)).toBe('in_future');
  });

  it('monta o registro com distância arredondada e frequência só com consentimento', () => {
    const withConsent = toWorkoutInput(workout(), { type: 'corrida', intensity: 'intenso', requestId: 'r', healthConsent: true });
    expect(withConsent).toEqual({
      requestId: 'r',
      type: 'corrida',
      durationMin: 47,
      intensity: 'intenso',
      performedAt: new Date('2026-09-17T09:00:00Z'),
      distanceM: 8124,
      avgHeartRate: 151,
      maxHeartRate: 178,
    });

    const withoutConsent = toWorkoutInput(workout(), { type: 'corrida', intensity: 'intenso', requestId: 'r', healthConsent: false });
    expect(withoutConsent.avgHeartRate).toBeUndefined();
    expect(withoutConsent.maxHeartRate).toBeUndefined();
  });

  it('não manda distância para modalidade sem distância nem medidas fora do intervalo', () => {
    const strength = toWorkoutInput(workout(), { type: 'musculacao', intensity: 'moderado', requestId: 'r', healthConsent: true });
    expect(strength.distanceM).toBeUndefined();

    const odd = toWorkoutInput(workout({ distanceM: 5, avgHeartRate: 190, maxHeartRate: 170 }), {
      type: 'corrida',
      intensity: 'moderado',
      requestId: 'r',
      healthConsent: true,
    });
    expect(odd.distanceM).toBeUndefined();
    expect(odd.avgHeartRate).toBeUndefined();
    expect(odd.maxHeartRate).toBeUndefined();
  });

  it('gera UUID estável a partir do hash', () => {
    const id = uuidFromHex('0123456789abcdef0123456789abcdef0123456789abcdef');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidFromHex('0123456789abcdef0123456789abcdef0123456789abcdef')).toBe(id);
    expect(() => uuidFromHex('zz')).toThrow();
  });

  it('encontra o treino do relógio que cobre a sessão cronometrada', () => {
    const from = new Date('2026-09-17T09:02:00Z');
    const to = new Date('2026-09-17T09:45:00Z');
    const other = workout({ sourceId: 'outro', startedAt: new Date('2026-09-17T09:40:00Z'), endedAt: new Date('2026-09-17T10:20:00Z') });
    expect(matchingWorkout([other, workout()], from, to)?.sourceId).toBe('abc');
    expect(matchingWorkout([other], from, to)).toBeNull();
    expect(matchingWorkout([], from, to)).toBeNull();
    expect(matchingWorkout([workout()], to, from)).toBeNull();
  });

  it('avisa quando já há treino do mesmo tipo perto do horário', () => {
    const recent = [{ type: 'corrida' as const, performedAt: new Date('2026-09-17T09:50:00Z'), durationMin: 45 }];
    expect(likelyDuplicate(workout(), 'corrida', recent)).toBe(true);
    expect(likelyDuplicate(workout(), 'bike', recent)).toBe(false);
    expect(likelyDuplicate(workout(), 'corrida', [{ ...recent[0], performedAt: new Date('2026-09-16T09:50:00Z') }])).toBe(false);
  });
});

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin Connect" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <trk>
    <name>Corrida &amp; treino</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="-23.5500" lon="-46.6330"><time>2026-09-17T09:00:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat='-23.5590' lon='-46.6330'><time>2026-09-17T09:05:00Z</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>160</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="10" lon="10"><time>2026-09-17T09:06:00Z</time></trkpt>
      <trkpt lat="-23.5680" lon="-46.6330"><time>2026-09-17T09:10:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('leitor de GPX', () => {
  it('calcula horário, distância e frequência cardíaca ignorando salto de GPS', () => {
    const result = parseGpx(GPX);
    if (!result.ok) throw new Error(result.error);
    const { summary } = result;
    expect(summary.name).toBe('Corrida & treino');
    expect(summary.suggestedTypeFromFile).toBe('corrida');
    expect(summary.startedAt.toISOString()).toBe('2026-09-17T09:00:00.000Z');
    expect(summary.endedAt.toISOString()).toBe('2026-09-17T09:10:00.000Z');
    // Dois trechos de ~1 km; os saltos até (10, 10) e de volta são descartados.
    expect(summary.distanceM).toBeGreaterThan(1900);
    expect(summary.distanceM).toBeLessThan(2100);
    expect(summary.avgHeartRate).toBe(150);
    expect(summary.maxHeartRate).toBe(160);
    expect(summary.pointCount).toBe(4);
  });

  it('recusa o que não é GPX, trajeto vazio, trajeto sem horário e arquivo grande demais', () => {
    expect(parseGpx('{"json": true}')).toEqual({ ok: false, error: 'not_gpx' });
    expect(parseGpx('<gpx><trk><trkseg></trkseg></trk></gpx>')).toEqual({ ok: false, error: 'no_track' });
    expect(parseGpx('<gpx><trk><trkseg><trkpt lat="1" lon="1"></trkpt><trkpt lat="1.001" lon="1"></trkpt></trkseg></trk></gpx>')).toEqual({
      ok: false,
      error: 'no_time',
    });
    expect(parseGpx(`<gpx>${' '.repeat(GPX_MAX_BYTES)}</gpx>`)).toEqual({ ok: false, error: 'too_large' });
  });

  it('ignora coordenadas fora do globo e atributos malformados', () => {
    const text = '<gpx><trk><trkseg>' +
      '<trkpt lat="95" lon="1"><time>2026-09-17T09:00:00Z</time></trkpt>' +
      '<trkpt lat="abc" lon="1"><time>2026-09-17T09:01:00Z</time></trkpt>' +
      '<trkpt lat="1" lon="1"><time>2026-09-17T09:02:00Z</time></trkpt>' +
      '</trkseg></trk></gpx>';
    expect(parseGpx(text)).toEqual({ ok: false, error: 'no_track' });
  });

  it('não trava com arquivo cheio de pontos sem fechamento', () => {
    const text = `<gpx><trk><trkseg>${'<trkpt lat="1" lon="1">'.repeat(150_000)}</trkseg></trk></gpx>`;
    const started = Date.now();
    parseGpx(text);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('recomeça a contar quando dois pontos seguidos confirmam uma posição nova', () => {
    const text = '<gpx><trk><trkseg>' +
      '<trkpt lat="0" lon="0"><time>2026-09-17T09:00:00Z</time></trkpt>' +
      '<trkpt lat="0.009" lon="0"><time>2026-09-17T09:05:00Z</time></trkpt>' +
      '<trkpt lat="1" lon="0"><time>2026-09-17T10:00:00Z</time></trkpt>' +
      '<trkpt lat="1.009" lon="0"><time>2026-09-17T10:05:00Z</time></trkpt>' +
      '</trkseg></trk></gpx>';
    const result = parseGpx(text);
    if (!result.ok) throw new Error(result.error);
    // Dois trechos de ~1 km; o deslocamento de ~110 km entre eles não conta.
    expect(result.summary.distanceM).toBeGreaterThan(1900);
    expect(result.summary.distanceM).toBeLessThan(2100);
  });

  it('distância entre dois pontos conhecidos', () => {
    // ~111,2 km por grau de latitude.
    expect(Math.round(haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) / 100)).toBe(1112);
  });
});

describe('quem gravou o treino', () => {
  it('reconhece a marca pelo app que gravou', () => {
    expect(describeOrigin('com.garmin.android.apps.connectmobile')).toEqual({
      id: 'com.garmin.android.apps.connectmobile',
      brand: 'garmin',
      appLabel: 'Garmin Connect',
      known: true,
    });
    expect(describeOrigin('com.huami.midong')?.brand).toBe('amazfit');
    expect(describeOrigin('com.sec.android.app.shealth')?.brand).toBe('galaxy');
  });

  it('nomeia app conhecido que não é relógio, sem inventar marca', () => {
    const origin = describeOrigin('com.strava');
    expect(origin).toEqual({ id: 'com.strava', brand: null, appLabel: 'Strava', known: true });
  });

  it('admite que não conhece o pacote em vez de chutar uma marca', () => {
    const origin = describeOrigin('com.marca.desconhecida');
    expect(origin).toEqual({ id: 'com.marca.desconhecida', brand: null, appLabel: 'com.marca.desconhecida', known: false });
  });

  it('sem origem não há aparelho reconhecido (caso do GPX)', () => {
    expect(describeOrigin(null)).toBeNull();
    expect(describeOrigin('   ')).toBeNull();
    expect(recognizedOrigin([workout({ source: 'gpx', origin: null })])).toBeNull();
    expect(recognizedOrigin([])).toBeNull();
  });

  /* O defeito que isto conserta: a tela mostrava a marca escolhida à mão, e um Amazfit apareceu
     como Apple Watch. Agora vale o app que gravou o treino mais recente. */
  it('vale o treino mais recente, não a ordem da lista', () => {
    const recognized = recognizedOrigin([
      workout({ origin: 'com.strava', startedAt: new Date('2026-09-16T09:00:00Z') }),
      workout({ origin: 'com.huami.midong', startedAt: new Date('2026-09-17T09:00:00Z') }),
      workout({ origin: null, startedAt: new Date('2026-09-17T11:00:00Z') }),
    ]);
    expect(recognized?.brand).toBe('amazfit');
  });

  it('toda marca do app tem pelo menos um pacote que a reconhece, menos o Apple Watch', () => {
    // O Apple Watch escreve na Apple Saúde, que não passa pelo Health Connect.
    const reconhecidas = new Set(DEVICE_BRANDS.filter((brand) => brand !== 'apple'));
    for (const brand of reconhecidas) {
      const algum = KNOWN_BRAND_PACKAGES.some((id) => describeOrigin(id)?.brand === brand);
      expect(algum).toBe(true);
    }
  });
});
