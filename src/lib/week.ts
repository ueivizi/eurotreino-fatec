/**
 * Semana da Arena: de segunda 00:00 a domingo 23:59 no horário de Brasília.
 *
 * O Brasil não tem horário de verão desde 2019, então Brasília é UTC−3 fixo.
 * Serve só para exibição (número da semana e contagem regressiva): a semana em
 * que cada treino conta é calculada no servidor.
 */

const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WeekInfo = {
  /** Número ISO da semana (1 a 53). */
  number: number;
  /** Fim da semana (próxima segunda 00:00 em Brasília), em UTC. */
  endsAt: Date;
  /** Milissegundos até o fim da semana. */
  remainingMs: number;
};

export function weekInfo(now: Date): WeekInfo {
  const time = now.getTime();
  if (Number.isNaN(time)) throw new RangeError('Data inválida.');

  // "Relógio de Brasília" representado com os campos UTC de uma Date deslocada.
  const local = new Date(time + BRASILIA_OFFSET_MS);
  const isoWeekday = local.getUTCDay() === 0 ? 7 : local.getUTCDay();

  const mondayLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - (isoWeekday - 1) * DAY_MS;
  const endsAt = new Date(mondayLocal + 7 * DAY_MS - BRASILIA_OFFSET_MS);

  // Semana ISO: a semana que contém a quinta-feira.
  const thursday = new Date(mondayLocal + 3 * DAY_MS);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  const number = Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;

  return { number, endsAt, remainingMs: endsAt.getTime() - time };
}

/** "2d 5h", "5h 12min" ou "12min". */
export function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

const ROMAN: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function toRoman(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999) {
    throw new RangeError('Numerais romanos só vão de 1 a 3999.');
  }
  let rest = value;
  let out = '';
  for (const [amount, symbol] of ROMAN) {
    while (rest >= amount) {
      out += symbol;
      rest -= amount;
    }
  }
  return out;
}
