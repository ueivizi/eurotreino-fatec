import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegionBanner } from '@/components/legion/legion-banner';
import { Halo } from '@/components/motion/halo';
import { PressableScale } from '@/components/motion/pressable-scale';
import { setSimulatedReducedMotion, useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { Reveal } from '@/components/motion/reveal';
import { RollingNumber } from '@/components/motion/rolling-number';
import { Shimmer } from '@/components/motion/shimmer';
import { Skeleton } from '@/components/motion/skeleton';
import { Sparks } from '@/components/motion/sparks';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { RankMedallion } from '@/components/rank/rank-medallion';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import type { LegionSummary } from '@/features/legions/legions-parsers';
import type { SeasonTable, Trophy } from '@/features/legions/season-parsers';
import { SeasonTableView } from '@/features/legions/season-table';
import { TrophyShelf } from '@/features/legions/trophy-shelf';
import { EMBLEM_COLORS } from '@/features/profile/emblems';
import { shareLayout, type ShareWorkout } from '@/features/share/layouts';
import { ShareCard } from '@/features/share/share-card';
import { INTENSITIES, type IntensityId } from '@/features/workouts/workout-types';
import type { LoggedWorkout } from '@/features/workouts/workouts-parsers';
import { queryKeys } from '@/lib/query-client';
import { useTheme } from '@/theme/theme';
import { radius, space, touchTarget } from '@/theme/tokens';

import { CelebrationHost } from './celebration-host';
import { enqueueCelebrations } from './celebration-store';
import type { ArenaStanding, Celebration } from './celebration-types';
import { WorkoutResult } from './workout-result';

/** Dados de exemplo (personas do projeto). Nada aqui vem do servidor nem é gravado. */
const DIGAO = { displayName: 'Digão', emblem: 'raio' } as const;
const CAMILA = { displayName: 'Camila', emblem: 'coruja' } as const;
const LUCAS = { displayName: 'Lucas', emblem: 'aguia' } as const;
const BIA = { displayName: 'Bia', emblem: 'tridente' } as const;

function standing(
  userId: string,
  person: { displayName: string; emblem: ArenaStanding['emblem']; emblemColor?: ArenaStanding['emblemColor'] },
  beforePlace: number,
  afterPlace: number,
  weekGlory: number,
  isMe = false,
): ArenaStanding {
  return { userId, emblemColor: 'ouro', ...person, beforePlace, afterPlace, weekGlory, isMe };
}

const ASCENSION: Celebration = {
  kind: 'ascension',
  fromTier: 3,
  toTier: 4,
  label: 'Gladiador III',
  tierName: 'Gladiador',
  division: 'III',
  glory: 650,
  next: { label: 'Gladiador II', min: 835, remaining: 185 },
};

const PODIUM: Celebration = {
  kind: 'arena',
  legionId: '00000000-0000-4000-8000-000000000000',
  legionName: 'Legião Fênix',
  fromPlace: 3,
  toPlace: 1,
  passed: ['Camila', 'Digão'],
  standings: [standing('c', CAMILA, 2, 3, 52), standing('d', DIGAO, 1, 2, 90), standing('l', LUCAS, 3, 1, 94, true)],
  emblem: 'aguia',
  emblemColor: 'ouro',
};

const SAMPLES: { label: string; description: string; celebrations: Celebration[] }[] = [
  { label: 'Ascensão', description: 'Centurião I → Gladiador III', celebrations: [ASCENSION] },
  {
    label: 'Nova divisão',
    description: 'Recruta III → Recruta II',
    celebrations: [
      { kind: 'division', tier: 1, fromDivision: 'III', division: 'II', label: 'Recruta II', glory: 40, next: { label: 'Recruta I', min: 70, remaining: 30 } },
    ],
  },
  {
    label: 'Subiu no Coliseu',
    description: '5º → 4º, passando a Bia',
    celebrations: [
      {
        kind: 'arena',
        legionId: '00000000-0000-4000-8000-000000000000',
        legionName: 'Legião Fênix',
        fromPlace: 5,
        toPlace: 4,
        passed: ['Bia'],
        standings: [standing('b', BIA, 4, 5, 41), standing('l', LUCAS, 5, 4, 44, true)],
        emblemColor: 'ouro',
        emblem: 'aguia',
      },
    ],
  },
  { label: 'Pódio', description: '3º → 1º, com louros de ouro', celebrations: [PODIUM] },
  { label: 'Constância', description: '3º treino pontuado da semana', celebrations: [{ kind: 'constancy', bonus: 10, weekGlory: 78 }] },
  { label: 'Primeiro treino', description: 'Medalha "Primeiro passo"', celebrations: [{ kind: 'first-workout' }] },
  {
    label: 'Medalha',
    description: 'Conquista liberada pelo servidor (futuro)',
    celebrations: [{ kind: 'medal', title: 'Legião fundada', description: 'Você reuniu sua primeira Legião. Que venham as disputas.' }],
  },
  {
    label: 'Recorde pessoal',
    description: 'Supino reto: 80 → 82,5 kg (módulo futuro)',
    celebrations: [{ kind: 'record', exercise: 'Supino reto', previous: 80, current: 82.5, unit: 'kg' }],
  },
  {
    label: 'Triunfo',
    description: 'Ouro da temporada competitiva',
    celebrations: [{ kind: 'trophy', trophy: 'triunfo_ouro', legionName: 'Legião Fênix', louros: 95 }],
  },
  {
    label: 'Sequência completa',
    description: 'Ascensão, pódio e constância em fila',
    celebrations: [ASCENSION, PODIUM, { kind: 'constancy', bonus: 10, weekGlory: 106 }],
  },
];

const SAMPLE_RESULT: LoggedWorkout = {
  workoutId: '00000000-0000-4000-8000-000000000001',
  presence: 10,
  duration: 5,
  intensity: 2,
  bonus: 0,
  points: 17,
  isScored: true,
  weekGlory: 78,
  totalGlory: 485,
  replayed: false,
  isDistanceRecord: false,
};

const SAMPLE_SHARE: ShareWorkout = {
  type: 'corrida',
  durationMin: 52,
  intensity: 'intenso',
  distanceM: 10200,
  setsCount: null,
  loadKg: null,
  points: 20,
  isScored: true,
  note: null,
  performedAt: new Date(2026, 8, 23, 19, 30),
};

/** Legião competitiva de exemplo, com a tabela e os Triunfos já no cache: nada é buscado. */
const SAMPLE_LEGION: LegionSummary = {
  id: 'exemplo',
  name: 'Legião Fênix',
  emblem: 'fenix',
  bannerColor: 'porfiro',
  mode: 'competitiva',
  weeklyMinimum: 3,
  modeSince: '2026-08-31',
  role: 'owner',
  memberCount: 5,
  joinedAt: '2026-08-20T12:00:00Z',
};

function seasonEntry(
  displayName: string,
  emblem: 'raio' | 'aguia' | 'coruja' | 'tridente' | 'leao',
  louros: number,
  lastDelta: number,
  weekScored: number,
  place: number,
  isMe = false,
) {
  return {
    userId: displayName,
    displayName,
    emblem,
    emblemColor: 'ouro' as const,
    role: 'member' as const,
    louros,
    lastDelta,
    weeksCounted: 2,
    weeksMet: lastDelta > 0 ? 2 : 1,
    podiums: place <= 3 ? 1 : 0,
    seasonGlory: louros * 2,
    weekScored,
    place,
    isMe,
  };
}

const SAMPLE_SEASON: SeasonTable = {
  seasonStart: '2026-09-14',
  seasonWeek: 3,
  weeklyMinimum: 3,
  entries: [
    seasonEntry('Digão', 'raio', 70, 35, 3, 1),
    seasonEntry('Lucas', 'aguia', 45, 20, 2, 2, true),
    seasonEntry('Camila', 'coruja', 25, 10, 1, 3),
    seasonEntry('Bia', 'tridente', 10, -15, 0, 4),
    seasonEntry('Rafa', 'leao', 0, -15, 0, 5),
  ],
};

const SAMPLE_TROPHIES: Trophy[] = [
  { kind: 'triunfo_ouro', groupName: 'Legião Fênix', seasonStart: '2026-08-17', louros: 95, awardedAt: '2026-09-14T10:00:00Z' },
  { kind: 'invicto', groupName: 'Legião Fênix', seasonStart: '2026-08-17', louros: 95, awardedAt: '2026-09-14T10:00:00Z' },
  { kind: 'triunfo_prata', groupName: null, seasonStart: '2026-07-20', louros: 60, awardedAt: '2026-08-17T10:00:00Z' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <AppText variant="overline" tone="gold">
        {title}
      </AppText>
      <View style={[styles.sectionBody, { borderColor: colors.hairlineSoft, backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

/**
 * Galeria de movimento: toca cada celebração e mostra os componentes do kit com dados de exemplo.
 * Existe só para desenvolvimento, conferência visual e gravação do vídeo; a rota some em produção.
 */
export function MotionGallery() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotionPreference();
  const [glory, setGlory] = useState(468);
  const [replay, setReplay] = useState(0);
  const [intensity, setIntensity] = useState<IntensityId>('moderado');
  const queryClient = useQueryClient();
  // Semeia o cache uma vez: a tabela e a estante de exemplo nunca vão ao servidor.
  useState(() => {
    for (const key of [queryKeys.season('exemplo', 0), queryKeys.trophies('exemplo')]) {
      queryClient.setQueryDefaults(key, { staleTime: Infinity, gcTime: Infinity });
    }
    queryClient.setQueryData(queryKeys.season('exemplo', 0), SAMPLE_SEASON);
    queryClient.setQueryData(queryKeys.trophies('exemplo'), SAMPLE_TROPHIES);
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxxl }]}>
        <View style={styles.header}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}>
            <Icon name="chevronLeft" size={22} color={colors.gold} />
          </PressableScale>
          <View style={styles.headerText}>
            <AppText variant="title">Movimento</AppText>
            <AppText variant="label" tone="muted">
              Galeria de desenvolvimento, com dados de exemplo.
            </AppText>
          </View>
        </View>

        <View style={[styles.toggle, { borderColor: colors.hairline }]}>
          <View style={styles.toggleText}>
            <AppText variant="bodyMedium">Simular reduzir movimento</AppText>
            <AppText variant="caption" tone="muted">
              Fade curto, sem partículas nem loops. O háptico continua.
            </AppText>
          </View>
          <Switch
            value={reduced}
            onValueChange={setSimulatedReducedMotion}
            trackColor={{ false: colors.track, true: colors.goldDeep }}
            thumbColor={reduced ? colors.goldHighlight : colors.textSecondary}
            accessibilityLabel="Simular reduzir movimento"
          />
        </View>

        <Section title="Celebrações">
          {SAMPLES.map((sample, index) => (
            <Reveal key={sample.label} index={index}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Tocar ${sample.label}`}
                onPress={() => enqueueCelebrations(sample.celebrations)}
                style={[styles.sample, { borderBottomColor: colors.hairlineSoft }]}>
                <View style={styles.sampleText}>
                  <AppText variant="bodyMedium">{sample.label}</AppText>
                  <AppText variant="caption" tone="muted">
                    {sample.description}
                  </AppText>
                </View>
                <Icon name="chevronRight" size={18} color={colors.gold} />
              </PressableScale>
            </Reveal>
          ))}
        </Section>

        <Section title="Legião competitiva">
          <View style={styles.kitBlock}>
            <View style={styles.banners}>
              {EMBLEM_COLORS.map((color, index) => (
                <LegionBanner key={color} emblem={index % 2 === 0 ? 'fenix' : 'leao'} color={color} width={48} delay={index * 90} />
              ))}
            </View>
            <SeasonTableView legion={SAMPLE_LEGION} />
            <TrophyShelf userId="exemplo" />
          </View>
        </Section>

        <Section title="Treino registrado">
          <WorkoutResult
            key={`resultado-${replay}`}
            result={SAMPLE_RESULT}
            summary="Musculação · 50 min · Moderado"
            intensityLabel="Moderado"
            arenaLine="Você assumiu o 1º lugar no Coliseu da Legião Fênix."
            onClose={() => setReplay((value) => value + 1)}
            onOpenArena={() => enqueueCelebrations([PODIUM])}
          />
        </Section>

        <Section title="Imagem de partilha">
          <View style={styles.kitBlock}>
            <AppText variant="caption" tone="muted">
              Cartão 9:16 gerado para compartilhar, sempre no Ônix. Com foto, o retrato entra no fundo.
            </AppText>
            <View style={styles.shareRow}>
              <ShareCard layout={shareLayout(SAMPLE_SHARE)} displayName="Arthur" rankLabel="Centurião II" width={200} />
              <ShareCard
                layout={shareLayout({ ...SAMPLE_SHARE, type: 'musculacao', distanceM: null, setsCount: 16, loadKg: 82.5, note: null })}
                displayName="Arthur"
                rankLabel="Centurião II"
                width={200}
              />
            </View>
          </View>
        </Section>

        <Section title="Kit de movimento">
          <View style={styles.kitRow}>
            <View style={styles.medallion}>
              <Halo size={220} strength={0.24} style={{ top: -55, left: -55 }} />
              <RankMedallion tier={3} size={110} accessibilityLabel="Medalhão de exemplo: Centurião" />
              <View style={styles.coin}>
                <Shimmer radius={41} delay={400} interval={2600} />
              </View>
            </View>
            <View style={styles.kitText}>
              <AppText variant="caption" tone="muted">Halo, brilho e contagem</AppText>
              <RollingNumber value={glory} suffix=" de Glória" variant="subheading" tone="goldHighlight" />
              <Button label="Somar 16" variant="secondary" onPress={() => setGlory((value) => value + 16)} />
            </View>
          </View>

          <View key={`barra-${replay}`} style={styles.kitBlock}>
            <AppText variant="caption" tone="muted">Barra com o trecho ganho</AppText>
            <ProgressBar value={0.61} gainFrom={0.46} delay={200} accessibilityLabel="Progresso de exemplo" />
          </View>

          <View style={styles.kitBlock}>
            <AppText variant="caption" tone="muted">Seletor com filete deslizante</AppText>
            <SegmentedControl options={INTENSITIES} value={intensity} onChange={setIntensity} accessibilityLabel="Intensidade de exemplo" />
          </View>

          <View key={`louros-${replay}`} style={styles.kitRow}>
            <EmblemAvatar emblem="raio" size={88} laurel="gold" crownDelay={200} />
            <EmblemAvatar emblem="aguia" size={76} laurel="silver" crownDelay={420} />
            <EmblemAvatar emblem="coruja" size={76} laurel="bronze" crownDelay={640} />
            <View style={styles.sparks}>
              <Sparks size={140} count={22} seed={replay + 3} delay={300} style={{ top: -50, left: -50 }} />
              <Icon name="check" size={40} color={colors.goldHighlight} />
            </View>
          </View>

          <View style={styles.kitBlock}>
            <AppText variant="caption" tone="muted">Esqueleto de carregamento</AppText>
            <View style={styles.kitRow}>
              <Skeleton width={56} height={56} radius={28} />
              <View style={styles.kitText}>
                <Skeleton width="80%" height={14} />
                <Skeleton width="50%" height={12} />
              </View>
            </View>
          </View>

          <Button label="Reproduzir de novo" variant="ghost" onPress={() => setReplay((value) => value + 1)} />
        </Section>
      </ScrollView>
      <CelebrationHost />
    </View>
  );
}

const styles = StyleSheet.create({
  banners: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.md,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  back: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -space.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.md,
  },
  toggleText: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: space.sm,
  },
  sectionBody: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.lg,
  },
  sample: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 1,
  },
  sampleText: {
    flex: 1,
    gap: 2,
  },
  kitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  kitBlock: {
    gap: space.sm,
  },
  shareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  kitText: {
    flex: 1,
    gap: space.sm,
  },
  medallion: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coin: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    pointerEvents: 'none',
  },
  sparks: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
