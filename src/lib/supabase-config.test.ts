import { parseSupabaseConfig } from './supabase-config';

const URL_OK = 'https://abcdefghijklmnopqrst.supabase.co';

function fakeJwt(payload: object): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.assinatura-falsa`;
}

describe('parseSupabaseConfig', () => {
  it('aceita URL do projeto e chave publicável', () => {
    expect(parseSupabaseConfig(URL_OK, 'sb_publishable_EXEMPLO_FALSO_0123')).toEqual({
      ok: true,
      url: URL_OK,
      publishableKey: 'sb_publishable_EXEMPLO_FALSO_0123',
    });
  });

  it('aceita a chave anon no formato JWT antigo', () => {
    expect(parseSupabaseConfig(URL_OK, fakeJwt({ role: 'anon' })).ok).toBe(true);
  });

  it('recusa chave secreta, nos dois formatos', () => {
    expect(parseSupabaseConfig(URL_OK, 'sb_secret_EXEMPLO_FALSO_0123')).toEqual({ ok: false, problem: 'secret_key' });
    expect(parseSupabaseConfig(URL_OK, fakeJwt({ role: 'service_role' }))).toEqual({ ok: false, problem: 'secret_key' });
  });

  it('recusa variáveis ausentes', () => {
    expect(parseSupabaseConfig(undefined, 'sb_publishable_EXEMPLO_FALSO_0123')).toEqual({ ok: false, problem: 'missing' });
    expect(parseSupabaseConfig(URL_OK, '')).toEqual({ ok: false, problem: 'missing' });
  });

  it('recusa URL fora do padrão de projeto Supabase', () => {
    for (const url of [
      'http://abcdefghijklmnopqrst.supabase.co',
      'https://abcdefghijklmnopqrst.supabase.co/',
      'https://abcdefghijklmnopqrst.supabase.co.evil.example',
      'https://seu-projeto.supabase.co',
    ]) {
      expect(parseSupabaseConfig(url, 'sb_publishable_EXEMPLO_FALSO_0123')).toEqual({ ok: false, problem: 'invalid_url' });
    }
  });

  it('recusa chaves desconhecidas ou ilegíveis', () => {
    for (const key of ['COLE_AQUI', 'sb_publishable_curta', fakeJwt({ role: 'authenticated' }), 'a.%%%.c', 'a.bm90IGpzb24.c']) {
      expect(parseSupabaseConfig(URL_OK, key)).toEqual({ ok: false, problem: 'invalid_key' });
    }
  });
});
