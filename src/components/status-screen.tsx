import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type Action = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' };

type Props = {
  icon: IconName;
  title: string;
  description: string;
  actions?: Action[];
};

/** Tela de estado (erro, indisponibilidade) com ações claras. */
export function StatusScreen({ icon, title, description, actions = [] }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxxl * 2 }]}>
      <View style={[styles.circle, { borderColor: colors.hairline }]}>
        <Icon name={icon} size={40} color={colors.gold} />
      </View>
      <AppText variant="heading" style={styles.center}>{title}</AppText>
      <AppText tone="secondary" style={styles.center}>{description}</AppText>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Button key={action.label} label={action.label} onPress={action.onPress} variant={action.variant ?? 'primary'} />
        ))}
      </View>
    </ScrollView>
  );
}

export function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]} accessibilityLabel="Carregando" accessibilityRole="progressbar">
      <ActivityIndicator color={colors.gold} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    alignItems: 'center',
    gap: space.md,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  center: {
    textAlign: 'center',
    maxWidth: 340,
  },
  actions: {
    alignSelf: 'stretch',
    gap: space.md,
    marginTop: space.xl,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
