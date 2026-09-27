import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LOOP_OPTIONS,
  MAX_RETURNED_POINTS,
  MAX_WAYPOINTS,
  bearerToken,
  corsHeadersFor,
  orsCalls,
  orsFailure,
  parseOrsRoute,
  parseRouteRequest,
  projectPublishableKey,
  simplify,
  type Position,
} from './policy.ts';

const PRACA: Position = [-46.6333, -23.5505];
const PERTO: Position = [-46.63, -23.548];

describe('parseRouteRequest', () => {
  it('aceita rota entre pontos tocados e volta a partir de um ponto', () => {
    assert.deepEqual(parseRouteRequest({ tipo: 'rota', modalidade: 'bike', pontos: [PRACA, PERTO] }), {
      kind: 'rota',
      modality: 'bike',
      points: [PRACA, PERTO],
    });
    assert.deepEqual(parseRouteRequest({ tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 5000 }), {
      kind: 'volta',
      modality: 'pe',
      start: PRACA,
      lengthM: 5000,
      variation: 0,
    });
  });

  it('recusa o que foge da lista fechada', () => {
    const invalid: unknown[] = [
      null,
      [],
      'rota',
      { tipo: 'viagem', modalidade: 'pe', pontos: [PRACA, PERTO] },
      { tipo: 'rota', modalidade: 'carro', pontos: [PRACA, PERTO] },
      { tipo: 'rota', modalidade: 'pe', pontos: [PRACA] },
      { tipo: 'rota', modalidade: 'pe', pontos: Array.from({ length: MAX_WAYPOINTS + 1 }, () => PRACA) },
      { tipo: 'rota', modalidade: 'pe', pontos: [PRACA, [200, 0]] },
      { tipo: 'rota', modalidade: 'pe', pontos: [PRACA, ['-46', '-23']] },
      { tipo: 'rota', modalidade: 'pe', pontos: [PRACA, [Number.NaN, 0]] },
      // Trecho de centenas de quilômetros: não é treino.
      { tipo: 'rota', modalidade: 'bike', pontos: [PRACA, [-43.2, -22.9]] },
      { tipo: 'rota', modalidade: 'pe', pontos: [PRACA, PERTO], extra: 1 },
      { tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 500 },
      { tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 61_000 },
      { tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 5000.5 },
      { tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 5000, variacao: -1 },
      { tipo: 'volta', modalidade: 'pe', inicio: [PRACA], distanciaM: 5000 },
      { tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 5000, pontos: [PRACA, PERTO] },
    ];
    for (const body of invalid) assert.equal(parseRouteRequest(body), null, JSON.stringify(body));
  });
});

describe('orsCalls', () => {
  it('um pedido para a rota, com perfil da modalidade e sem instruções', () => {
    const request = parseRouteRequest({ tipo: 'rota', modalidade: 'bike', pontos: [PRACA, PERTO] });
    assert.ok(request);
    const calls = orsCalls(request);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.profile, 'cycling-regular');
    assert.equal(calls[0]?.body.instructions, false);
    assert.deepEqual(calls[0]?.body.coordinates, [PRACA, PERTO]);
  });

  it('três sementes diferentes para as voltas, que mudam com a variação', () => {
    const first = parseRouteRequest({ tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 5000 });
    const again = parseRouteRequest({ tipo: 'volta', modalidade: 'pe', inicio: PRACA, distanciaM: 5000, variacao: 1 });
    assert.ok(first && again);
    const seeds = (request: NonNullable<typeof first>) =>
      orsCalls(request).map((call) => (call.body.options as { round_trip: { seed: number } }).round_trip.seed);
    assert.equal(seeds(first).length, LOOP_OPTIONS);
    assert.equal(new Set([...seeds(first), ...seeds(again)]).size, LOOP_OPTIONS * 2);
    assert.equal(orsCalls(first)[0]?.profile, 'foot-walking');
  });
});

function orsPayload(coordinates: unknown, properties: Record<string, unknown> = {}) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: {
          summary: { distance: 5234.7, duration: 1800 },
          ascent: 41.2,
          descent: 40.8,
          extras: { waytype: { values: [], summary: [{ value: 6, distance: 3000, amount: 57.3 }, { value: 3, distance: 2234, amount: 42.7 }] } },
          ...properties,
        },
      },
    ],
  };
}

describe('parseOrsRoute', () => {
  it('lê distância, subida e a parte em ciclovia, sem a altitude dos pontos', () => {
    const route = parseOrsRoute(orsPayload([[-46.633331, -23.550512, 760.1], [-46.63, -23.548, 762]]));
    assert.deepEqual(route, {
      pontos: [
        [-46.63333, -23.55051],
        [-46.63, -23.548],
      ],
      distanciaM: 5235,
      subidaM: 41,
      descidaM: 41,
      cicloviaPct: 57,
      calmaPct: 57,
    });
  });

  it('lê o resumo das vias também no formato JSON comum (waytypes)', () => {
    const payload = orsPayload([[-46.6, -23.5], [-46.7, -23.4]], {
      extras: { waytypes: { summary: [{ value: 7, amount: 85.5 }, { value: 2, amount: 14.5 }] } },
    });
    assert.equal(parseOrsRoute(payload)?.calmaPct, 86);
    assert.equal(parseOrsRoute(payload)?.cicloviaPct, 0);
  });

  it('recusa resposta fora do formato', () => {
    const invalid: unknown[] = [
      null,
      {},
      { features: [] },
      orsPayload([[-46.6, -23.5]]),
      orsPayload([[-46.6, -23.5], ['x', 0]]),
      orsPayload([[-46.6, -23.5], [-46.7, 95]]),
      orsPayload([[-46.6, -23.5], [-46.7, -23.4]], { summary: { distance: -1 } }),
      orsPayload([[-46.6, -23.5], [-46.7, -23.4]], { summary: {} }),
    ];
    for (const payload of invalid) assert.equal(parseOrsRoute(payload), null);
  });

  it('reduz traçado longo ao teto de pontos, mantendo começo e fim', () => {
    const many = Array.from({ length: 3000 }, (_, i): Position => [-46.6 + i * 0.00002, -23.5 + (i % 3) * 0.00001]);
    const reduced = simplify(many);
    assert.ok(reduced.length <= MAX_RETURNED_POINTS);
    assert.deepEqual(reduced[0], many[0]);
    assert.deepEqual(reduced[reduced.length - 1], many[many.length - 1]);
  });
});

describe('falhas e ambiente', () => {
  it('traduz o status do roteador', () => {
    assert.equal(orsFailure(404), 'no_route');
    assert.equal(orsFailure(400), 'no_route');
    for (const status of [401, 403, 429, 500, 503]) assert.equal(orsFailure(status), 'unavailable');
  });

  it('só aceita JWT no Authorization', () => {
    assert.equal(bearerToken('Bearer aaa.bbb.ccc'), 'aaa.bbb.ccc');
    assert.equal(bearerToken('Bearer aaa'), null);
    assert.equal(bearerToken(null), null);
  });

  it('acha a chave publicável nova ou a antiga', () => {
    assert.equal(projectPublishableKey('{"default":"nova"}', 'antiga'), 'nova');
    assert.equal(projectPublishableKey('{malformado', 'antiga'), 'antiga');
    assert.equal(projectPublishableKey(undefined, undefined), null);
  });

  it('CORS só para as origens listadas', () => {
    assert.equal(corsHeadersFor('http://localhost:8081', undefined)['Access-Control-Allow-Origin'], 'http://localhost:8081');
    assert.equal(corsHeadersFor('https://malicioso.example', undefined)['Access-Control-Allow-Origin'], undefined);
    assert.equal(corsHeadersFor('https://qualquer.example', '*')['Access-Control-Allow-Origin'], undefined);
  });
});
