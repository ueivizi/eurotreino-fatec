import { Easing } from 'react-native-reanimated';

/**
 * Tokens de movimento — "cerimônia contida".
 * Rápido no uso diário, solene só nas conquistas confirmadas pelo servidor.
 * Especificação completa em docs/design/movimento.md.
 */

export const duration = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 360,
  reveal: 520,
  ceremony: 1200,
} as const;

export const easing = {
  /** Entradas: começa rápido e pousa devagar. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Saídas: acelera para fora. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** Loops suaves (halo, brilho). */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

export const spring = {
  /** Botões e chips ao pressionar. */
  press: { damping: 20, stiffness: 400, mass: 1 },
  /** Seleção, ícone ativo, carimbo. */
  pop: { damping: 13, stiffness: 190, mass: 1 },
  /** Indicadores deslizando, reordenação de listas. */
  settle: { damping: 22, stiffness: 150, mass: 1 },
  /** Medalha balançando na fita até parar. */
  pendulum: { damping: 3.5, stiffness: 38, mass: 1 },
} as const;

export const stagger = {
  step: 45,
  /** A partir daqui, os itens entram juntos: cascata longa cansa. */
  max: 8,
} as const;

/** Atraso de entrada do item `index` numa cascata. */
export function staggerDelay(index: number, base = 0): number {
  const safe = Number.isInteger(index) && index > 0 ? Math.min(index, stagger.max) : 0;
  return base + safe * stagger.step;
}
