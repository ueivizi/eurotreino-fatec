// Gera assets/mapas/ciclovias-sp.json a partir do shapefile de infraestrutura cicloviária da CET.
//
//   node scripts/gerar-ciclovias.mjs <pasta-com-o-shapefile-descompactado>
//
// Fonte: Portal de Dados Abertos da Prefeitura de São Paulo, conjunto "Ciclovias" (CET),
// licença Creative Commons CC0: https://dados.prefeitura.sp.gov.br/dataset/ciclovias
// Arquivo: "ShapeFile Infra Estrutura" (shapesinfraestruturacicloviaria.zip). Os dados já vêm em
// WGS 84 (EPSG:4326), então não há reprojeção. Só entram vias prontas: os projetos
// (CicloviasConexoes) ficam de fora.
//
// Saída compacta, para caber no app: traçado simplificado (Douglas-Peucker, 3 m), coordenadas com
// 5 casas (~1 m) e só os campos que o mapa usa.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) {
  console.error('Uso: node scripts/gerar-ciclovias.mjs <pasta-com-o-shapefile>');
  process.exit(1);
}
const output = join(root, 'assets', 'mapas', 'ciclovias-sp.json');

const TOLERANCE_M = 3;
const DECIMALS = 5;
// Caixa da cidade de São Paulo com folga: um ponto fora dela é arquivo errado, não dado.
const BOUNDS = { minLng: -47.0, maxLng: -46.3, minLat: -24.1, maxLat: -23.3 };

/** dBase III: cabeçalho, descritores de campo e registros de largura fixa (texto em Latin-1). */
function readDbf(path) {
  const buf = readFileSync(path);
  const count = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields = [];
  for (let offset = 32; buf[offset] !== 0x0d; offset += 32) {
    fields.push({ name: buf.toString('latin1', offset, offset + 11).replace(/\0.*$/, ''), length: buf[offset + 16] });
  }
  const rows = [];
  for (let i = 0; i < count; i++) {
    let offset = headerLength + i * recordLength + 1;
    const row = {};
    for (const field of fields) {
      row[field.name] = buf.toString('latin1', offset, offset + field.length).trim();
      offset += field.length;
    }
    rows.push(row);
  }
  return rows;
}

/** Shapefile: só os tipos usados aqui (ponto e polilinha, com ou sem Z/M; Z e M são ignorados). */
function readShp(path) {
  const buf = readFileSync(path);
  const shapes = [];
  let offset = 100;
  while (offset + 8 <= buf.length) {
    const contentBytes = buf.readInt32BE(offset + 4) * 2;
    const start = offset + 8;
    const type = buf.readInt32LE(start);
    if (type === 0) {
      shapes.push(null);
    } else if (type === 1 || type === 11 || type === 21) {
      shapes.push({ kind: 'point', point: [buf.readDoubleLE(start + 4), buf.readDoubleLE(start + 12)] });
    } else if (type === 3 || type === 13 || type === 23) {
      const numParts = buf.readInt32LE(start + 36);
      const numPoints = buf.readInt32LE(start + 40);
      const parts = [];
      for (let p = 0; p < numParts; p++) parts.push(buf.readInt32LE(start + 44 + p * 4));
      const pointsAt = start + 44 + numParts * 4;
      const lines = parts.map((first, p) => {
        const last = p + 1 < numParts ? parts[p + 1] : numPoints;
        const line = [];
        for (let i = first; i < last; i++) line.push([buf.readDoubleLE(pointsAt + i * 16), buf.readDoubleLE(pointsAt + i * 16 + 8)]);
        return line;
      });
      shapes.push({ kind: 'line', lines });
    } else {
      throw new Error(`${path}: tipo de geometria ${type} não esperado`);
    }
    offset = start + contentBytes;
  }
  return shapes;
}

function inBounds([lng, lat]) {
  return lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng && lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat;
}

/** Distância de um ponto ao segmento, em metros, numa projeção plana local (basta para 3 m). */
function segmentDistanceM(p, a, b) {
  const k = Math.cos((a[1] * Math.PI) / 180);
  const toXY = ([lng, lat]) => [lng * 111320 * k, lat * 110540];
  const [px, py] = toXY(p);
  const [ax, ay] = toXY(a);
  const [bx, by] = toXY(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function simplify(line) {
  if (line.length <= 2) return line;
  const keep = new Array(line.length).fill(false);
  keep[0] = keep[line.length - 1] = true;
  const stack = [[0, line.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let farthest = -1;
    let max = 0;
    for (let i = first + 1; i < last; i++) {
      const distance = segmentDistanceM(line[i], line[first], line[last]);
      if (distance > max) {
        max = distance;
        farthest = i;
      }
    }
    if (farthest !== -1 && max > TOLERANCE_M) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

const round = (value) => Number(value.toFixed(DECIMALS));

function lineFeature(lines, properties) {
  const clean = lines
    .map((line) => simplify(line).map(([lng, lat]) => [round(lng), round(lat)]))
    .filter((line) => line.length >= 2);
  if (clean.length === 0) return null;
  for (const line of clean) for (const point of line) if (!inBounds(point)) throw new Error(`ponto fora de São Paulo: ${point}`);
  const geometry = clean.length === 1 ? { type: 'LineString', coordinates: clean[0] } : { type: 'MultiLineString', coordinates: clean };
  return { type: 'Feature', properties, geometry };
}

/** "CICLOFAIXA AFONSO LOPES VIEIRA" → tipo ciclofaixa, nome "Afonso Lopes Vieira". */
function titleCase(text) {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (index > 0 && small.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function wayKind(programa) {
  const first = programa.split(/\s+/)[0];
  if (first === 'CICLOFAIXA') return 'ciclofaixa';
  if (first === 'CICLOVIA' || first === 'CICLOPASSARELA') return 'ciclovia';
  if (first === 'CICLORROTA') return 'ciclorrota';
  throw new Error(`tipo de via desconhecido: ${programa}`);
}

function wayName(programa) {
  return titleCase(programa.replace(/^\S+\s*/, ''));
}

function readLayer(dir, name) {
  const rows = readDbf(join(dir, `${name}.dbf`));
  const shapes = readShp(join(dir, `${name}.shp`));
  if (rows.length !== shapes.length) throw new Error(`${name}: ${rows.length} registros e ${shapes.length} geometrias`);
  return rows.map((row, i) => ({ row, shape: shapes[i] }));
}

// A CET divide cada via em muitos trechos; no mapa, uma via é uma feição (tipo + nome).
const ways = new Map();
for (const name of ['Ciclovias', 'Ciclorrotas']) {
  for (const { row, shape } of readLayer(input, name)) {
    if (!shape || shape.kind !== 'line') continue;
    const tipo = wayKind(row.programa);
    const nome = wayName(row.programa);
    const key = `${tipo}|${nome}`;
    const way = ways.get(key) ?? { properties: { tipo, nome }, lines: [] };
    way.lines.push(...shape.lines);
    ways.set(key, way);
  }
}

const features = [];
let points = 0;
for (const way of ways.values()) {
  const feature = lineFeature(way.lines, way.properties);
  if (!feature) continue;
  points += feature.geometry.type === 'LineString' ? feature.geometry.coordinates.length : feature.geometry.coordinates.flat().length;
  features.push(feature);
}

for (const { row, shape } of readLayer(input, 'BicicletariosParaciclos')) {
  if (!shape || shape.kind !== 'point' || !inBounds(shape.point)) continue;
  const vagas = Number.parseInt(row.VAGAS, 10);
  features.push({
    type: 'Feature',
    properties: {
      tipo: row.EQUIPAMENT === 'BICICLETARIO' ? 'bicicletario' : 'paraciclo',
      nome: titleCase(row.LOCAL),
      ...(Number.isFinite(vagas) && vagas > 0 ? { vagas } : {}),
    },
    geometry: { type: 'Point', coordinates: shape.point.map(round) },
  });
}

const collection = {
  type: 'FeatureCollection',
  // Crédito exigido por boa prática (a CC0 não obriga, mas a fonte precisa ficar à vista).
  fonte: 'CET / Prefeitura de São Paulo — Portal de Dados Abertos (CC0)',
  features,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(collection)}\n`);
const kinds = {};
for (const feature of features) kinds[feature.properties.tipo] = (kinds[feature.properties.tipo] ?? 0) + 1;
console.log(`${output}: ${features.length} feições, ${points} pontos de traçado`, kinds);
