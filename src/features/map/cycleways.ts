import type { ThemeName } from '@/theme/tokens';

/**
 * Ciclovias no mapa, de duas fontes que se completam:
 *
 * - **OpenStreetMap** (no próprio mapa base, no mundo todo): as vias só de bicicleta.
 * - **CET / Prefeitura de São Paulo** (Portal de Dados Abertos, licença CC0): a rede oficial da
 *   cidade, com o que o mapa base não separa — ciclofaixa pintada na rua, ciclorrota e bicicletário.
 *   O arquivo vem de `scripts/gerar-ciclovias.mjs` e vai dentro do app: nada é pedido a servidor.
 */
export type CycleKind = 'ciclovia' | 'ciclofaixa' | 'ciclorrota' | 'bicicletario';

export const CYCLE_LEGEND: readonly { id: CycleKind; label: string; hint: string }[] = [
  { id: 'ciclovia', label: 'Ciclovia', hint: 'Separada dos carros' },
  { id: 'ciclofaixa', label: 'Ciclofaixa', hint: 'Faixa pintada na rua' },
  { id: 'ciclorrota', label: 'Ciclorrota', hint: 'Rua sinalizada, dividida com os carros' },
  { id: 'bicicletario', label: 'Bicicletário', hint: 'Onde deixar a bike' },
];

export const CET_CREDIT = 'Ciclovias de SP: CET/Prefeitura (dados abertos)';

/** Cores das vias: verdes e azuis, longe do ouro que marca as rotas da pessoa. */
export const CYCLE_COLORS: Record<ThemeName, Record<CycleKind, string>> = {
  onix: { ciclovia: '#5FD08A', ciclofaixa: '#4FB3E0', ciclorrota: '#8FB8D6', bicicletario: '#5FD08A' },
  marmore: { ciclovia: '#1E8A4C', ciclofaixa: '#1B6FA8', ciclorrota: '#4F7A99', bicicletario: '#1E8A4C' },
};

/** Propriedades de cada feição: `tipo` (ciclovia, ciclofaixa, ciclorrota, bicicletario, paraciclo), `nome` e `vagas`. */
export type CyclewayCollection = GeoJSON.FeatureCollection;

let cached: CyclewayCollection | null = null;

/**
 * A rede de São Paulo (~350 KB) só é carregada quando o mapa pede: o resto do app não paga por ela.
 */
export function saoPauloCycleways(): CyclewayCollection {
  if (!cached) {
    cached = require('../../../assets/mapas/ciclovias-sp.json') as CyclewayCollection;
  }
  return cached;
}

const KIND_LABELS: Record<string, string> = {
  ciclovia: 'Ciclovia',
  ciclofaixa: 'Ciclofaixa',
  ciclorrota: 'Ciclorrota',
  bicicletario: 'Bicicletário',
  paraciclo: 'Paraciclo',
};

/** Rótulo de uma via ou vaga tocada no mapa ("Ciclofaixa Afonso Lopes Vieira"), ou nulo. */
export function cyclewayLabel(properties: unknown): string | null {
  if (typeof properties !== 'object' || properties === null) return null;
  const { tipo, nome } = properties as Record<string, unknown>;
  const kind = typeof tipo === 'string' ? KIND_LABELS[tipo] : undefined;
  if (!kind) return null;
  const name = typeof nome === 'string' ? nome.trim().slice(0, 80) : '';
  return name ? `${kind} ${name}` : kind;
}
