import Svg, { Path } from 'react-native-svg';

/** Ícones de traço 1,5 px em grade de 24 — os mesmos do design system. */
const PATHS = {
  inicio: 'M4 10 L12 4 L20 10 M6.5 10 V19 M10 10 V19 M14 10 V19 M17.5 10 V19 M3 21 H21',
  arena: 'M8 20 Q3 13 7.5 4.5 M16 20 Q21 13 16.5 4.5 M6.2 16 L3.6 15.2 M5.6 12 L3 11 M6.4 8 L4.4 6.3 M17.8 16 L20.4 15.2 M18.4 12 L21 11 M17.6 8 L19.6 6.3',
  registrar: 'M6.5 8 V16 M9.5 6 V18 M14.5 6 V18 M17.5 8 V16 M9.5 12 H14.5 M3.5 10.5 V13.5 M20.5 10.5 V13.5',
  legiao: 'M12 2.5 V21.5 M6 5.5 H18 V14 L12 17 L6 14 Z',
  perfil: 'M5 16 Q5 6.5 12 6.5 Q19 6.5 19 16 M5 16 H9 V20 M19 16 H15 V20 M12 6.5 V3 M5 12.5 H19',
  chevronRight: 'M9 6 L15 12 L9 18',
  chevronLeft: 'M15 5 L8 12 L15 19',
  chevronDown: 'M6 9 L12 15 L18 9',
  repetir: 'M17 2 L21 6 L17 10 M3 11 V9.5 Q3 6 6.5 6 H21 M7 22 L3 18 L7 14 M21 13 V14.5 Q21 18 17.5 18 H3',
  escudo: 'M12 3 L19 6 V11 Q19 17 12 21 Q5 17 5 11 V6 Z',
  ampulheta: 'M6 3 H18 M6 21 H18 M7 3 Q7 9 12 12 Q17 9 17 3 M7 21 Q7 15 12 12 Q17 15 17 21',
  check: 'M5 12.5 L10 17 L19 7.5',
  compartilhar: 'M12 3 V15 M7.5 7.5 L12 3 L16.5 7.5 M5 12 V20 H19 V12',
  copiar: 'M8.5 8.5 H19.5 V20.5 H8.5 Z M5 15.5 V3.5 H15.5',
  fechar: 'M6 6 L18 18 M18 6 L6 18',
  mais: 'M6 12 H18 M12 6 V18',
  menos: 'M6 12 H18',
  info: 'M3 12 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M12 11 V16.5 M12 7.5 L12.01 7.5',
  // Tipos de treino
  musculacao: 'M6.5 8 V16 M9.5 6 V18 M14.5 6 V18 M17.5 8 V16 M9.5 12 H14.5 M3.5 10.5 V13.5 M20.5 10.5 V13.5',
  corrida: 'M12.4 4.5 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0 M13 8 L10 12 L13.5 14.5 L12 20 M10 12 L6.5 13.5 M13 8 L16.5 10.5 L19 9.5 M13.5 14.5 L17 17',
  caminhada: 'M8 3.5 Q10.5 4 10 8 Q9.5 11 7.5 11 Q5.5 10.5 6 7 Q6.5 3.5 8 3.5 Z M7 13 H9.5 V15 H7 Z M16 9.5 Q18.5 10 18 14 Q17.5 17 15.5 17 Q13.5 16.5 14 13 Q14.5 9.5 16 9.5 Z M15 19 H17.5 V21 H15 Z',
  bike: 'M2.5 16 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0 M14.5 16 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0 M6 16 L10 9 H15.5 L18 16 M10 9 L12.5 16 L15.5 9 M9 6.5 H11.5 M15.5 9 L15 6.5 H17',
  natacao: 'M3 17 Q5.5 15 8 17 T13 17 T18 17 T21 16 M3 20.5 Q5.5 18.5 8 20.5 T13 20.5 T18 20.5 M8 12.5 L12 9 L15.5 11.5 M16 6.5 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0',
  funcional: 'M8.5 9 Q8.5 4 12 4 Q15.5 4 15.5 9 M6 20 Q4.5 14 8 10.5 H16 Q19.5 14 18 20 Z',
  esporte: 'M3 12 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M12 3 Q8 12 12 21 M3.5 9.5 Q12 13 20.5 9.5',
  yoga: 'M10.4 4.5 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0 M12 8 V14 M12 10 L7 12.5 M12 10 L17 12.5 M4 18.5 Q12 13.5 20 18.5 M8 14 L5 18.5 M16 14 L19 18.5',
  outro: 'M3 12 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M12 8 V16 M8 12 H16',
  // Emblemas
  aguia: 'M3 9 Q8 6.5 12 10.5 Q16 6.5 21 9 Q17.5 13.5 12 13 Q6.5 13.5 3 9 Z M12 13 V18.5 M10 18.5 H14',
  loba: 'M5 4 L9.5 8.5 H14.5 L19 4 V12.5 Q19 18.5 12 21 Q5 18.5 5 12.5 Z M9 12.5 L10.5 13.5 M15 12.5 L13.5 13.5 M10.5 17 L12 18 L13.5 17',
  leao: 'M12 2.5 L14 5 L17 4 L17.5 7 L20.5 8 L19 11 L21 13.5 L18.5 15 L19 18 L16 18 L14.5 21 L12 19.5 L9.5 21 L8 18 L5 18 L5.5 15 L3 13.5 L5 11 L3.5 8 L6.5 7 L7 4 L10 5 Z M9 10.5 Q12 8 15 10.5 Q15.5 14.5 12 16.5 Q8.5 14.5 9 10.5 Z',
  coruja: 'M7 9 Q7 4 12 4 Q17 4 17 9 V15 Q17 20 12 20 Q7 20 7 15 Z M8 10 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M12 10 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0 M11 14 L12 15.5 L13 14',
  pegaso: 'M4 19 Q6 9 20 5 Q16 9.5 17 11 Q12.5 12 13.5 14.5 Q9 15.5 10 18 Q7 18.5 4 19 Z',
  tridente: 'M12 21 V5 M7 4 V9 Q7 12 12 12 Q17 12 17 9 V4 M12 5 L10.5 7 M12 5 L13.5 7',
  raio: 'M13 3 L6 13 H11 L10 21 L18 10 H13 Z',
  elmo: 'M5 16 Q5 6.5 12 6.5 Q19 6.5 19 16 M5 16 H9 V20 M19 16 H15 V20 M12 6.5 V3 M5 12.5 H19',
} as const;

export type IconName = keyof typeof PATHS;

type Props = {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
};

export function Icon({ name, color, size = 24, strokeWidth = 1.5 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={PATHS[name]} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
