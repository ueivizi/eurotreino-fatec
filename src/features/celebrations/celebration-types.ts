import type { EmblemColor, EmblemName } from '@/features/profile/emblems';
import type { TierId } from '@/features/ranks/tiers';

/** Próxima divisão, para a frase "Faltam N para X". */
export type NextStep = { label: string; min: number; remaining: number } | null;

/** Linha do mini ranking da cena do Coliseu: posição antes e depois do treino. */
export type ArenaStanding = {
  userId: string;
  displayName: string;
  emblem: EmblemName;
  emblemColor: EmblemColor;
  isMe: boolean;
  beforePlace: number;
  afterPlace: number;
  weekGlory: number;
};

/**
 * Conquistas que viram cerimônia. Só entram aqui fatos confirmados pelo servidor:
 * nada celebra reenvio, treino sem pontos ou posição perdida.
 */
export type Celebration =
  | {
      kind: 'ascension';
      fromTier: TierId;
      toTier: TierId;
      /** Nome do novo rank com a divisão (ex.: "Gladiador III"). */
      label: string;
      tierName: string;
      division: string | null;
      glory: number;
      next: NextStep;
    }
  | {
      kind: 'division';
      tier: TierId;
      fromDivision: string;
      division: string;
      label: string;
      glory: number;
      next: NextStep;
    }
  | {
      kind: 'arena';
      legionId: string;
      legionName: string;
      fromPlace: number;
      toPlace: number;
      /** Quem ficou para trás, do mais próximo ao mais distante. */
      passed: string[];
      standings: ArenaStanding[];
      emblem: EmblemName;
  emblemColor: EmblemColor;
    }
  | { kind: 'constancy'; bonus: number; weekGlory: number }
  | { kind: 'first-workout' }
  | { kind: 'medal'; title: string; description: string }
  | { kind: 'record'; exercise: string; previous: number; current: number; unit: 'kg' };

export type CelebrationKind = Celebration['kind'];
