import { Pressable, StyleSheet, View } from 'react-native';

import { tapFeedback } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space, touchTarget } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  icon?: IconName;
  description?: string;
  tone?: 'primary' | 'danger';
};

/** Linha de lista que leva a outra tela: ícone, texto e seta. */
export function LinkRow({ label, onPress, icon, description, tone = 'primary' }: Props) {
  const { colors } = useTheme();
  const accent = tone === 'danger' ? colors.danger : colors.gold;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.hairlineSoft }, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={20} color={accent} /> : null}
      <View style={styles.text}>
        <AppText variant="bodyMedium" tone={tone === 'danger' ? 'danger' : 'primary'}>{label}</AppText>
        {description ? <AppText variant="caption" tone="muted">{description}</AppText> : null}
      </View>
      <Icon name="chevronRight" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
    paddingVertical: space.sm,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.85,
  },
});
