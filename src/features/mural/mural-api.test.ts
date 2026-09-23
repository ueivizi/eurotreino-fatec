import { parseMural } from './mural-api';

const MESSAGE = {
  message_id: '7c1f2a5e-7b3d-4e2f-8a10-6c5d4b3a2f10',
  body: 'Domingo 7h no parque, quem vai?',
  created_at: '2026-09-23T19:30:00Z',
  author_id: '9f1c2a5e-7b3d-4e2f-8a10-6c5d4b3a2f11',
  display_name: 'Digão',
  emblem: 'raio',
  emblem_color: 'ouro',
  is_mine: false,
  is_owner_message: true,
  is_held: false,
  reports_count: 0,
};

describe('mural da Legião', () => {
  it('converte a mensagem com autor e emblema', () => {
    const [message] = parseMural([MESSAGE]) ?? [];
    expect(message?.displayName).toBe('Digão');
    expect(message?.emblem).toBe('raio');
    expect(message?.emblemColor).toBe('ouro');
    expect(message?.isFromOwner).toBe(true);
    expect(message?.createdAt.toISOString()).toBe('2026-09-23T19:30:00.000Z');
  });

  /* Cor fora da lista fechada não invalida a mensagem: ela só volta para a cor padrão. */
  it('cor desconhecida vira a padrão', () => {
    expect(parseMural([{ ...MESSAGE, emblem_color: 'rosa-choque' }])?.[0]?.emblemColor).toBe('ouro');
  });

  it('recusa a resposta fora do combinado', () => {
    expect(parseMural([{ ...MESSAGE, body: '' }])).toBeNull();
    expect(parseMural([{ ...MESSAGE, body: 'a'.repeat(501) }])).toBeNull();
    expect(parseMural([{ ...MESSAGE, emblem: 'dragao' }])).toBeNull();
    expect(parseMural([{ ...MESSAGE, is_held: 'sim' }])).toBeNull();
    expect(parseMural([{ ...MESSAGE, created_at: 'ontem' }])).toBeNull();
    expect(parseMural('nada')).toBeNull();
  });

  it('a mensagem retida chega marcada, com a contagem do fundador', () => {
    const [message] = parseMural([{ ...MESSAGE, is_held: true, reports_count: 3 }]) ?? [];
    expect(message?.isHeld).toBe(true);
    expect(message?.reportsCount).toBe(3);
  });
});
