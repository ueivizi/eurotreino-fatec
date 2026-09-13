import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tapFeedback } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { goldGradient, space, touchTarget } from '@/theme/tokens';

type TabButtonProps = TabTriggerSlotProps & { label: string; icon: IconName };

function TabButton({ isFocused, label, icon, ...props }: TabButtonProps) {
  const { colors } = useTheme();
  const color = isFocused ? colors.goldHighlight : colors.textMuted;
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}>
      <Icon name={icon} size={24} color={color} />
      <AppText variant="caption" style={{ color, fontSize: 11 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function RegisterButton() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Registrar treino"
      onPress={() => {
        tapFeedback();
        router.push('/registrar');
      }}
      style={styles.tab}>
      <View style={[styles.medallion, { borderColor: colors.tabBar }]}>
        <LinearGradient
          colors={goldGradient.colors}
          locations={goldGradient.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* zIndex explícito: na Web o gradiente absoluto seria pintado por cima do SVG. */}
        <View style={styles.medallionIcon}>
          <Icon name="registrar" size={26} color={colors.onGold} strokeWidth={1.8} />
        </View>
      </View>
      <AppText variant="caption" tone="gold" style={{ fontSize: 11 }}>
        Registrar
      </AppText>
    </Pressable>
  );
}

/** Barra de abas com o medalhão central de registro (fluxo de 3 toques). */
export function TabBar() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.tabBar, borderTopColor: colors.hairlineSoft, paddingBottom: Math.max(insets.bottom, space.sm) },
      ]}>
      <TabTrigger name="inicio" asChild>
        <TabButton label="Início" icon="inicio" />
      </TabTrigger>
      <TabTrigger name="arena" asChild>
        <TabButton label="Arena" icon="arena" />
      </TabTrigger>
      <RegisterButton />
      <TabTrigger name="legiao" asChild>
        <TabButton label="Legião" icon="legiao" />
      </TabTrigger>
      <TabTrigger name="perfil" asChild>
        <TabButton label="Perfil" icon="perfil" />
      </TabTrigger>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: space.sm,
  },
  tab: {
    flex: 1,
    minHeight: touchTarget,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space.xs,
  },
  medallion: {
    width: 60,
    height: 60,
    marginTop: -30,
    borderRadius: 30,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionIcon: {
    position: 'relative',
    zIndex: 1,
  },
});
