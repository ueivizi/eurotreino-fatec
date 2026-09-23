import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion/reveal';
import { RollingNumber } from '@/components/motion/rolling-number';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { ProgressBar } from '@/components/ui/progress-bar';
import { AppText } from '@/components/ui/text';
import { SCORING } from '@/features/ranks/scoring';
import { rankFromGlory } from '@/features/ranks/tiers';
import type { LoggedWorkout } from '@/features/workouts/workouts-parsers';
import { SHARE_FEEDBACK, shareText } from '@/lib/share';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

import { usePendingCelebrations } from './celebration-store';
import { StampCheck } from './scenes/ceremony-parts';

type Props = {
  result: LoggedWorkout;
  /** Ex.: "Musculação · 50 min · Moderado". */
  summary: string;
  /** Rótulo da intensidade, para a linha da composição. */
  intensityLabel: string;
  /** Frase do Coliseu quando a posição melhorou. */
  arenaLine?: string | null;
  /** Texto pronto de "compartilhar treino", já no tom da modalidade. */
  shareMessage?: string;
  /** Detalhes da modalidade, ex.: "7,0 km · 4:17 /km". */
  detailLine?: string | null;
  /** Aviso de recorde pessoal, vindo do servidor. */
  recordLine?: string | null;
  onClose: () => void;
  onOpenArena?: () => void;
};

/** Composição dos pontos: cada linha entra em cascata logo depois do total. */
function CompositionLine({ label, value, index }: { label: string; value: number; index: number }) {
  const { colors } = useTheme();
  return (
    <Reveal index={index} delay={520} style={[styles.line, { borderBottomColor: colors.hairlineSoft }]}>
      <AppText tone="secondary">{label}</AppText>
      <AppText variant="bodyMedium" style={styles.tabular}>{`+${value}`}</AppText>
    </Reveal>
  );
}

/**
 * Treino registrado (design 3.3) com movimento: o selo é cunhado, a Glória conta desde zero, a
 * composição entra em cascata e a barra mostra o trecho ganho. Cerimônias maiores ficam na fila e
 * tocam quando a folha fecha.
 */
export function WorkoutResult({
  result,
  summary,
  intensityLabel,
  arenaLine,
  shareMessage,
  detailLine,
  recordLine,
  onClose,
  onOpenArena,
}: Props) {
  const { colors } = useTheme();
  const pending = usePendingCelebrations();
  const [shareNote, setShareNote] = useState<string | null>(null);

  async function share() {
    if (!shareMessage) return;
    setShareNote(SHARE_FEEDBACK[await shareText(shareMessage)]);
  }

  const before = rankFromGlory(Math.max(0, result.totalGlory - result.points));
  const after = rankFromGlory(result.totalGlory);
  const changedDivision = after.label !== before.label;

  if (result.replayed || !result.isScored) {
    return (
      <View style={styles.result} accessibilityLiveRegion="polite">
        <Reveal style={styles.center}>
          <AppText variant="heading" style={styles.centerText}>
            {result.replayed ? 'Treino já registrado' : 'Treino registrado'}
          </AppText>
        </Reveal>
        <Reveal index={1}>
          <Notice
            message={
              result.replayed
                ? 'Este registro já tinha chegado ao servidor. Nada foi somado de novo.'
                : `Você já tem ${SCORING.maxScoredPerDay} treinos pontuados hoje. Este fica no seu histórico, sem Glória.`
            }
          />
        </Reveal>
        <Reveal index={2} style={styles.actions}>
          <Button label="Fechar" onPress={onClose} />
        </Reveal>
      </View>
    );
  }

  const lines = [
    { label: 'Presença', value: result.presence },
    { label: 'Duração', value: result.duration },
    { label: `Intensidade · ${intensityLabel.toLowerCase()}`, value: result.intensity },
    ...(result.bonus > 0 ? [{ label: `Constância · ${SCORING.weeklyBonusAt}º treino da semana`, value: result.bonus }] : []),
  ];

  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <View style={styles.hero}>
        <StampCheck delay={60} />
        <View style={styles.total}>
          <RollingNumber
            value={result.points}
            from={0}
            prefix="+"
            variant="display"
            tone="goldHighlight"
            delay={240}
            accessibilityLabel={`Mais ${result.points} de Glória`}
          />
          <AppText variant="heading" tone="goldHighlight" style={styles.totalLabel}>
            Glória
          </AppText>
        </View>
        <Reveal delay={360}>
          <AppText tone="secondary" style={styles.centerText}>
            {summary}
          </AppText>
        </Reveal>
        {detailLine ? (
          <Reveal delay={420}>
            <AppText variant="subheading" tone="goldHighlight" style={styles.centerText}>
              {detailLine}
            </AppText>
          </Reveal>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.hairlineSoft }]}>
        {lines.map((line, index) => (
          <CompositionLine key={line.label} label={line.label} value={line.value} index={index} />
        ))}
        <Reveal index={lines.length} delay={520} style={styles.totalLine}>
          <AppText variant="bodyMedium">Total</AppText>
          <AppText variant="button" tone="goldHighlight" style={styles.tabular}>{`+${result.points}`}</AppText>
        </Reveal>
      </View>

      <Reveal delay={760} style={[styles.card, styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.hairlineSoft }]}>
        <View style={styles.progressHeader}>
          <AppText variant="subheading">{after.label}</AppText>
          <View style={styles.inline}>
            <AppText variant="label" tone="secondary" style={styles.tabular}>{`${before.glory} → `}</AppText>
            <RollingNumber value={after.glory} from={before.glory} variant="label" tone="goldHighlight" delay={860} />
          </View>
        </View>
        <ProgressBar
          value={after.progress}
          gainFrom={changedDivision ? 0 : before.progress}
          delay={900}
          accessibilityLabel={after.next ? `Progresso até ${after.next.label}` : 'Rank máximo alcançado'}
        />
        <AppText variant="caption" tone="muted" style={styles.tabular}>
          {after.next ? `Faltam ${after.next.remaining} para ${after.next.label}` : 'Você chegou ao Olimpo'}
        </AppText>
      </Reveal>

      {recordLine ? (
        <Reveal delay={940} style={styles.arena}>
          <Icon name="arena" size={22} color={colors.goldHighlight} />
          <AppText style={styles.arenaText}>{recordLine}</AppText>
        </Reveal>
      ) : null}

      {arenaLine ? (
        <Reveal delay={980} style={styles.arena}>
          <Icon name="arena" size={22} color={colors.goldHighlight} />
          <AppText style={styles.arenaText}>{arenaLine}</AppText>
        </Reveal>
      ) : null}

      <Reveal delay={1080} style={styles.actions}>
        {shareNote ? <Notice message={shareNote} /> : null}
        {shareMessage ? (
          <Button label="Compartilhar treino" icon="compartilhar" variant="secondary" onPress={() => void share()} />
        ) : null}
        {arenaLine && onOpenArena ? <Button label="Ver Coliseu" onPress={onOpenArena} /> : null}
        <Button
          label={pending > 0 ? 'Continuar' : 'Fechar'}
          variant={arenaLine && onOpenArena ? 'ghost' : 'primary'}
          onPress={onClose}
          accessibilityHint={pending > 0 ? 'Fecha o registro e mostra suas conquistas' : undefined}
        />
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  result: {
    gap: space.lg,
  },
  hero: {
    alignItems: 'center',
    gap: space.sm,
  },
  total: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginTop: space.xs,
  },
  totalLabel: {
    marginTop: space.md,
  },
  center: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.xs,
  },
  line: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  totalLine: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressCard: {
    paddingVertical: space.md,
    gap: space.sm,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  arena: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xs,
  },
  arenaText: {
    flex: 1,
  },
  actions: {
    gap: space.sm,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
