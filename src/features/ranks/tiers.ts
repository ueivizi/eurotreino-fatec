/**
 * Cursus Gloriae — "Da Legião ao Olimpo".
 * Espelha a tabela `rank_tiers` do banco. Quando o app estiver ligado ao
 * Supabase, a tabela do servidor passa a ser a fonte de verdade.
 */

export type TierId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type Division = 'III' | 'II' | 'I';

type Tier = {
  id: TierId;
  name: string;
  material: string;
  /** Glória mínima de cada divisão (III, II, I). O Olimpiano tem uma só. */
  thresholds: readonly number[];
};

export const TIERS: readonly Tier[] = [
  { id: 1, name: 'Recruta', material: 'Terracota', thresholds: [0, 35, 70] },
  { id: 2, name: 'Legionário', material: 'Bronze', thresholds: [100, 165, 230] },
  { id: 3, name: 'Centurião', material: 'Prata', thresholds: [300, 415, 530] },
  { id: 4, name: 'Gladiador', material: 'Ouro', thresholds: [650, 835, 1015] },
  { id: 5, name: 'Herói', material: 'Mármore e ouro', thresholds: [1200, 1465, 1735] },
  { id: 6, name: 'Semideus', material: 'Ônix e ouro', thresholds: [2000, 2500, 3000] },
  { id: 7, name: 'Olimpiano', material: 'Pórfiro e louros', thresholds: [3500] },
];

const DIVISIONS: readonly Division[] = ['III', 'II', 'I'];

type Step = { tier: Tier; division: Division | null; min: number };

const STEPS: readonly Step[] = TIERS.flatMap((tier) =>
  tier.thresholds.map((min, index) => ({
    tier,
    division: tier.thresholds.length > 1 ? DIVISIONS[index] : null,
    min,
  })),
);

export type RankProgress = {
  tierId: TierId;
  tierName: string;
  division: Division | null;
  /** Ex.: "Centurião II" ou "Olimpiano". */
  label: string;
  glory: number;
  /** Glória em que a divisão atual começa. */
  currentMin: number;
  /** Próxima divisão; `null` no topo (Olimpiano). */
  next: { label: string; min: number; remaining: number } | null;
  /** 0 a 1 dentro da divisão atual. */
  progress: number;
};

function labelOf(step: Step): string {
  return step.division ? `${step.tier.name} ${step.division}` : step.tier.name;
}

export function rankFromGlory(glory: number): RankProgress {
  if (!Number.isInteger(glory) || glory < 0) {
    throw new RangeError('A Glória deve ser um número inteiro não negativo.');
  }

  let index = 0;
  for (let i = 0; i < STEPS.length; i += 1) {
    if (STEPS[i].min <= glory) index = i;
  }

  const current = STEPS[index];
  const following = STEPS[index + 1];

  return {
    tierId: current.tier.id,
    tierName: current.tier.name,
    division: current.division,
    label: labelOf(current),
    glory,
    currentMin: current.min,
    next: following
      ? { label: labelOf(following), min: following.min, remaining: following.min - glory }
      : null,
    progress: following ? (glory - current.min) / (following.min - current.min) : 1,
  };
}
