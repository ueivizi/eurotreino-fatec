import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space, touchTarget } from '@/theme/tokens';

type Props = {
  title: string;
  subtitle?: string;
};

/** Cabeçalho das telas empilhadas sobre as abas, com voltar sempre visível. */
export function ScreenHeader({ title, subtitle }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.back}>
        <Icon name="chevronLeft" size={24} color={colors.gold} />
      </Pressable>
      <View style={styles.text}>
        <AppText variant="heading" numberOfLines={1} accessibilityRole="header">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>{subtitle}</AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginLeft: -space.md,
  },
  back: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: space.xxs,
  },
});
