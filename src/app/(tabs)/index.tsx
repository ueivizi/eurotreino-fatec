import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { RankMedallion } from '@/components/rank/rank-medallion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { sampleLegion, sampleMe } from '@/data/sample';
import { computeStandings } from '@/features/arena/standings';
import { useProfile } from '@/features/auth/session';
import { rankFromGlory } from '@/features/ranks/tiers';
import { intensityLabel, workoutTypeLabel } from '@/features/workouts/workout-types';
import { formatRemaining, toRoman, weekInfo } from '@/lib/week';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfile();

  // Nome e emblema já vêm do perfil real; Glória e Arena seguem de exemplo até a integração das Legiões.
  const rank = rankFromGlory(sampleMe.glory);
  const week = weekInfo(new Date());
  const standings = computeStandings(sampleLegion);
  const me = standings.find((member) => member.isMe);
  const leader = standings[0];
  const last = sampleMe.lastWorkout;
  const lastLabel = `${workoutTypeLabel(last.type)} · ${last.minutes} min · ${intensityLabel(last.intensity)}`;

  if (!profile) return null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="overline" tone="muted">
            {`Semana ${toRoman(week.number)} · termina em ${formatRemaining(week.remainingMs)}`}
          </AppText>
          <AppText variant="title">{`Ave, ${profile.displayName}`}</AppText>
        </View>
        <EmblemAvatar emblem={profile.emblem} size={46} />
      </View>

      <View style={styles.rank}>
        <RankMedallion tier={rank.tierId} size={148} accessibilityLabel={`Seu rank: ${rank.label}`} />
        <AppText variant="heading">{rank.label}</AppText>
        <AppText tone="secondary" style={styles.tabular}>{`${rank.glory} de Glória`}</AppText>
      </View>

      <View style={styles.progress}>
        <ProgressBar
          value={rank.progress}
          accessibilityLabel={rank.next ? `Progresso até ${rank.next.label}` : 'Rank máximo alcançado'}
        />
        <View style={styles.progressLabels}>
          <AppText variant="caption" tone="muted" style={styles.tabular}>{`${rank.label} · ${rank.currentMin}`}</AppText>
          <AppText variant="caption" tone="secondary" style={styles.tabular}>
            {rank.next ? `Faltam ${rank.next.remaining} para ${rank.next.label}` : 'Você chegou ao Olimpo'}
          </AppText>
        </View>
      </View>

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <AppText variant="caption" tone="muted">Glória da semana</AppText>
          <AppText variant="stat" tone="goldHighlight">{String(sampleMe.weekGlory)}</AppText>
        </Card>
        <Card style={styles.stat}>
          <AppText variant="caption" tone="muted" numberOfLines={1}>{`Arena · ${sampleMe.legionName}`}</AppText>
          <AppText variant="stat">{me ? `${me.position}º` : '—'}</AppText>
          {me && leader && me.id !== leader.id ? (
            <AppText variant="caption" tone="secondary" style={styles.tabular}>
              {`${leader.weekGlory - me.weekGlory} atrás do ${leader.name}`}
            </AppText>
          ) : null}
        </Card>
      </View>

      <View style={styles.actions}>
        <Button label="Registrar treino" icon="registrar" onPress={() => router.push('/registrar')} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Repetir último treino: ${lastLabel}`}
          onPress={() => router.push('/registrar')}
          style={({ pressed }) => [styles.repeat, { borderColor: colors.hairline }, pressed && { opacity: 0.85 }]}>
          <Icon name="repetir" size={22} color={colors.gold} />
          <View style={styles.repeatText}>
            <AppText variant="bodyMedium">Repetir último</AppText>
            <AppText variant="label" tone="muted">{lastLabel}</AppText>
          </View>
          <Icon name="chevronRight" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl * 3,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: {
    flexShrink: 1,
    gap: space.xs,
  },
  rank: {
    alignItems: 'center',
    gap: space.xs,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  progress: {
    gap: space.sm,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: space.md,
  },
  stat: {
    flex: 1,
    gap: space.xs,
  },
  actions: {
    gap: space.md,
  },
  repeat: {
    minHeight: touchTarget + 16,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  repeatText: {
    flex: 1,
    gap: 2,
  },
});
