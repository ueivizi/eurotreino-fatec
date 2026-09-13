import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/theme';
import { goldGradient, radius, space, touchTarget } from '@/theme/tokens';

import { Icon, type IconName } from './icon';
import { AppText, type TextTone } from './text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  accessibilityHint?: string;
};

export function tapFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
    // O retorno tátil é opcional: aparelhos sem motor de vibração rejeitam a chamada e o fluxo segue igual.
  });
}

export function Button({ label, onPress, variant = 'primary', icon, disabled = false, accessibilityHint }: Props) {
  const { colors } = useTheme();
  const showGradient = variant === 'primary' && !disabled;

  const tone: TextTone = disabled
    ? 'muted'
    : variant === 'primary'
      ? 'onGold'
      : variant === 'ghost'
        ? 'gold'
        : variant === 'danger'
          ? 'danger'
          : 'primary';
  const iconColor = disabled ? colors.textMuted : variant === 'primary' ? colors.onGold : variant === 'danger' ? colors.danger : colors.gold;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && { borderWidth: 1, borderColor: colors.hairlineStrong },
        variant === 'danger' && { borderWidth: 1, borderColor: colors.danger },
        disabled && variant !== 'ghost' && { backgroundColor: colors.track, borderColor: colors.track },
        pressed && !disabled && styles.pressed,
      ]}>
      {showGradient ? (
        <LinearGradient
          colors={goldGradient.colors}
          locations={goldGradient.locations}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={styles.content}>
        {icon ? <Icon name={icon} size={20} color={iconColor} strokeWidth={variant === 'primary' ? 1.8 : 1.5} /> : null}
        <AppText variant={variant === 'primary' ? 'button' : 'bodyMedium'} tone={tone}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget + 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  primary: {
    minHeight: 56,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
