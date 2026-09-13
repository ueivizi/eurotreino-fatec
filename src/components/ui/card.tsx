import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

export function Card({ style, children, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.hairlineSoft,
          borderWidth: 1,
          borderRadius: radius.md,
          padding: space.lg,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
