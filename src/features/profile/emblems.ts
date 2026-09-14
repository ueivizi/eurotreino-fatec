/**
 * Emblemas usados no lugar de foto (perfil) e no estandarte da Legião.
 * O banco aceita exatamente esta lista (private.is_valid_emblem); o teste de sincronia
 * do banco falha se as duas divergirem.
 */
export const EMBLEMS = ['aguia', 'loba', 'leao', 'coruja', 'pegaso', 'tridente', 'raio', 'elmo'] as const;

export type EmblemName = (typeof EMBLEMS)[number];

export const EMBLEM_LABELS: Record<EmblemName, string> = {
  aguia: 'Águia',
  loba: 'Loba',
  leao: 'Leão',
  coruja: 'Coruja',
  pegaso: 'Pégaso',
  tridente: 'Tridente',
  raio: 'Raio',
  elmo: 'Elmo',
};

export function isEmblemName(value: string): value is EmblemName {
  return (EMBLEMS as readonly string[]).includes(value);
}
