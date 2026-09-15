import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { AppText } from '@/components/ui/text';
import { useSession } from '@/features/auth/session';
import type { LegalDocument } from '@/features/legal/documents';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/** Documento legal em texto corrido, legível com fonte ampliada. */
export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { state } = useSession();
  // Aberto antes de entrar (pelos Portões), voltar leva à entrada; rota protegida seria bloqueada.
  const fallbackHref = state.status === 'ready' ? '/perfil' : state.status === 'needs-profile' ? '/perfil-inicial' : '/entrar';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title={document.title} subtitle={`Atualizada em ${document.updatedAt}`} fallbackHref={fallbackHref} />
      <AppText tone="secondary">{document.intro}</AppText>

      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <AppText variant="subheading" accessibilityRole="header">{section.heading}</AppText>
          {section.items?.map((item) => (
            <View key={item} style={styles.item}>
              <AppText tone="gold" importantForAccessibility="no">·</AppText>
              <AppText tone="secondary" style={styles.flex}>{item}</AppText>
            </View>
          ))}
          {section.paragraphs?.map((paragraph) => (
            <AppText key={paragraph} tone="secondary">{paragraph}</AppText>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  section: {
    gap: space.sm,
  },
  item: {
    flexDirection: 'row',
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
});
