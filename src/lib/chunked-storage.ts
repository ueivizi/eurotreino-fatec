/**
 * Guarda textos grandes em pedaços num armazenamento com limite por item.
 *
 * O SecureStore (Keychain no iOS, Keystore no Android) aceita com segurança até 2048 bytes por
 * item, e a sessão do Supabase passa disso. Cada pedaço tem no máximo 500 caracteres Unicode
 * (até 2000 bytes em UTF-8), e o corte nunca separa um caractere em dois.
 */

export type KeyValueBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const CHUNK_SIZE = 500;
export const MAX_CHUNKS = 32;

const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

function parseCount(raw: string | null): number | null {
  if (raw === null || !/^[1-9]\d?$/.test(raw)) return null;
  const count = Number(raw);
  return count <= MAX_CHUNKS ? count : null;
}

function split(value: string): string[] {
  const characters = Array.from(value);
  const chunks: string[] = [];
  for (let start = 0; start < characters.length; start += CHUNK_SIZE) {
    chunks.push(characters.slice(start, start + CHUNK_SIZE).join(''));
  }
  return chunks.length > 0 ? chunks : [''];
}

export function createChunkedStorage(backend: KeyValueBackend): KeyValueBackend {
  async function removeChunks(key: string, from: number, to: number) {
    for (let index = from; index < to; index += 1) {
      await backend.removeItem(chunkKey(key, index));
    }
  }

  async function removeAll(key: string, knownCount: number) {
    await backend.removeItem(countKey(key));
    await removeChunks(key, 0, knownCount);
  }

  return {
    async getItem(key) {
      const rawCount = await backend.getItem(countKey(key));
      if (rawCount === null) return null;

      const count = parseCount(rawCount);
      if (count === null) {
        // Registro corrompido: descarta tudo, e o usuário entra de novo (falha fechada).
        await removeAll(key, MAX_CHUNKS);
        return null;
      }

      const parts: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const part = await backend.getItem(chunkKey(key, index));
        if (part === null) {
          await removeAll(key, count);
          return null;
        }
        parts.push(part);
      }
      return parts.join('');
    },

    async setItem(key, value) {
      const chunks = split(value);
      if (chunks.length > MAX_CHUNKS) {
        throw new RangeError('Valor grande demais para o armazenamento seguro.');
      }

      const previousCount = parseCount(await backend.getItem(countKey(key))) ?? 0;
      for (let index = 0; index < chunks.length; index += 1) {
        await backend.setItem(chunkKey(key, index), chunks[index]);
      }
      await backend.setItem(countKey(key), String(chunks.length));
      await removeChunks(key, chunks.length, previousCount);
    },

    async removeItem(key) {
      const count = parseCount(await backend.getItem(countKey(key))) ?? MAX_CHUNKS;
      await removeAll(key, count);
    },
  };
}
