/**
 * Validação das respostas do servidor. Os tipos gerados pelo Supabase dizem o que o banco deveria
 * devolver (e marcam como obrigatórios campos que podem vir nulos); aqui conferimos o que chegou.
 * Qualquer campo fora do formato invalida a resposta inteira (`null`).
 */

export type Row = Record<string, unknown>;

export function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function isNonEmptyText(value: unknown, maxLength = 200): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

/** Lista em que todos os itens precisam ser válidos. */
export function parseList<T>(value: unknown, parseItem: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items: T[] = [];
  for (const item of value) {
    const parsed = parseItem(item);
    if (parsed === null) return null;
    items.push(parsed);
  }
  return items;
}

/** RPCs que devolvem uma tabela chegam como lista; as de linha única precisam ter exatamente uma. */
export function singleRow(value: unknown): Row | null {
  return Array.isArray(value) && value.length === 1 && isRow(value[0]) ? value[0] : null;
}
