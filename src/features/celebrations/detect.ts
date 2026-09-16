import type { RankingEntry } from '@/features/arena/arena-parsers';
import { rankFromGlory } from '@/features/ranks/tiers';
import type { LoggedWorkout } from '@/features/workouts/workouts-parsers';

import type { ArenaStanding, Celebration, CelebrationKind } from './celebration-types';

/** Ranking de uma Legião antes e depois do treino. */
export type ArenaSnapshot = {
  legionId: string;
  legionName: string;
  before: readonly RankingEntry[];
  after: readonly RankingEntry[];
};

export type WorkoutOutcome = {
  result: LoggedWorkout;
  /** Treinos registrados antes deste; `null` quando o app ainda não sabia. */
  previousTotalWorkouts: number | null;
  arenas: readonly ArenaSnapshot[];
};

/** Ordem da fila: a conquista maior abre a sequência. */
const PRIORITY: Record<CelebrationKind, number> = {
  ascension: 0,
  division: 1,
  arena: 2,
  constancy: 3,
  'first-workout': 4,
  medal: 5,
  record: 6,
};

/** Quantas pessoas ultrapassadas aparecem no mini ranking, além de você. */
const MAX_PASSED_ROWS = 3;

function arenaCelebration(snapshot: ArenaSnapshot): Extract<Celebration, { kind: 'arena' }> | null {
  const meBefore = snapshot.before.find((entry) => entry.isMe);
  const meAfter = snapshot.after.find((entry) => entry.isMe);
  if (!meBefore || !meAfter || meAfter.userId !== meBefore.userId) return null;
  if (meAfter.place >= meBefore.place) return null;

  const afterById = new Map(snapshot.after.map((entry) => [entry.userId, entry]));
  // Ultrapassar é estar à frente antes e atrás depois. Empatar não conta.
  const passedEntries = snapshot.before
    .filter((entry) => !entry.isMe && entry.place < meBefore.place)
    .filter((entry) => {
      const later = afterById.get(entry.userId);
      return later !== undefined && later.place > meAfter.place;
    })
    .sort((a, b) => b.place - a.place);

  if (passedEntries.length === 0) return null;

  const shown = passedEntries.slice(0, MAX_PASSED_ROWS);
  const standings: ArenaStanding[] = [...shown, meBefore].map((entry) => {
    const later = afterById.get(entry.userId) ?? entry;
    return {
      userId: entry.userId,
      displayName: entry.displayName,
      emblem: entry.emblem,
      emblemColor: entry.emblemColor,
      isMe: entry.isMe,
      beforePlace: entry.place,
      afterPlace: later.place,
      weekGlory: later.weekGlory,
    };
  });

  return {
    kind: 'arena',
    legionId: snapshot.legionId,
    legionName: snapshot.legionName,
    fromPlace: meBefore.place,
    toPlace: meAfter.place,
    passed: passedEntries.map((entry) => entry.displayName),
    standings,
    emblem: meAfter.emblem,
    emblemColor: meAfter.emblemColor,
  };
}

/** Entre várias Legiões, uma cena só: a melhor posição final; no empate, o maior salto. */
function bestArena(snapshots: readonly ArenaSnapshot[]) {
  let best: Extract<Celebration, { kind: 'arena' }> | null = null;
  for (const snapshot of snapshots) {
    const candidate = arenaCelebration(snapshot);
    if (!candidate) continue;
    if (
      !best ||
      candidate.toPlace < best.toPlace ||
      (candidate.toPlace === best.toPlace && candidate.fromPlace - candidate.toPlace > best.fromPlace - best.toPlace)
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Conquistas de um treino recém-registrado, na ordem em que as cerimônias tocam. */
export function celebrationsForWorkout({ result, previousTotalWorkouts, arenas }: WorkoutOutcome): Celebration[] {
  if (result.replayed || !result.isScored || result.points <= 0) return [];

  const celebrations: Celebration[] = [];
  const before = rankFromGlory(Math.max(0, result.totalGlory - result.points));
  const after = rankFromGlory(result.totalGlory);

  if (after.tierId > before.tierId) {
    celebrations.push({
      kind: 'ascension',
      fromTier: before.tierId,
      toTier: after.tierId,
      label: after.label,
      tierName: after.tierName,
      division: after.division,
      glory: after.glory,
      next: after.next,
    });
  } else if (after.tierId === before.tierId && after.label !== before.label && before.division && after.division) {
    celebrations.push({
      kind: 'division',
      tier: after.tierId,
      fromDivision: before.division,
      division: after.division,
      label: after.label,
      glory: after.glory,
      next: after.next,
    });
  }

  const arena = bestArena(arenas);
  if (arena) celebrations.push(arena);

  if (result.bonus > 0) {
    celebrations.push({ kind: 'constancy', bonus: result.bonus, weekGlory: result.weekGlory });
  }

  if (previousTotalWorkouts === 0) celebrations.push({ kind: 'first-workout' });

  return celebrations.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind]);
}
