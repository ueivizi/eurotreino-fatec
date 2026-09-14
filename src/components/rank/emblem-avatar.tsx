import { View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import { Icon } from '@/components/ui/icon';
import type { EmblemName } from '@/features/profile/emblems';
import { useTheme } from '@/theme/theme';

export type Laurel = 'gold' | 'silver' | 'bronze';

const LAUREL_COLORS: Record<Laurel, { leaf: string; rim: string }> = {
  gold: { leaf: '#D9B55A', rim: '#E6C878' },
  silver: { leaf: '#B9BDC1', rim: '#C3C7CB' },
  bronze: { leaf: '#B97A48', rim: '#C98A55' },
};

const LEAVES = Array.from({ length: 7 }, (_, i) => [
  `rotate(${204 + i * 15} 50 50) translate(0 -42) rotate(-24 50 50)`,
  `rotate(${156 - i * 15} 50 50) translate(0 -42) rotate(24 50 50)`,
]).flat();

type Props = {
  emblem: EmblemName;
  size?: number;
  /** Louros do pódio da Arena (1º, 2º e 3º lugares). */
  laurel?: Laurel;
};

export function EmblemAvatar({ emblem, size = 48, laurel }: Props) {
  const { colors } = useTheme();
  const rim = laurel ? LAUREL_COLORS[laurel].rim : colors.hairline;
  const inner = laurel ? size * 0.64 : size;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {laurel ? (
        <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', pointerEvents: 'none' }}>
          {LEAVES.map((transform) => (
            <Ellipse key={transform} cx={50} cy={50} rx={3.2} ry={7} fill={LAUREL_COLORS[laurel].leaf} transform={transform} />
          ))}
        </Svg>
      ) : null}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          borderWidth: 1.5,
          borderColor: rim,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={emblem} size={Math.round(inner * 0.5)} color={laurel ? rim : colors.textSecondary} />
      </View>
    </View>
  );
}
