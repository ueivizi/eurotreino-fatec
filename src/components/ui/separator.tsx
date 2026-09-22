import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/theme';

/**
 * Filete entre seções. Existe para que nenhuma tela precise escolher a cor da linha: o tema
 * escolhe, e o Mármore não herda o ouro do Ônix (era o que acontecia no resultado do registro,
 * com a cor escrita à mão no estilo).
 */
export function Separator({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[styles.line, { backgroundColor: colors.hairlineSoft }, style]} />;
}

const styles = StyleSheet.create({
  line: {
    height: 1,
  },
});
