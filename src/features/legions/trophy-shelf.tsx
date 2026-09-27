import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion/reveal';
import { Shimmer } from '@/components/motion/shimmer';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { queryKeys } from '@/lib/query-client';
import { space } from '@/theme/tokens';

import { TROPHY_LABELS, type TrophyKind } from './louros';
import { fetchTrophies } from './season-api';

const TONES: Record<TrophyKind, { ring: string; fill: string; ink: string }> = {
  triunfo_ouro: { ring: '#E6C878', fill: 'rgba(201,162,74,0.18)', ink: '#E6C878' },
  triunfo_prata: { ring: '#C3C7CB', fill: 'rgba(195,199,203,0.14)', ink: '#C3C7CB' },
  triunfo_bronze: { ring: '#C98A55', fill: 'rgba(201,138,85,0.14)', ink: '#C98A55' },
  invicto: { ring: '#C08BB2', fill: 'rgba(110,47,94,0.35)', ink: '#E6C878' },
};

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' });

/**
 * Estante de Triunfos do perfil: os prêmios das temporadas competitivas. No perfil de outra pessoa,
 * a Legião onde o Triunfo saiu só aparece se quem vê também é membro dela.
 */
export function TrophyShelf({ userId }: { userId?: string }) {
  const trophies = useQuery({ queryKey: queryKeys.trophies(userId ?? 'eu'), queryFn: () => fetchTrophies(userId) });
  const list = trophies.data ?? [];

  if (trophies.isPending || trophies.isError) return null;
  if (list.length === 0 && userId) return null;

  return (
    <View style={styles.section}>
      <AppText variant="overline" tone="muted">Triunfos</AppText>
      {list.length === 0 ? (
        <AppText variant="label" tone="secondary">
          Triunfos saem do pódio de uma temporada competitiva, e o Invicto de quem cumpre o mínimo nas 4 semanas.
        </AppText>
      ) : (
        <View style={styles.shelf}>
          {list.map((trophy, index) => {
            const tone = TONES[trophy.kind];
            return (
              <Reveal key={`${trophy.kind}-${trophy.seasonStart}-${trophy.groupName ?? index}`} index={index} style={styles.item}>
                <View
                  style={[styles.medal, { borderColor: tone.ring, backgroundColor: tone.fill }]}
                  accessible
                  accessibilityLabel={`${TROPHY_LABELS[trophy.kind].title}${trophy.groupName ? `, ${trophy.groupName}` : ''}, temporada de ${dayFormat.format(new Date(`${trophy.seasonStart}T00:00:00Z`))}, ${trophy.louros} Louros`}>
                  <Icon name={trophy.kind === 'invicto' ? 'escudo' : 'trofeu'} size={26} color={tone.ink} strokeWidth={1.6} />
                  {trophy.kind === 'triunfo_ouro' ? <Shimmer radius={30} delay={900 + index * 200} interval={6000} /> : null}
                </View>
                <AppText variant="caption" style={styles.center} numberOfLines={2}>{TROPHY_LABELS[trophy.kind].title}</AppText>
                <AppText variant="caption" tone="muted" style={styles.center} numberOfLines={2}>
                  {`${trophy.groupName ?? 'Outra Legião'} · ${dayFormat.format(new Date(`${trophy.seasonStart}T00:00:00Z`))}`}
                </AppText>
              </Reveal>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: space.sm,
  },
  shelf: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  item: {
    width: 92,
    alignItems: 'center',
    gap: 2,
  },
  medal: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: space.xs,
  },
  center: {
    textAlign: 'center',
  },
});
