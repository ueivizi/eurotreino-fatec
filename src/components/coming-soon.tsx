import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type Props = {
  title: string;
  icon: IconName;
  description: string;
};

/** Tela provisória para as abas que ainda serão implementadas na Onda 1. */
export function ComingSoon({ title, icon, description }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}>
      <AppText variant="title">{title}</AppText>
      <View style={styles.body}>
        <View style={[styles.circle, { borderColor: colors.hairline }]}>
          <Icon name={icon} size={40} color={colors.gold} />
        </View>
        <AppText variant="subheading" style={styles.center}>Em construção</AppText>
        <AppText tone="secondary" style={styles.center}>{description}</AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl * 3,
    gap: space.xxl,
  },
  body: {
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xxxl,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    textAlign: 'center',
    maxWidth: 320,
  },
});
