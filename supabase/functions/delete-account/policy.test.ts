import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  REAUTHENTICATION_WINDOW_SECONDS,
  authenticatedUserId,
  bearerToken,
  corsHeadersFor,
  decideDeletion,
  latestAuthenticationAt,
  projectSecretKey,
} from './policy.ts';

const USER = '3f1c2b1e-6a0d-4b8e-9d7a-2c5e8f9a1b3c';
const NOW = 1_789_000_000;
const claims = { sub: USER, role: 'authenticated', is_anonymous: false, amr: [{ method: 'otp', timestamp: NOW - 120 }] };

describe('bearerToken', () => {
  it('aceita só um JWT no formato Bearer', () => {
    assert.equal(bearerToken('Bearer aaa.bbb.ccc'), 'aaa.bbb.ccc');
    for (const header of [null, '', 'aaa.bbb.ccc', 'Basic aaa.bbb.ccc', 'Bearer aaa.bbb', 'Bearer aaa.bbb.ccc extra', `Bearer ${'a'.repeat(5000)}.b.c`]) {
      assert.equal(bearerToken(header), null);
    }
  });
});

describe('authenticatedUserId', () => {
  it('só aceita usuário autenticado, não anônimo e com id válido', () => {
    assert.equal(authenticatedUserId(claims), USER);
    assert.equal(authenticatedUserId({ ...claims, role: 'anon' }), null);
    assert.equal(authenticatedUserId({ ...claims, role: 'service_role' }), null);
    assert.equal(authenticatedUserId({ ...claims, is_anonymous: true }), null);
    assert.equal(authenticatedUserId({ ...claims, sub: 'não-é-uuid' }), null);
    assert.equal(authenticatedUserId(null), null);
  });
});

describe('latestAuthenticationAt', () => {
  it('usa o horário mais recente do amr e ignora entradas sem horário', () => {
    assert.equal(latestAuthenticationAt({ amr: [{ method: 'oauth', timestamp: 10 }, { method: 'otp', timestamp: 30 }, 'otp', { timestamp: 'x' }] }), 30);
    assert.equal(latestAuthenticationAt({ amr: ['otp', 'password'] }), null);
    assert.equal(latestAuthenticationAt({}), null);
  });
});

describe('decideDeletion', () => {
  it('permite com confirmação feita há poucos minutos', () => {
    assert.deepEqual(decideDeletion(claims, NOW - 120, NOW), { allowed: true, userId: USER });
  });

  it('exige nova confirmação quando o login é antigo, ausente ou no futuro', () => {
    const expected = { allowed: false, status: 403, error: 'reauthentication_required' };
    assert.deepEqual(decideDeletion(claims, NOW - REAUTHENTICATION_WINDOW_SECONDS - 1, NOW), expected);
    assert.deepEqual(decideDeletion(claims, null, NOW), expected);
    assert.deepEqual(decideDeletion(claims, NOW + 3600, NOW), expected);
  });

  it('recusa quem não está autenticado antes de olhar o horário', () => {
    assert.deepEqual(decideDeletion({ ...claims, role: 'anon' }, NOW, NOW), {
      allowed: false,
      status: 401,
      error: 'not_authenticated',
    });
  });
});

describe('projectSecretKey', () => {
  it('prefere a chave secreta nova e cai para a antiga', () => {
    assert.equal(projectSecretKey('{"default":"sb_secret_exemplo"}', 'legado'), 'sb_secret_exemplo');
    assert.equal(projectSecretKey('não é json', 'legado'), 'legado');
    assert.equal(projectSecretKey('{"outra":"x"}', undefined), null);
    assert.equal(projectSecretKey(undefined, ''), null);
  });
});

describe('corsHeadersFor', () => {
  it('libera só as origens configuradas, nunca o curinga', () => {
    assert.equal(corsHeadersFor('http://localhost:8081', undefined)['Access-Control-Allow-Origin'], 'http://localhost:8081');
    assert.equal(corsHeadersFor('https://maligno.example', undefined)['Access-Control-Allow-Origin'], undefined);
    assert.equal(
      corsHeadersFor('https://app.eurotreino.com.br', 'http://localhost:8081, https://app.eurotreino.com.br')['Access-Control-Allow-Origin'],
      'https://app.eurotreino.com.br',
    );
    assert.equal(corsHeadersFor('https://qualquer.example', '*')['Access-Control-Allow-Origin'], undefined);
    assert.equal(corsHeadersFor(null, undefined).Vary, 'Origin');
  });
});
