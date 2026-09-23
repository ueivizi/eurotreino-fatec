import type { LoggedWorkout } from './workouts-parsers';
import { arenaShareMessage, ascensionShareMessage, profileShareMessage, workoutShareMessage } from './share-workout';
import { WORKOUT_TYPES } from './workout-types';

const RESULT: LoggedWorkout = {
  workoutId: '8f14e45f-ceea-467a-9575-28262f7a6b26',
  presence: 10,
  duration: 5,
  intensity: 2,
  bonus: 0,
  points: 17,
  isScored: true,
  weekGlory: 52,
  totalGlory: 320,
  replayed: false,
  isDistanceRecord: false,
};

describe('workoutShareMessage', () => {
  it('usa o verbo da modalidade e conta a Glória ganha', () => {
    const message = workoutShareMessage({ type: 'corrida', durationMin: 50, intensity: 'moderado', result: RESULT });
    expect(message).toContain('Corri por 50 min (moderado)');
    expect(message).toContain('+17 de Glória');
    expect(message).toContain('Centurião');
  });

  it('sem Glória no treino, mostra o rank e o total', () => {
    const message = workoutShareMessage({
      type: 'yoga',
      durationMin: 30,
      intensity: 'leve',
      result: { ...RESULT, points: 0, isScored: false },
    });
    expect(message).not.toContain('+0');
    expect(message).toContain('320 de Glória');
  });

  it('toda modalidade tem texto próprio, e nenhum sai vazio', () => {
    const messages = WORKOUT_TYPES.map((type) =>
      workoutShareMessage({ type: type.id, durationMin: 45, intensity: 'intenso', result: RESULT }),
    );
    for (const message of messages) expect(message.length).toBeGreaterThan(40);
    // Cada modalidade abre com uma linha diferente das outras.
    const firstLines = new Set(messages.map((message) => message.split('\n')[0]));
    expect(firstLines.size).toBe(WORKOUT_TYPES.length);
  });

  it('inclui distância e desempenho quando a modalidade tem', () => {
    const corrida = workoutShareMessage({ type: 'corrida', durationMin: 30, intensity: 'leve', result: RESULT, distanceM: 6000 });
    expect(corrida).toContain('6 km · 5:00 /km');
    // Bike se lê em velocidade, não em ritmo.
    const bike = workoutShareMessage({ type: 'bike', durationMin: 60, intensity: 'leve', result: RESULT, distanceM: 24000 });
    expect(bike).toContain('24 km · 24,0 km/h');
  });

  it('anuncia o recorde só quando o servidor confirma', () => {
    const comum = workoutShareMessage({ type: 'corrida', durationMin: 30, intensity: 'leve', result: RESULT, distanceM: 6000 });
    expect(comum).not.toContain('recorde');
    const recorde = workoutShareMessage({
      type: 'corrida',
      durationMin: 30,
      intensity: 'leve',
      result: { ...RESULT, isDistanceRecord: true },
      distanceM: 6000,
    });
    expect(recorde).toContain('recorde pessoal');
  });

  it('sem distância, o texto não inventa linha nenhuma', () => {
    const message = workoutShareMessage({ type: 'corrida', durationMin: 30, intensity: 'leve', result: RESULT });
    expect(message.split('\n')).toHaveLength(3);
  });

  it('não vaza nome de Legião, de membro nem posição de terceiros', () => {
    const message = workoutShareMessage({ type: 'bike', durationMin: 60, intensity: 'intenso', result: RESULT });
    expect(message).not.toMatch(/Legi[ãa]o|lugar|Coliseu/i);
  });
});

describe('outras mensagens', () => {
  it('Ascensão anuncia o rank novo', () => {
    expect(ascensionShareMessage(3500)).toContain('Olimpiano');
  });

  it('o Coliseu trata o 1º lugar diferente do resto e não cita quem foi ultrapassado', () => {
    expect(arenaShareMessage(1, 78)).toContain('Assumi o 1º lugar');
    expect(arenaShareMessage(4, 40)).toContain('4º lugar');
    expect(arenaShareMessage(4, 40)).not.toMatch(/ultrapass|passei/i);
  });

  it('o perfil mostra rank, Glória e número de treinos', () => {
    const message = profileShareMessage('Camila', 320, 1);
    expect(message).toContain('Camila · Centurião');
    expect(message).toContain('1 treino');
  });
});
