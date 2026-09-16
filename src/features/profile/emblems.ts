/**
 * Emblemas usados no lugar de foto (perfil) e no estandarte da Legião.
 * O banco aceita exatamente esta lista (private.is_valid_emblem); o teste de sincronia
 * do banco falha se as duas divergirem.
 */
export const EMBLEMS = [
  'aguia',
  'loba',
  'leao',
  'coruja',
  'pegaso',
  'tridente',
  'raio',
  'elmo',
  'touro',
  'serpente',
  'fenix',
  'lira',
] as const;

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
  touro: 'Touro',
  serpente: 'Serpente',
  fenix: 'Fênix',
  lira: 'Lira',
};

export function isEmblemName(value: string): value is EmblemName {
  return (EMBLEMS as readonly string[]).includes(value);
}

/**
 * Cor do emblema: materiais da identidade, não um seletor livre de cor. Cada tom tem uma versão
 * para Ônix e outra para Mármore, porque o mesmo ouro que brilha no escuro some no claro.
 * A lista é fechada e igual à do banco (private.is_valid_emblem_color).
 */
export const EMBLEM_COLORS = ['ouro', 'bronze', 'prata', 'porfiro', 'oliva', 'terracota'] as const;

export type EmblemColor = (typeof EMBLEM_COLORS)[number];

export const EMBLEM_COLOR_LABELS: Record<EmblemColor, string> = {
  ouro: 'Ouro',
  bronze: 'Bronze',
  prata: 'Prata',
  porfiro: 'Pórfiro',
  oliva: 'Oliva',
  terracota: 'Terracota',
};

export const EMBLEM_COLOR_TONES: Record<EmblemColor, { onix: string; marmore: string }> = {
  ouro: { onix: '#E6C878', marmore: '#8A6A24' },
  bronze: { onix: '#C98A55', marmore: '#8C5A2B' },
  prata: { onix: '#C3C7CB', marmore: '#5C6368' },
  porfiro: { onix: '#C08BB2', marmore: '#5E2750' },
  oliva: { onix: '#A7B86A', marmore: '#4F5F26' },
  terracota: { onix: '#D98B72', marmore: '#9E3F2A' },
};

export const DEFAULT_EMBLEM_COLOR: EmblemColor = 'ouro';

export function isEmblemColor(value: unknown): value is EmblemColor {
  return typeof value === 'string' && (EMBLEM_COLORS as readonly string[]).includes(value);
}
