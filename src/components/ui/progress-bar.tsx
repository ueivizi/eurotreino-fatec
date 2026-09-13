import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { useTheme } from '@/theme/theme';

type Props = {
  /** De 0 a 1. Valores fora disso (ou inválidos) são limitados. */
  value: number;
  accessibilityLabel: string;
};

export function ProgressBar({ value, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(clamped * 100);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden' }}>
      <LinearGradient
        colors={[colors.goldDeep, colors.gold, colors.goldHighlight]}
        locations={[0, 0.7, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: `${percent}%`, height: '100%' }}
      />
    </View>
  );
}
