import type { ModalityRecord } from '@/features/workouts/records-api';

import type { HonorEntry } from './strength-api';

export type ModalityRow = { type: string; honor: HonorEntry | null; record: ModalityRecord | null };

/**
 * Uma linha por modalidade, com a Honra e os recordes juntos (quadro 6.5 · Honra e recordes).
 * Primeiro as modalidades com Honra, na ordem do servidor; depois as que só têm recordes.
 */
export function modalityRows(honor: readonly HonorEntry[], records: readonly ModalityRecord[]): ModalityRow[] {
  const recordOf = new Map(records.map((record) => [record.type as string, record]));
  const rows: ModalityRow[] = honor
    .filter((entry) => entry.exerciseId === null && entry.workoutType !== null)
    .map((entry) => ({ type: entry.workoutType as string, honor: entry, record: recordOf.get(entry.workoutType as string) ?? null }));
  const seen = new Set(rows.map((row) => row.type));
  for (const record of records) {
    if (!seen.has(record.type)) rows.push({ type: record.type, honor: null, record });
  }
  return rows;
}
