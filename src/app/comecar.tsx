import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, tapFeedback } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

function Choice({ icon, title, description, onPress }: { icon: IconName; title: string; description: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: colors.surface, borderColor: colors.hairline },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.choiceIcon, { borderColor: colors.hairline }]}>
        <Icon name={icon} size={26} color={colors.gold} />
      </View>
      <View style={styles.choiceText}>
        <AppText variant="subheading">{title}</AppText>
        <AppText variant="label" tone="secondary">{description}</AppText>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

/** 3º passo do primeiro acesso: fundar ou entrar em uma Legião, ou deixar para depois. */
export default function FirstLegionScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xxxl }]}>
      <AppText variant="overline" tone="muted">3 de 3</AppText>
      <View style={styles.header}>
        <AppText variant="title">Treine com sua Legião</AppText>
        <AppText variant="motto" tone="gold">A Arena é privada: só participa quem você convidar.</AppText>
      </View>

      <View style={styles.choices}>
        <Choice
          icon="legiao"
          title="Fundar uma Legião"
          description="Crie o grupo e convide seus amigos por link ou código."
          onPress={() => router.replace('/legioes/nova')}
        />
        <Choice
          icon="compartilhar"
          title="Entrar com código"
          description="Recebeu um convite? Digite o código da Legião."
          onPress={() => router.replace('/legioes/entrar')}
        />
      </View>

      <View style={styles.privacy}>
        <Icon name="escudo" size={16} color={colors.gold} />
        <AppText variant="label" tone="secondary">Nada é público. Você decide quem entra.</AppText>
      </View>

      <Button label="Fazer isso depois" variant="ghost" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  header: {
    gap: space.xs,
  },
  choices: {
    gap: space.md,
  },
  choice: {
    minHeight: touchTarget + 40,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  choiceIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  pressed: {
    opacity: 0.85,
  },
});
