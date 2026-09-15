import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';

import { Halo } from '@/components/motion/halo';
import { LaurelCrown, type LaurelTone } from '@/components/motion/laurel-crown';
import { Reveal } from '@/components/motion/reveal';
import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { RollingNumber } from '@/components/motion/rolling-number';
import { Sparks } from '@/components/motion/sparks';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { AppText } from '@/components/ui/text';
import * as haptics from '@/lib/haptics';
import { spring } from '@/theme/motion';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import type { ArenaStanding, Celebration } from '../celebration-types';

import { Overline, RippleRing } from './ceremony-parts';
import { SceneFrame } from './scene-frame';

const ROW = 56;
const PODIUM_TONES: Record<number, LaurelTone> = { 1: 'gold', 2: 'silver', 3: 'bronze' };

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const head = shown.slice(0, -1).join(', ');
  const last = shown[shown.length - 1];
  return rest > 0 ? `${shown.join(', ')} e mais ${rest}` : `${head} e ${last}`;
}

function StandingRow({ row, from, to, delay }: { row: ArenaStanding; from: number; to: number; delay: number }) {
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  const y = useSharedValue(reduced ? to * ROW : from * ROW);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    y.set(withDelay(delay, withSpring(to * ROW, spring.settle)));
    if (row.isMe) {
      // A sua linha "sobe" um pouco à frente das outras enquanto troca de lugar.
      lift.set(withDelay(delay, withSpring(1, spring.pop, () => {
        'worklet';
        lift.set(withSpring(0, spring.settle));
      })));
    }
    return () => {
      cancelAnimation(y);
      cancelAnimation(lift);
    };
  }, [reduced, delay, to, row.isMe, y, lift]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }, { scale: 1 + lift.get() * 0.035 }],
  }));

  return (
    <Animated.View
      style={[
        styles.row,
        {
          zIndex: row.isMe ? 2 : 1,
          backgroundColor: row.isMe ? colors.selectedFill : colors.surface,
          borderColor: row.isMe ? colors.gold : colors.hairlineSoft,
        },
        style,
      ]}>
      <RollingNumber
        value={row.afterPlace}
        from={row.beforePlace}
        suffix="º"
        variant="bodyMedium"
        tone={row.isMe ? 'goldHighlight' : 'muted'}
        delay={delay}
        containerStyle={styles.place}
      />
      <EmblemAvatar emblem={row.emblem} size={34} />
      <AppText variant="bodyMedium" numberOfLines={1} style={styles.name}>
        {row.isMe ? `${row.displayName} · você` : row.displayName}
      </AppText>
      <AppText variant="bodyMedium" tone={row.isMe ? 'goldHighlight' : 'secondary'} style={styles.tabular}>
        {String(row.weekGlory)}
      </AppText>
    </Animated.View>
  );
}

/** Mini ranking: as linhas começam na ordem de antes e trocam de lugar com mola. */
function MiniStandings({ standings, delay }: { standings: readonly ArenaStanding[]; delay: number }) {
  const before = [...standings].sort((a, b) => a.beforePlace - b.beforePlace || Number(a.isMe) - Number(b.isMe));
  const after = [...standings].sort((a, b) => a.afterPlace - b.afterPlace || Number(b.isMe) - Number(a.isMe));
  return (
    <View style={[styles.standings, { height: ROW * standings.length }]} accessibilityRole="list">
      {standings.map((row) => (
        <StandingRow
          key={row.userId}
          row={row}
          from={before.findIndex((item) => item.userId === row.userId)}
          to={after.findIndex((item) => item.userId === row.userId)}
          delay={delay}
        />
      ))}
    </View>
  );
}

type Props = { celebration: Extract<Celebration, { kind: 'arena' }>; onContinue: () => void };

/** Subiu na Arena. Entrar no pódio vira cerimônia com louros; subir fora dele, um cartão. */
export function ArenaScene({ celebration, onContinue }: Props) {
  const router = useRouter();
  const reduced = useReducedMotionPreference();
  const podium = celebration.toPlace <= 3;
  const tone = PODIUM_TONES[celebration.toPlace];
  const passedLine = `Você passou ${joinNames(celebration.passed)}.`;

  useEffect(() => {
    const timer = setTimeout(() => (podium ? haptics.ceremony() : haptics.success()), reduced ? 0 : 620);
    return () => {
      clearTimeout(timer);
      haptics.cancelCeremony();
    };
  }, [podium, reduced]);

  const actions = [
    {
      label: 'Ver Arena',
      onPress: () => {
        onContinue();
        router.navigate({ pathname: '/arena', params: { legiao: celebration.legionId } });
      },
    },
    { label: 'Continuar', onPress: onContinue, variant: 'ghost' as const },
  ];

  const announcement = `${celebration.toPlace}º lugar na Arena da ${celebration.legionName}. ${passedLine}`;

  if (!podium || !tone) {
    return (
      <SceneFrame layout="card" announcement={announcement} onSkip={onContinue} actions={actions} actionsDelay={1100}>
        <Reveal>
          <AppText variant="overline" tone="gold" style={styles.center} numberOfLines={1}>
            {`Arena · ${celebration.legionName}`}
          </AppText>
        </Reveal>
        <View style={styles.titleRow}>
          <AppText variant="heading">Você subiu para </AppText>
          <RollingNumber value={celebration.toPlace} from={celebration.fromPlace} suffix="º" variant="heading" tone="goldHighlight" delay={520} />
        </View>
        <MiniStandings standings={celebration.standings} delay={520} />
        <Reveal delay={900}>
          <AppText tone="secondary" style={styles.center}>
            {passedLine}
          </AppText>
        </Reveal>
      </SceneFrame>
    );
  }

  return (
    <SceneFrame layout="full" announcement={announcement} onSkip={onContinue} actions={actions} actionsDelay={1700}>
      <Overline text={celebration.toPlace === 1 ? 'LIDERANÇA' : 'PÓDIO'} delay={900} />
      <View style={styles.stage}>
        <Halo size={300} strength={0.3} style={{ top: -60, left: -60 }} />
        <RippleRing size={150} delay={640} />
        <Sparks size={320} count={30} seed={celebration.toPlace * 17} delay={640} style={{ top: -70, left: -70 }} />
        <LaurelCrown size={180} tone={tone} delay={560} />
        <EmblemAvatar emblem={celebration.emblem} size={112} />
      </View>
      <RollingNumber
        value={celebration.toPlace}
        from={celebration.fromPlace}
        suffix="º lugar"
        variant="display"
        tone="goldHighlight"
        delay={520}
      />
      <Reveal delay={1000}>
        <AppText variant="subheading" tone="secondary" style={styles.center}>
          {celebration.legionName}
        </AppText>
      </Reveal>
      <Reveal delay={1100} style={styles.fullStandings}>
        <MiniStandings standings={celebration.standings} delay={1250} />
      </Reveal>
      <Reveal delay={1450}>
        <AppText tone="secondary" style={styles.center}>
          {passedLine}
        </AppText>
      </Reveal>
    </SceneFrame>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stage: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space.sm,
  },
  standings: {
    alignSelf: 'stretch',
    marginTop: space.sm,
  },
  fullStandings: {
    alignSelf: 'stretch',
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: ROW - 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  place: {
    minWidth: 30,
  },
  name: {
    flex: 1,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
