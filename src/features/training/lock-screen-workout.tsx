import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Monogram } from '@/components/brand/monogram';
import { Halo } from '@/components/motion/halo';
import { PressableScale } from '@/components/motion/pressable-scale';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { NumberField } from '@/components/ui/number-field';
import { AppText } from '@/components/ui/text';
import { formatLoad } from '@/features/workouts/metrics';
import { LOAD, workoutModule, workoutTypeLabel } from '@/features/workouts/workout-types';
import { toRoman } from '@/lib/week';
import { useTheme } from '@/theme/theme';
import { goldGradient, radius, space, touchTarget } from '@/theme/tokens';

import { LOCK_SCREEN_AVAILABLE, requestUnlock, useDeviceLocked } from './lock-card-native';
import { canAddSet, elapsedMs, focusForItem, formatElapsed, remainingSets, setsOf, type Session } from './session';
import { useTrainingSession } from './session-provider';

const REPS = { min: 1, max: 100, step: 1 } as const;

/**
 * Treino sobre a tela bloqueada. Com uma sessão aberta, apertar o botão de ligar mostra este cartão
 * por cima do bloqueio, sem desbloquear: relógio, exercício, série e os botões do treino, grandes.
 *
 * Enquanto o aparelho está bloqueado, ele cobre o app inteiro e o botão de voltar não passa: quem
 * pega o celular bloqueado mexe só no treino. Para o resto, "Desbloquear" pede a digital ou o PIN.
 */
export function LockScreenWorkout() {
  const { current } = useTrainingSession();
  const locked = useDeviceLocked();
  if (!LOCK_SCREEN_AVAILABLE || !locked || !current) return null;
  return <LockedSession session={current} />;
}

function LockedSession({ session }: { session: Session }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const training = useTrainingSession();
  const [now, setNow] = useState(() => new Date());
  const [closed, setClosed] = useState<string | null>(null);

  // O relógio anda de segundo em segundo, só enquanto o treino corre.
  useEffect(() => {
    if (session.pausedAt) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [session.pausedAt]);

  // Bloqueado, o voltar não leva a outra tela do app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!closed) return;
    const timer = setTimeout(() => setClosed(null), 1600);
    return () => clearTimeout(timer);
  }, [closed]);

  // Sessão sem foco (a ficha ainda não escolheu): o primeiro exercício com séries por fazer assume.
  const firstOpen = session.plan.find((item) => canAddSet(session, item.exerciseId)) ?? session.plan[0] ?? null;
  const needsFocus = session.focus === null && firstOpen !== null;
  const applyFocus = training.setFocus;
  useEffect(() => {
    if (needsFocus && firstOpen) void applyFocus(focusForItem(session, firstOpen));
  }, [applyFocus, needsFocus, firstOpen, session]);

  const kind = workoutModule(session.workoutType);
  const heading = session.routineName ?? workoutTypeLabel(session.workoutType);
  const focus = session.focus;
  const item = focus ? session.plan.find((entry) => entry.exerciseId === focus.exerciseId) ?? null : null;
  const done = focus ? setsOf(session, focus.exerciseId).length : 0;
  const target = item?.targetSets ?? null;
  const canMark = focus !== null && canAddSet(session, focus.exerciseId);
  const allDone = focus !== null && remainingSets(session, focus.exerciseId) === 0;
  const cardWidth = Math.min(width - space.xl * 2, 400);

  return (
    <View style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.background }]} accessibilityViewIsModal>
      <Halo size={cardWidth * 1.4} strength={0.18} style={{ top: '18%', left: (width - cardWidth * 1.4) / 2 }} />

      <View style={styles.header}>
        <Monogram size={44} />
        <View style={styles.headerText}>
          <AppText variant="overline" tone="gold">EuroTreino · treino em andamento</AppText>
          <View style={styles.inline}>
            <Icon name="cadeado" size={14} color={colors.textMuted} />
            <AppText variant="caption" tone="muted">Tela bloqueada: só o treino fica à mão</AppText>
          </View>
        </View>
      </View>

      <Reveal style={[styles.card, { width: cardWidth, backgroundColor: colors.surfaceRaised, borderColor: colors.gold }]}>
        <View style={styles.cardTop}>
          <AppText variant="overline" tone="muted" numberOfLines={1} style={styles.flex}>
            {session.pausedAt ? `${heading} · pausado` : heading}
          </AppText>
          <AppText variant="heading" tone="goldHighlight" style={styles.tabular} accessibilityLabel={`Tempo de treino: ${formatElapsed(elapsedMs(session, now))}`}>
            {formatElapsed(elapsedMs(session, now))}
          </AppText>
        </View>

        {kind === 'forca' && focus ? (
          <>
            <View style={styles.block}>
              <AppText variant="subheading" numberOfLines={2}>{focus.exerciseName}</AppText>
              <AppText variant="bodyMedium" tone="gold">
                {allDone ? 'Séries completas' : target ? `Série ${toRoman(done + 1)} de ${toRoman(target)}` : `Série ${toRoman(done + 1)}`}
              </AppText>
              {target ? (
                <View style={styles.series} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {Array.from({ length: target }, (_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.serie,
                        { borderColor: index < done ? colors.gold : colors.hairlineSoft, backgroundColor: index < done ? colors.selectedFill : 'transparent' },
                      ]}>
                      <AppText variant="label" tone={index < done ? 'goldHighlight' : 'muted'}>{toRoman(index + 1)}</AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.block}>
              <AppText variant="caption" tone="muted">Repetições</AppText>
              <NumberField
                label="Repetições"
                value={focus.reps}
                onChange={(next) => void training.setFocus({ ...focus, reps: next })}
                min={REPS.min}
                max={REPS.max}
                step={REPS.step}
                format={(next) => String(next)}
                fill
              />
              <AppText variant="caption" tone="muted">Carga</AppText>
              <NumberField
                label="Carga"
                value={focus.loadKg ?? 0}
                onChange={(next) => void training.setFocus({ ...focus, loadKg: next > 0 ? next : null })}
                min={0}
                max={LOAD.max}
                step={LOAD.step}
                format={(next) => (next > 0 ? formatLoad(next) : 'Livre')}
                decimals
                fill
              />
            </View>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={canMark ? `Marcar série de ${focus.exerciseName}` : 'Séries completas'}
              accessibilityState={{ disabled: !canMark }}
              disabled={!canMark}
              haptic="tap"
              onPress={() => {
                const name = focus.exerciseName;
                void training.markSet().then(({ completed }) => {
                  if (completed) setClosed(name);
                });
              }}
              style={[styles.primary, { borderColor: canMark ? colors.gold : colors.hairlineSoft }]}>
              {canMark ? (
                <LinearGradient
                  colors={goldGradient.colors}
                  locations={goldGradient.locations}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <View style={styles.primaryContent}>
                <Icon name="check" size={24} color={canMark ? colors.onGold : colors.success} strokeWidth={2} />
                <AppText variant="button" tone={canMark ? 'onGold' : 'success'}>{canMark ? 'Série feita' : 'Séries completas'}</AppText>
              </View>
            </PressableScale>
          </>
        ) : kind === 'resistencia' ? (
          <>
            <AppText variant="display" tone="goldHighlight" style={[styles.center, styles.tabular]}>{String(session.laps.length)}</AppText>
            <AppText tone="secondary" style={styles.center}>{session.laps.length === 1 ? 'volta marcada' : 'voltas marcadas'}</AppText>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Marcar volta"
              haptic="tap"
              onPress={() => void training.addLap()}
              style={[styles.primary, { borderColor: colors.gold }]}>
              <LinearGradient colors={goldGradient.colors} locations={goldGradient.locations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.primaryContent}>
                <Icon name="ampulheta" size={24} color={colors.onGold} strokeWidth={2} />
                <AppText variant="button" tone="onGold">Marcar volta</AppText>
              </View>
            </PressableScale>
          </>
        ) : (
          <AppText tone="secondary" style={styles.center}>{`${session.sets.length} ${session.sets.length === 1 ? 'série feita' : 'séries feitas'}`}</AppText>
        )}

        {session.pausedAt ? (
          <Button label="Retomar" icon="registrar" variant="secondary" onPress={() => void training.resume()} />
        ) : (
          <Button label="Pausar" icon="ampulheta" variant="secondary" onPress={() => void training.pause()} />
        )}

        {closed ? (
          <View style={[styles.closed, { backgroundColor: colors.surfaceRaised, borderColor: colors.gold }]} accessibilityLiveRegion="polite">
            <Icon name="check" size={36} color={colors.goldHighlight} strokeWidth={2} />
            <AppText variant="subheading" tone="goldHighlight">Exercício concluído</AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={2} style={styles.center}>{closed}</AppText>
          </View>
        ) : null}
      </Reveal>

      <View style={styles.footer}>
        <Button label="Desbloquear para abrir o app" icon="cadeado" variant="ghost" onPress={requestUnlock} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  headerText: {
    gap: 2,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.sheet * 2,
    padding: space.xl,
    gap: space.lg,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  block: {
    gap: space.xs,
  },
  series: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.xs,
  },
  serie: {
    minWidth: 36,
    height: 32,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: touchTarget + 16,
    borderRadius: radius.sheet,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  primaryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    zIndex: 1,
  },
  closed: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    borderWidth: 1.5,
    borderRadius: radius.sheet * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.xl,
  },
  footer: {
    alignSelf: 'stretch',
  },
  flex: {
    flex: 1,
  },
  center: {
    textAlign: 'center',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
