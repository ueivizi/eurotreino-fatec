import { TONE_TO_COLOR, type TextTone } from '@/components/ui/text';

import { palettes, type ThemeName } from './tokens';

/** Razão de contraste do WCAG 2.2 entre duas cores hexadecimais (#RRGGBB). */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const THEMES = Object.keys(palettes) as ThemeName[];
const TONES = (Object.keys(TONE_TO_COLOR) as TextTone[]).filter((tone) => tone !== 'onGold');

describe('contraste dos textos (NF003, WCAG 2.2 AA)', () => {
  it.each(THEMES)('todo tom de texto alcança 4,5:1 sobre os fundos do tema %s', (theme) => {
    const colors = palettes[theme];
    for (const tone of TONES) {
      for (const surface of [colors.background, colors.surface, colors.surfaceRaised]) {
        expect({ tone, surface, ratio: contrast(colors[TONE_TO_COLOR[tone]], surface) >= 4.5 }).toEqual({
          tone,
          surface,
          ratio: true,
        });
      }
    }
  });

  it.each(THEMES)('texto sobre o botão dourado alcança 4,5:1 no tema %s', (theme) => {
    const colors = palettes[theme];
    expect(contrast(colors.onGold, colors.gold)).toBeGreaterThanOrEqual(4.5);
  });
});
