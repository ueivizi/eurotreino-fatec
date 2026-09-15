import { between, seededRandom } from './seeded-random';

describe('seededRandom', () => {
  it('repete a mesma sequência com a mesma semente', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const first = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(first);
  });

  it('muda a sequência quando muda a semente', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it('fica sempre entre 0 (inclusive) e 1 (exclusive)', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 2000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('between respeita os limites pedidos', () => {
    const random = seededRandom(9);
    for (let i = 0; i < 500; i += 1) {
      const value = between(random, 3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(7);
    }
  });
});
