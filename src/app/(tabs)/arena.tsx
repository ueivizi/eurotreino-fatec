import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmblemAvatar, type Laurel } from '@/components/rank/emblem-avatar';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { sampleLegion, sampleMe } from '@/data/sample';
import { computeStandings } from '@/features/arena/standings';
import { rankFromGlory } from '@/features/ranks/tiers';
import { formatRemaining, toRoman, weekInfo } from '@/lib/week';
import { useTheme } from '@/theme/theme';
import { fonts, space } from '@/theme/tokens';

const PODIUM: { position: 1 | 2 | 3; laurel: Laurel; pedestal: number; numeral: string; color: string }[] = [
  { position: 2, laurel: 'silver', pedestal: 64, numeral: 'II', color: '#C3C7CB' },
  { position: 1, laurel: 'gold', pedestal: 92, numeral: 'I', color: '#E6C878' },
  { position: 3, laurel: 'bronze', pedestal: 48, numeral: 'III', color: '#C98A55' },
];

export default function ArenaScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const week = weekInfo(new Date());
  const standings = computeStandings(sampleLegion);
  const podium = standings.slice(0, 3);
  const rest = standings.slice(3);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}>
      <View style={styles.header}>
        <AppText variant="title">Arena</AppText>
        <View style={styles.inline}>
          <Icon name="ampulheta" size={16} color={colors.gold} />
          <AppText variant="label" tone="secondary">{`termina em ${formatRemaining(week.remainingMs)}`}</AppText>
        </View>
      </View>
      <AppText variant="label" tone="muted">
        {`${sampleMe.legionName} · ${standings.length} membros · Semana ${toRoman(week.number)}`}
      </AppText>

      <View style={styles.podium} accessibilityRole="list" accessibilityLabel="Pódio da semana">
        {PODIUM.map((slot) => {
          const member = podium.find((m) => m.position === slot.position);
          if (!member) return <View key={slot.position} style={styles.podiumColumn} />;
          const rank = rankFromGlory(member.glory);
          return (
            <View
              key={member.id}
              style={styles.podiumColumn}
              accessible
              accessibilityLabel={`${slot.position}º lugar: ${member.name}, ${rank.label}, ${member.weekGlory} de Glória na semana`}>
              <EmblemAvatar emblem={member.emblem} size={slot.position === 1 ? 88 : 76} laurel={slot.laurel} />
              <AppText variant="bodyMedium" numberOfLines={1}>{member.isMe ? `${member.name} · você` : member.name}</AppText>
              <AppText variant="caption" tone="muted" numberOfLines={1}>{rank.label}</AppText>
              <AppText variant="heading" style={{ color: slot.color, fontFamily: fonts.bodySemibold }}>
                {String(member.weekGlory)}
              </AppText>
              <View style={[styles.pedestal, { height: slot.pedestal, borderTopColor: slot.color, backgroundColor: colors.surface }]}>
                <AppText variant="heading" style={{ color: slot.color, fontFamily: fonts.displayBold }}>{slot.numeral}</AppText>
              </View>
            </View>
          );
        })}
      </View>

      <View>
        {rest.map((member) => {
          const rank = rankFromGlory(member.glory);
          return (
            <View
              key={member.id}
              style={[styles.row, { borderBottomColor: colors.hairlineSoft }]}
              accessible
              accessibilityLabel={`${member.position}º lugar: ${member.name}, ${rank.label}, ${member.weekGlory} de Glória na semana`}>
              <AppText variant="bodyMedium" tone="muted" style={styles.position}>{String(member.position)}</AppText>
              <EmblemAvatar emblem={member.emblem} size={36} />
              <View style={styles.rowText}>
                <AppText variant="bodyMedium">{member.name}</AppText>
                <AppText variant="caption" tone="muted">{rank.label}</AppText>
              </View>
              <AppText variant="bodyMedium" tone="secondary" style={styles.position}>{String(member.weekGlory)}</AppText>
            </View>
          );
        })}
      </View>

      <View style={[styles.inline, styles.privacy]}>
        <Icon name="escudo" size={14} color={colors.gold} />
        <AppText variant="caption" tone="muted">{`Só membros da ${sampleMe.legionName} veem esta Arena.`}</AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl * 3,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    marginTop: space.md,
  },
  podiumColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  pedestal: {
    alignSelf: 'stretch',
    borderTopWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
  },
  position: {
    minWidth: 24,
    fontVariant: ['tabular-nums'],
  },
  rowText: {
    flex: 1,
  },
  privacy: {
    justifyContent: 'center',
    marginTop: space.sm,
  },
});
