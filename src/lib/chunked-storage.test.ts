import { CHUNK_SIZE, MAX_CHUNKS, createChunkedStorage, type KeyValueBackend } from './chunked-storage';

function memoryBackend() {
  const items = new Map<string, string>();
  const backend: KeyValueBackend = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
    removeItem: async (key) => {
      items.delete(key);
    },
  };
  return { items, backend };
}

const KEY = 'sb-projeto-auth-token';

describe('createChunkedStorage', () => {
  it('guarda e lê um valor pequeno', async () => {
    const { backend } = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem(KEY, '{"access_token":"x"}');
    await expect(storage.getItem(KEY)).resolves.toBe('{"access_token":"x"}');
  });

  it('divide valores grandes sem passar do tamanho de pedaço', async () => {
    const { items, backend } = memoryBackend();
    const storage = createChunkedStorage(backend);
    const value = 'a'.repeat(CHUNK_SIZE * 3 + 7);
    await storage.setItem(KEY, value);
    expect(items.get(`${KEY}.n`)).toBe('4');
    for (const [key, part] of items) {
      if (key !== `${KEY}.n`) expect(Array.from(part).length).toBeLessThanOrEqual(CHUNK_SIZE);
    }
    await expect(storage.getItem(KEY)).resolves.toBe(value);
  });

  it('não parte caracteres fora do plano básico no limite do pedaço', async () => {
    const { items, backend } = memoryBackend();
    const storage = createChunkedStorage(backend);
    const value = `${'a'.repeat(CHUNK_SIZE - 1)}💪🏛️${'é'.repeat(10)}`;
    await storage.setItem(KEY, value);
    for (const [key, part] of items) {
      if (key !== `${KEY}.n`) expect(part).not.toMatch(/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/);
    }
    await expect(storage.getItem(KEY)).resolves.toBe(value);
  });

  it('apaga pedaços que sobraram quando o valor diminui', async () => {
    const { items, backend } = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem(KEY, 'a'.repeat(CHUNK_SIZE * 4));
    await storage.setItem(KEY, 'curto');
    expect([...items.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.n`]);
    await expect(storage.getItem(KEY)).resolves.toBe('curto');
  });

  it('descarta o registro quando falta um pedaço', async () => {
    const { items, backend } = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem(KEY, 'a'.repeat(CHUNK_SIZE * 2 + 1));
    items.delete(`${KEY}.1`);
    await expect(storage.getItem(KEY)).resolves.toBeNull();
    expect(items.size).toBe(0);
  });

  it('descarta o registro quando a contagem é inválida', async () => {
    for (const count of ['0', 'abc', '1.5', '-1', '01', String(MAX_CHUNKS + 1)]) {
      const { items, backend } = memoryBackend();
      items.set(`${KEY}.n`, count);
      items.set(`${KEY}.0`, 'lixo');
      await expect(createChunkedStorage(backend).getItem(KEY)).resolves.toBeNull();
      expect(items.size).toBe(0);
    }
  });

  it('remove todos os pedaços', async () => {
    const { items, backend } = memoryBackend();
    const storage = createChunkedStorage(backend);
    await storage.setItem(KEY, 'a'.repeat(CHUNK_SIZE * 3));
    await storage.removeItem(KEY);
    expect(items.size).toBe(0);
    await expect(storage.getItem(KEY)).resolves.toBeNull();
  });

  it('recusa valores maiores que o limite de pedaços', async () => {
    const { items, backend } = memoryBackend();
    await expect(createChunkedStorage(backend).setItem(KEY, 'a'.repeat(CHUNK_SIZE * MAX_CHUNKS + 1))).rejects.toThrow(
      RangeError,
    );
    expect(items.size).toBe(0);
  });
});
