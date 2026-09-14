import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import { Icon } from './icon';
import { AppText } from './text';

type Props = {
  message: string;
  tone?: 'info' | 'danger';
};

/** Aviso em linha, anunciado pelo leitor de tela assim que aparece. */
export function Notice({ message, tone = 'info' }: Props) {
  const { colors } = useTheme();
  const accent = tone === 'danger' ? colors.danger : colors.gold;
  return (
    <View style={[styles.notice, { borderColor: tone === 'danger' ? colors.danger : colors.hairline }]} accessibilityRole="alert">
      <Icon name="info" size={18} color={accent} />
      <AppText variant="label" tone={tone === 'danger' ? 'primary' : 'secondary'} style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  text: {
    flex: 1,
  },
});
