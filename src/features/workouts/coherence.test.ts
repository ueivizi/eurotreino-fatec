import { workoutWarnings, type WorkoutFacts } from './coherence';

function facts(overrides: Partial<WorkoutFacts> = {}): WorkoutFacts {
  return {
    type: 'corrida',
    durationMin: 30,
    intensity: 'moderado',
    distanceM: 5000,
    avgHeartRate: null,
    ...overrides,
  };
}

describe('coerência do que foi informado', () => {
  it('treino comum não rende aviso nenhum', () => {
    expect(workoutWarnings(facts())).toEqual([]);
    expect(workoutWarnings(facts({ avgHeartRate: 150, intensity: 'moderado' }))).toEqual([]);
    expect(workoutWarnings(facts({ distanceM: null, avgHeartRate: null }))).toEqual([]);
  });

  it('avisa quando a frequência não combina com a intensidade', () => {
    expect(workoutWarnings(facts({ intensity: 'leve', avgHeartRate: 175 }))[0]).toContain('bastante para um treino leve');
    expect(workoutWarnings(facts({ intensity: 'intenso', avgHeartRate: 95 }))[0]).toContain('pouco para um treino intenso');
    // Nos limites, ainda passa: o aviso é para o que destoa, não para o que é apertado.
    expect(workoutWarnings(facts({ intensity: 'leve', avgHeartRate: 159 }))).toEqual([]);
    expect(workoutWarnings(facts({ intensity: 'intenso', avgHeartRate: 111 }))).toEqual([]);
  });

  it('avisa velocidade impossível, com folga para quem é rápido', () => {
    // 10 km em 20 min = 30 km/h de corrida: acima do teto.
    expect(workoutWarnings(facts({ distanceM: 10000, durationMin: 20 }))[0]).toContain('acima do esperado para corrida');
    // Maratonista de elite (~21 km/h) continua passando sem aviso.
    expect(workoutWarnings(facts({ distanceM: 21000, durationMin: 60 }))).toEqual([]);
    expect(workoutWarnings(facts({ type: 'bike', distanceM: 100000, durationMin: 60 }))[0]).toContain('acima do esperado para bike');
  });

  it('sugere trocar a modalidade quando a corrida anda em passo de caminhada', () => {
    expect(workoutWarnings(facts({ distanceM: 2000, durationMin: 60 }))[0]).toContain('troque a modalidade');
  });

  it('modalidade sem velocidade esperada não inventa aviso', () => {
    expect(workoutWarnings(facts({ type: 'esporte', distanceM: 40000, durationMin: 30 }))).toEqual([]);
  });

  it('junta os avisos quando há mais de um', () => {
    expect(workoutWarnings(facts({ intensity: 'leve', avgHeartRate: 180, distanceM: 12000, durationMin: 20 }))).toHaveLength(2);
  });
});
