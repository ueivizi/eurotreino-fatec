/**
 * Tokens da identidade "Ônix & Ouro".
 * Todo par de texto/fundo daqui foi medido pelo WCAG 2.2 (mínimo 4,5:1).
 */

export type ThemeName = 'onix' | 'marmore';

export type Palette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  tabBar: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  gold: string;
  /** Ouro para texto: no Mármore o ouro de preenchimento não alcança 4,5:1 sobre o fundo claro. */
  goldText: string;
  goldHighlight: string;
  goldDeep: string;
  onGold: string;
  porphyry: string;
  porphyryText: string;
  success: string;
  danger: string;
  hairline: string;
  hairlineSoft: string;
  hairlineStrong: string;
  track: string;
  selectedFill: string;
  scrim: string;
};

export const palettes: Record<ThemeName, Palette> = {
  onix: {
    background: '#0B0A08',
    surface: '#15120E',
    surfaceRaised: '#1E1A14',
    tabBar: '#0F0D0A',
    text: '#F3ECDD',
    textSecondary: '#CFC5B2',
    textMuted: '#8F8676',
    gold: '#C9A24A',
    goldText: '#C9A24A',
    goldHighlight: '#E6C878',
    goldDeep: '#8A6A24',
    onGold: '#0B0A08',
    porphyry: '#5E2750',
    porphyryText: '#C08BB2',
    success: '#7C8F3E',
    danger: '#D2664C',
    hairline: 'rgba(201,162,74,0.35)',
    hairlineSoft: 'rgba(201,162,74,0.22)',
    hairlineStrong: 'rgba(201,162,74,0.55)',
    track: '#2A241B',
    selectedFill: 'rgba(201,162,74,0.14)',
    scrim: 'rgba(5,4,3,0.55)',
  },
  marmore: {
    background: '#F6F1E7',
    surface: '#FFFDF8',
    surfaceRaised: '#FFFDF8',
    tabBar: '#FFFDF8',
    text: '#1B1712',
    textSecondary: '#5A5044',
    textMuted: '#5A5044',
    gold: '#B8913A',
    goldText: '#7A5A17',
    goldHighlight: '#7A5A17',
    goldDeep: '#7A5A17',
    onGold: '#1B1712',
    porphyry: '#5E2750',
    porphyryText: '#5E2750',
    success: '#55662A',
    danger: '#9E3F2A',
    hairline: 'rgba(184,145,58,0.45)',
    hairlineSoft: 'rgba(184,145,58,0.30)',
    hairlineStrong: 'rgba(184,145,58,0.65)',
    track: '#E3DCCF',
    selectedFill: 'rgba(184,145,58,0.16)',
    scrim: 'rgba(27,23,18,0.45)',
  },
};

/** Gradiente "ouro folheado": só no CTA principal, no rank e no pódio. */
export const goldGradient = {
  colors: ['#8A6A24', '#C9A24A', '#E6C878', '#C9A24A', '#8A6A24'] as const,
  locations: [0, 0.38, 0.5, 0.62, 1] as const,
};

export const fonts = {
  display: 'Cinzel_600SemiBold',
  displayBold: 'Cinzel_700Bold',
  motto: 'CormorantGaramond_500Medium_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

/** Grid de 4pt. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 2,
  md: 4,
  sheet: 12,
  full: 999,
} as const;

/** Alvo de toque mínimo: 48 atende 44 pt (iOS) e 48 dp (Android). */
export const touchTarget = 48;
