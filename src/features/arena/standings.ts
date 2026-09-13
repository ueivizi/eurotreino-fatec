export type StandingInput = {
  id: string;
  name: string;
  weekGlory: number;
};

export type Standing<T extends StandingInput> = T & { position: number };

/**
 * Classificação da Arena por Glória da semana. Empates compartilham a posição
 * (1, 2, 2, 4...), e dentro do empate a ordem é alfabética só para exibir.
 * No app ligado ao servidor, a posição virá calculada pelo banco.
 */
export function computeStandings<T extends StandingInput>(members: readonly T[]): Standing<T>[] {
  const sorted = [...members].sort(
    (a, b) => b.weekGlory - a.weekGlory || a.name.localeCompare(b.name, 'pt-BR'),
  );

  let position = 0;
  let previousGlory: number | null = null;
  return sorted.map((member, index) => {
    if (member.weekGlory !== previousGlory) {
      position = index + 1;
      previousGlory = member.weekGlory;
    }
    return { ...member, position };
  });
}
