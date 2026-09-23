import type { TierId } from '@/features/ranks/tiers';

export type Motto = { latin: string; translation: string };

/**
 * Lema de cada Ascensão, sempre com tradução (identidade visual, seção 6).
 * O Recruta não tem: ninguém ascende para o primeiro rank.
 */
const MOTTOS: Record<Exclude<TierId, 1>, Motto> = {
  2: { latin: 'Festina lente', translation: 'Apressa-te devagar' },
  3: { latin: 'Labor omnia vincit', translation: 'O trabalho vence tudo' },
  4: { latin: 'Per aspera ad astra', translation: 'Por caminhos ásperos até as estrelas' },
  5: { latin: 'Mens sana in corpore sano', translation: 'Mente sã em corpo são' },
  6: { latin: 'Audentes fortuna iuvat', translation: 'A sorte favorece os audazes' },
  7: { latin: 'Sic itur ad astra', translation: 'Assim se vai às estrelas' },
};

export function mottoFor(tier: TierId): Motto | null {
  return tier === 1 ? null : MOTTOS[tier];
}

/** Lema da semana que recomeça: o Coliseu zera toda segunda, a Glória acumulada não. */
export const WEEK_RESTART_MOTTO: Motto = { latin: 'Festina lente', translation: 'Apressa-te devagar' };
