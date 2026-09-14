import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Notice } from '@/components/ui/notice';
import { AppText } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state, signOut } = useSession();

  if (state.status !== 'ready') return null;
  const { profile, email } = state;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}>
      <AppText variant="title">Perfil</AppText>

      <Card style={styles.identity}>
        <EmblemAvatar emblem={profile.emblem} size={56} />
        <View style={styles.identityText}>
          <AppText variant="heading" numberOfLines={1}>{profile.displayName}</AppText>
          {email ? (
            <AppText variant="caption" tone="muted" numberOfLines={1}>{email}</AppText>
          ) : null}
        </View>
      </Card>

      <Notice message="Rank e progresso, suas Legiões, as opções de privacidade e a exclusão da conta chegam nas próximas etapas da Onda 1." />

      <Button label="Sair" variant="secondary" onPress={() => void signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl * 3,
    gap: space.xl,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  identityText: {
    flex: 1,
    gap: space.xxs,
  },
});
