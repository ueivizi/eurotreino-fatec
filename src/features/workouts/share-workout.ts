import { rankFromGlory } from '@/features/ranks/tiers';
import type { LoggedWorkout } from '@/features/workouts/workouts-parsers';

import { intensityLabel, type IntensityId, type WorkoutTypeId } from './workout-types';

/**
 * Texto de "compartilhar treino": cada modalidade tem lema e verbo próprios, senão toda partilha
 * sairia igual. O texto é montado só com dados do próprio treino — nada de nome de outra pessoa,
 * posição de terceiros ou nome de Legião, que são informação da Legião, não sua para espalhar.
 */

type Flavor = {
  /** Verbo da modalidade, no passado. */
  verb: string;
  /** Lema latino curto, com tradução no app quando aparece na tela. */
  motto: string;
  /** Emoji único, para o texto ter cara mesmo fora do app. */
  mark: string;
};

const FLAVORS: Record<WorkoutTypeId, Flavor> = {
  musculacao: { verb: 'Levantei ferro por', motto: 'Fortes fortuna adiuvat', mark: '🏋️' },
  corrida: { verb: 'Corri por', motto: 'Citius, altius, fortius', mark: '🏃' },
  caminhada: { verb: 'Caminhei por', motto: 'Solvitur ambulando', mark: '🚶' },
  bike: { verb: 'Pedalei por', motto: 'Per aspera ad astra', mark: '🚴' },
  natacao: { verb: 'Nadei por', motto: 'Contra vim maris', mark: '🏊' },
  funcional: { verb: 'Treinei funcional por', motto: 'Mens sana in corpore sano', mark: '🤸' },
  esporte: { verb: 'Joguei por', motto: 'Ludus est vita', mark: '⚽' },
  yoga: { verb: 'Pratiquei yoga por', motto: 'Corpus et animus', mark: '🧘' },
  outro: { verb: 'Treinei por', motto: 'Mens sana in corpore sano', mark: '🏅' },
};

export function workoutFlavor(type: WorkoutTypeId): Flavor {
  return FLAVORS[type];
}

export type ShareInput = {
  type: WorkoutTypeId;
  durationMin: number;
  intensity: IntensityId;
  result: LoggedWorkout;
};

/** Mensagem do treino recém-registrado. */
export function workoutShareMessage({ type, durationMin, intensity, result }: ShareInput): string {
  const flavor = FLAVORS[type];
  const rank = rankFromGlory(result.totalGlory);
  const lines = [
    `${flavor.mark} ${flavor.verb} ${durationMin} min (${intensityLabel(intensity).toLowerCase()}) no EuroTreino.`,
  ];
  if (result.isScored && result.points > 0) lines.push(`+${result.points} de Glória · ${rank.label}`);
  else lines.push(`${rank.label} · ${rank.glory} de Glória`);
  lines.push(`"${flavor.motto}"`);
  return lines.join('\n');
}

/** Mensagem de Ascensão: o rank novo é a notícia, o treino é detalhe. */
export function ascensionShareMessage(totalGlory: number): string {
  const rank = rankFromGlory(totalGlory);
  const lines = [`🏛️ Ascendi a ${rank.label} no EuroTreino, com ${rank.glory} de Glória.`, '"Per aspera ad astra"'];
  return lines.join('\n');
}

/** Mensagem de posição na Arena: sem citar quem ficou para trás. */
export function arenaShareMessage(place: number, weekGlory: number): string {
  const position = place === 1 ? 'Assumi o 1º lugar' : `Cheguei ao ${place}º lugar`;
  return `🏟️ ${position} na Arena da semana no EuroTreino, com ${weekGlory} de Glória.\n"Fortes fortuna adiuvat"`;
}

/** Resumo do perfil, para quem quer chamar os amigos sem expor a Legião. */
export function profileShareMessage(displayName: string, totalGlory: number, totalWorkouts: number): string {
  const rank = rankFromGlory(totalGlory);
  return [
    `🏛️ ${displayName} · ${rank.label} no EuroTreino`,
    `${rank.glory} de Glória em ${totalWorkouts} ${totalWorkouts === 1 ? 'treino' : 'treinos'}`,
    '"Mens sana in corpore sano"',
  ].join('\n');
}
