import {
  MAX_PENDING_PER_USER,
  QueueFullError,
  enqueue,
  forUser,
  isExpired,
  parsePendingList,
  withoutRequest,
  type PendingWorkout,
} from './offline-queue';

const ANA = '3f1c2b1e-6a0d-4b8e-9d7a-2c5e8f9a1b3c';
const BRUNO = '9b2d7e4a-1c3f-4a5b-8e6d-7f0a1b2c3d4e';

function item(overrides: Partial<PendingWorkout> = {}): PendingWorkout {
  return {
    userId: ANA,
    requestId: '0d8f6c1a-2b3e-4c5d-8e9f-a0b1c2d3e4f5',
    type: 'musculacao',
    durationMin: 50,
    intensity: 'moderado',
    performedAt: '2026-09-17T21:42:00.000Z',
    queuedAt: '2026-09-17T21:42:05.000Z',
    ...overrides,
  };
}

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('parsePendingList', () => {
  it('lê a fila guardada e descarta itens fora do formato ou repetidos', () => {
    const valid = item();
    const raw = JSON.stringify([valid, valid, { ...valid, requestId: uuid(1), type: 'pilates' }, { ...valid, requestId: uuid(2), durationMin: 0 }, 'lixo']);
    expect(parsePendingList(raw)).toEqual([valid]);
  });

  it('trata conteúdo corrompido como fila vazia', () => {
    expect(parsePendingList(null)).toEqual([]);
    expect(parsePendingList('{')).toEqual([]);
    expect(parsePendingList('{"a":1}')).toEqual([]);
  });
});

describe('enqueue', () => {
  it('não duplica o mesmo registro', () => {
    const list = enqueue([], item());
    expect(enqueue(list, item())).toHaveLength(1);
  });

  it('limita a fila por usuário', () => {
    let list: PendingWorkout[] = [];
    for (let i = 0; i < MAX_PENDING_PER_USER; i += 1) list = enqueue(list, item({ requestId: uuid(i) }));
    expect(() => enqueue(list, item({ requestId: uuid(99) }))).toThrow(QueueFullError);
    expect(enqueue(list, item({ userId: BRUNO, requestId: uuid(100) }))).toHaveLength(MAX_PENDING_PER_USER + 1);
  });
});

describe('forUser e expiração', () => {
  it('separa os itens de cada usuário, do treino mais antigo ao mais novo', () => {
    const list = [
      item({ requestId: uuid(1), performedAt: '2026-09-17T12:00:00Z' }),
      item({ requestId: uuid(2), userId: BRUNO }),
      item({ requestId: uuid(3), performedAt: '2026-09-16T12:00:00Z' }),
    ];
    expect(forUser(list, ANA).map((pending) => pending.requestId)).toEqual([uuid(3), uuid(1)]);
    expect(withoutRequest(list, uuid(2)).map((pending) => pending.requestId)).toEqual([uuid(1), uuid(3)]);
  });

  it('marca como vencido o treino com mais de 48 horas', () => {
    const pending = item({ performedAt: '2026-09-15T12:00:00Z' });
    expect(isExpired(pending, new Date('2026-09-17T11:59:00Z'))).toBe(false);
    expect(isExpired(pending, new Date('2026-09-17T12:01:00Z'))).toBe(true);
  });
});
