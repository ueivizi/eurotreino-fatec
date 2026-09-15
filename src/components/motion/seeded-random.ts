/**
 * Gerador pseudoaleatório com semente (mulberry32), só para variar partículas decorativas.
 * Com a mesma semente, a mesma explosão se repete: dá para testar e comparar quadros.
 * Não serve para nada de segurança (códigos, tokens): para isso existe expo-crypto.
 */
export function seededRandom(seed: number): () => number {
  let state = Math.trunc(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Número entre `min` (inclusive) e `max` (exclusive). */
export function between(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}
