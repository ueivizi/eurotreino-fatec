import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankMedallion } from '@/components/rank/rank-medallion';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AppText } from '@/components/ui/text';
import { takePendingInvite } from '@/features/legions/pending-invite';
import { SCORING } from '@/features/ranks/scoring';
import { TIERS } from '@/features/ranks/tiers';
import { toRoman } from '@/lib/week';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

const RULES = [
  { value: `+${SCORING.presence}`, title: 'Presença', description: 'A cada treino registrado' },
  {
    value: '+1',
    title: 'Duração',
    description: `A cada ${SCORING.minutesPerPoint} minutos, até +${SCORING.maxDurationPoints}`,
  },
  {
    value: `+${SCORING.intensity.intenso}`,
    title: 'Intensidade',
    description: `Intenso +${SCORING.intensity.intenso} · moderado +${SCORING.intensity.moderado} · leve +${SCORING.intensity.leve}`,
  },
  {
    value: `+${SCORING.weeklyBonus}`,
    title: 'Constância',
    description: `No ${SCORING.weeklyBonusAt}º treino pontuado da semana`,
  },
] as const;

/** Como conquistar Glória: 2º passo do primeiro acesso e explicação sempre disponível no Perfil. */
export default function GloryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ primeiro?: string }>();
  const onboarding = params.primeiro === '1';

  function next() {
    // Convite aberto antes do login tem prioridade: a pessoa já sabe em qual Legião quer entrar.
    const code = takePendingInvite();
    if (code) router.replace({ pathname: '/legioes/entrar', params: { codigo: code } });
    else router.replace('/comecar');
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      {onboarding ? (
        <AppText variant="overline" tone="muted" style={styles.step}>2 de 3</AppText>
      ) : (
        <ScreenHeader title="Glória" subtitle="Como a pontuação funciona" />
      )}

      <View style={styles.header}>
        <AppText variant="title">Como conquistar Glória</AppText>
        <AppText variant="motto" tone="gold">Cada treino conta. A constância conta mais.</AppText>
      </View>

      <View style={styles.rules}>
        {RULES.map((rule) => (
          <Card key={rule.title} style={styles.rule} accessible accessibilityLabel={`${rule.title}: ${rule.value}. ${rule.description}.`}>
            <AppText variant="heading" style={[styles.ruleValue, { color: colors.goldHighlight }]}>{rule.value}</AppText>
            <View style={styles.ruleText}>
              <AppText variant="bodyMedium">{rule.title}</AppText>
              <AppText variant="caption" tone="secondary">{rule.description}</AppText>
            </View>
          </Card>
        ))}
      </View>

      <AppText variant="label" tone="secondary">
        {`Até ${SCORING.maxScoredPerDay} treinos pontuam por dia. Esqueceu de registrar? Dá para lançar até ${SCORING.lateLogHours} horas depois.`}
      </AppText>

      <View style={styles.ladder}>
        <AppText variant="overline" tone="muted">Da Legião ao Olimpo</AppText>
        <View style={styles.medals} accessibilityRole="list">
          {TIERS.map((tier) => (
            <View key={tier.id} style={styles.medal}>
              <RankMedallion tier={tier.id} size={42} accessibilityLabel={tier.name} />
              <AppText variant="caption" tone="muted">{toRoman(tier.id)}</AppText>
            </View>
          ))}
        </View>
        <AppText variant="label" tone="secondary">A Glória acumulada define seu rank e nunca diminui.</AppText>
      </View>

      <AppText variant="caption" tone="muted">
        A Glória é calculada no servidor, com a mesma regra para todos. No Coliseu, a disputa recomeça toda segunda-feira.
      </AppText>

      {onboarding ? (
        <Button label="Continuar" onPress={next} />
      ) : (
        <Button label="Ver todos os ranks" variant="secondary" onPress={() => router.push('/ranks')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  step: {
    marginTop: space.md,
  },
  header: {
    gap: space.xs,
  },
  rules: {
    gap: space.sm,
  },
  rule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingVertical: space.md,
  },
  ruleValue: {
    minWidth: 52,
    textAlign: 'center',
  },
  ruleText: {
    flex: 1,
    gap: 2,
  },
  ladder: {
    gap: space.sm,
  },
  medals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  medal: {
    alignItems: 'center',
    gap: 2,
  },
});
