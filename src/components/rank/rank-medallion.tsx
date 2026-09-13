import Svg, { Circle, Defs, Ellipse, G, Path, RadialGradient, Stop } from 'react-native-svg';

import type { TierId } from '@/features/ranks/tiers';

type Material = {
  light: string;
  mid: string;
  dark: string;
  rim: string;
  beads: string;
  relief: string;
  veins?: boolean;
  laurel?: boolean;
  emblem: string;
};

const EMBLEMS = {
  scutum: 'M46 38 Q60 33 74 38 V78 Q60 86 46 78 Z M60 36 V83 M53 60 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0',
  gladii: 'M44 82 L74 40 M76 82 L46 40 M45 69 L55 76 M75 69 L65 76 M40 87 L45 80 M80 87 L75 80',
  helmet: 'M44 70 Q44 46 60 46 Q76 46 76 70 M44 70 L46 82 L52 82 L52 66 M76 70 L74 82 L68 82 L68 66 M44 62 H76 M60 62 V74 M38 46 Q60 24 82 46 M45 40 V36 M52 35 V31 M60 34 V29 M68 35 V31 M75 40 V36',
  colosseum: 'M40 80 H80 M40 64 H80 M42 48 H78 M44 80 V72 Q48 66 52 72 V80 M56 80 V72 Q60 66 64 72 V80 M68 80 V72 Q72 66 76 72 V80 M44 64 V57 Q48 51 52 57 V64 M56 64 V57 Q60 51 64 57 V64 M68 64 V57 Q72 51 76 57 V64 M40 48 V80 M80 48 V80 M45 44 H75',
  lion: 'M60 36 L65 41 L72 39 L73 46 L80 48 L77 55 L82 60 L77 65 L80 72 L73 74 L72 81 L65 79 L60 84 L55 79 L48 81 L47 74 L40 72 L43 65 L38 60 L43 55 L40 48 L47 46 L48 39 L55 41 Z M51 53 Q60 45 69 53 Q72 66 60 75 Q48 66 51 53 Z M54 57 L57 58 M66 57 L63 58 M60 61 V66 M56 69 Q60 72 64 69',
  wing: 'M40 78 Q44 50 80 38 Q72 47 74 51 Q63 53 65 59 Q55 61 57 67 Q48 69 50 75 Q45 76 40 78 Z M47 72 L63 56 M54 64 L72 46',
  temple: 'M40 54 L60 40 L80 54 Z M40 58 H80 M46 61 V78 M53 61 V78 M60 61 V78 M67 61 V78 M74 61 V78 M40 81 H80 M37 85 H83',
};

const MATERIALS: Record<TierId, Material> = {
  1: { light: '#E39A78', mid: '#B55A3C', dark: '#6E3320', rim: '#5E2A18', beads: '#6E3320', relief: '#4A1F10', emblem: EMBLEMS.scutum },
  2: { light: '#E8B27E', mid: '#A86B3C', dark: '#5E3A1E', rim: '#4E3018', beads: '#5E3A1E', relief: '#3E2610', emblem: EMBLEMS.gladii },
  3: { light: '#F4F6F8', mid: '#BFC3C7', dark: '#7A7F84', rim: '#6B7075', beads: '#6B7075', relief: '#3F4448', emblem: EMBLEMS.helmet },
  4: { light: '#FBEAB0', mid: '#D4AF37', dark: '#7A5A17', rim: '#6B4E14', beads: '#7A5A17', relief: '#5E4410', emblem: EMBLEMS.colosseum },
  5: { light: '#FFFFFF', mid: '#EDE8DF', dark: '#BDB6A8', rim: '#C9A24A', beads: '#C9A24A', relief: '#8A6A24', veins: true, emblem: EMBLEMS.lion },
  6: { light: '#4A4540', mid: '#1C1A18', dark: '#050505', rim: '#C9A24A', beads: '#8A6A24', relief: '#E6C878', emblem: EMBLEMS.wing },
  7: { light: '#9A5288', mid: '#5E2750', dark: '#2E1028', rim: '#C9A24A', beads: '#C9A24A', relief: '#E6C878', laurel: true, emblem: EMBLEMS.temple },
};

/** Folhas da coroa de louros do Olimpiano, abertas no topo. */
const LAUREL = Array.from({ length: 9 }, (_, i) => [
  `rotate(${200 + i * 14} 70 70) translate(0 -68) rotate(-24 70 70)`,
  `rotate(${160 - i * 14} 70 70) translate(0 -68) rotate(24 70 70)`,
]).flat();

type Props = {
  tier: TierId;
  size?: number;
  /** Rank ainda não conquistado: aparece como gravura, sem material. */
  locked?: boolean;
  accessibilityLabel: string;
};

export function RankMedallion({ tier, size = 140, locked = false, accessibilityLabel }: Props) {
  const material = MATERIALS[tier];
  const gradientId = `medalha-${tier}`;
  const engraving = 'rgba(201,162,74,0.32)';

  return (
    <Svg width={size} height={size} viewBox="-14 -14 168 168" accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {locked ? (
        <G>
          <Circle cx={70} cy={70} r={60} fill="none" stroke={engraving} strokeWidth={1.5} />
          <Circle cx={70} cy={70} r={51} fill="none" stroke={engraving} strokeWidth={2.2} strokeDasharray="0.1 5.4" strokeLinecap="round" />
          <G transform="translate(10 10)">
            <Path d={material.emblem} fill="none" stroke={engraving} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        </G>
      ) : (
        <G>
          <Defs>
            <RadialGradient id={gradientId} cx="36%" cy="30%" r="80%">
              <Stop offset="0" stopColor={material.light} />
              <Stop offset="0.52" stopColor={material.mid} />
              <Stop offset="1" stopColor={material.dark} />
            </RadialGradient>
          </Defs>
          {material.laurel
            ? LAUREL.map((transform) => <Ellipse key={transform} cx={70} cy={70} rx={3.4} ry={8} fill="#D9B55A" transform={transform} />)
            : null}
          <Circle cx={70} cy={70} r={62} fill={material.rim} />
          <Circle cx={70} cy={70} r={57} fill={`url(#${gradientId})`} />
          {material.veins ? (
            <Path d="M22 58 Q44 66 62 54 T118 72 M30 92 Q52 86 70 98 T112 94" fill="none" stroke="#C9A24A" strokeWidth={1.1} opacity={0.75} />
          ) : null}
          <Circle cx={70} cy={70} r={51} fill="none" stroke={material.beads} strokeWidth={2.6} strokeDasharray="0.1 5.4" strokeLinecap="round" />
          <G transform="translate(10 10)">
            <Path d={material.emblem} fill="none" stroke={material.relief} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        </G>
      )}
    </Svg>
  );
}
