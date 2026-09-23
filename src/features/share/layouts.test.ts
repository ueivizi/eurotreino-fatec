import { shareDate, shareLayout, type ShareWorkout } from './layouts';

const BASE: ShareWorkout = {
  type: 'corrida',
  durationMin: 45,
  intensity: 'moderado',
  distanceM: 9000,
  setsCount: null,
  loadKg: null,
  points: 16,
  isScored: true,
  note: null,
  performedAt: new Date('2026-09-23T12:00:00Z'),
};

const values = (workout: ShareWorkout) => shareLayout(workout).stats.map((stat) => `${stat.label}: ${stat.value}`);

describe('imagem de partilha', () => {
  it('corrida mostra distância, tempo e ritmo', () => {
    expect(values(BASE)).toEqual(['Distância: 9 km', 'Tempo: 45 min', 'Ritmo: 5:00 /km', 'Glória: +16']);
  });

  it('bike se lê em velocidade', () => {
    expect(values({ ...BASE, type: 'bike', distanceM: 30000, durationMin: 60 })).toContain('Velocidade: 30,0 km/h');
  });

  /* Musculação não tem ritmo: seria "12:00 /km de agachamento". O que conta é séries e carga. */
  it('musculação mostra séries e carga, nunca ritmo', () => {
    const stats = values({ ...BASE, type: 'musculacao', distanceM: null, setsCount: 12, loadKg: 62.5 });
    expect(stats).toEqual(['Tempo: 45 min', 'Séries: 12', 'Carga: 62,5 kg', 'Glória: +16']);
  });

  it('completa com a intensidade quando falta detalhe', () => {
    expect(values({ ...BASE, distanceM: null })).toEqual(['Tempo: 45 min', 'Intensidade: Moderado', 'Glória: +16']);
    expect(values({ ...BASE, type: 'musculacao', distanceM: null })).toContain('Intensidade: Moderado');
  });

  /* Treino que passou do teto do dia não pontuou: "+0 de Glória" não é notícia. */
  it('sem Glória, o quadro fica sem a linha de Glória', () => {
    expect(values({ ...BASE, isScored: false, points: 0 }).join(' ')).not.toContain('Glória');
  });

  it('o campo livre vira o título, e a modalidade some', () => {
    expect(shareLayout({ ...BASE, type: 'outro', distanceM: null, note: 'futebol' }).title).toBe('futebol');
    expect(shareLayout(BASE).title).toBe('Corrida');
  });

  it('no máximo quatro números cabem na imagem', () => {
    const cheio = shareLayout({ ...BASE, type: 'musculacao', distanceM: null, setsCount: 12, loadKg: 60 });
    expect(cheio.stats).toHaveLength(4);
  });

  it('a data sai por extenso, em português', () => {
    expect(shareDate(new Date(2026, 8, 23))).toBe('23 de setembro de 2026');
  });
});
