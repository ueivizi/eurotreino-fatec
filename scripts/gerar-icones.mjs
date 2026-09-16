// Gera os ícones do app a partir do monograma aprovado (mesma geometria de src/components/brand/monogram.tsx).
// Usa o Edge (Chromium) em modo headless só para rasterizar: nada disso roda no app.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Rode com `npm run gerar:icones`. O navegador serve só de rasterizador; troque o caminho abaixo
// pelo Chrome ou Edge da sua máquina (a variável NAVEGADOR tem prioridade).
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const edge = process.env.NAVEGADOR ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const fontPath = join(root, 'node_modules/@expo-google-fonts/cinzel/700Bold/Cinzel_700Bold.ttf');
const font = readFileSync(fontPath).toString('base64');
const work = mkdtempSync(join(tmpdir(), 'eurotreino-icones-'));

/** Folhas da coroa: mesmas 18 posições do componente do app. */
function leaves(gradient) {
  const items = [];
  for (let i = 0; i < 9; i += 1) {
    items.push(`rotate(${202 + i * 13} 66 66) translate(0 -54) rotate(-26 66 66)`);
    items.push(`rotate(${158 - i * 13} 66 66) translate(0 -54) rotate(26 66 66)`);
  }
  return items.map((t) => `<ellipse cx="66" cy="66" rx="4" ry="9" fill="${gradient}" transform="${t}" />`).join('');
}

function page({ size, background, scale, gold, flat }) {
  const mark = Math.round(size * scale);
  const fill = flat ? gold : 'url(#folha)';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Cinzel'; src: url(data:font/ttf;base64,${font}) format('truetype'); font-weight: 700; }
html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; background: ${background}; }
.mark { position: absolute; left: ${(size - mark) / 2}px; top: ${(size - mark) / 2}px; width: ${mark}px; height: ${mark}px; }
.letter { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: 'Cinzel'; font-weight: 700; font-size: ${Math.round(mark * 0.41)}px; line-height: 1; color: ${gold};
  /* o "E" da Cinzel assenta um pouco abaixo do centro óptico da coroa */
  padding-bottom: ${Math.round(mark * 0.015)}px; }
</style></head><body><div class="mark">
<svg width="${mark}" height="${mark}" viewBox="0 0 132 132"><defs>
<linearGradient id="folha" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E6C878"/><stop offset="1" stop-color="#A8842F"/></linearGradient>
</defs>${leaves(fill)}</svg>
<div class="letter">E</div></div></body></html>`;
}

const ONIX = '#0B0A08';
const GOLD = '#E6C878';

const targets = [
  // Ícone do app: o monograma cunhado no ônix.
  { file: 'assets/images/icon.png', size: 1024, background: ONIX, scale: 0.68, gold: GOLD },
  // Android adaptativo: a frente vive dentro da área segura (66%), por isso o monograma é menor.
  { file: 'assets/images/android-icon-foreground.png', size: 1024, background: 'transparent', scale: 0.52, gold: GOLD },
  { file: 'assets/images/android-icon-background.png', size: 1024, background: ONIX, scale: 0, gold: GOLD },
  // Monocromático (tema dinâmico do Android 13+): uma cor só, o sistema recolore.
  { file: 'assets/images/android-icon-monochrome.png', size: 1024, background: 'transparent', scale: 0.52, gold: '#FFFFFF', flat: true },
  // Splash: sobre o fundo ônix declarado no app.json.
  { file: 'assets/images/splash-icon.png', size: 512, background: 'transparent', scale: 0.92, gold: GOLD },
  { file: 'assets/images/favicon.png', size: 64, background: ONIX, scale: 0.8, gold: GOLD },
];

for (const target of targets) {
  const html = join(work, `${target.file.replace(/[/.]/g, '_')}.html`);
  writeFileSync(html, target.scale === 0 ? page({ ...target, scale: 0.0001 }) : page(target));
  execFileSync(edge, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=${target.size},${target.size}`,
    '--default-background-color=00000000',
    `--screenshot=${join(work, 'saida.png')}`,
    `file:///${html.replace(/\\/g, '/')}`,
  ], { stdio: 'ignore' });
  copyFileSync(join(work, 'saida.png'), join(root, target.file));
  console.log(`${target.file} ${target.size}x${target.size}`);
}

rmSync(work, { recursive: true, force: true });
