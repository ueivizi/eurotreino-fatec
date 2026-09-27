import { placeChanges } from './place-memory';

describe('setas do Coliseu', () => {
  it('quem subiu ganha positivo, quem desceu negativo, quem ficou não aparece', () => {
    expect(
      placeChanges({ a: 3, b: 1, c: 2 }, [
        { userId: 'a', place: 1 },
        { userId: 'b', place: 2 },
        { userId: 'c', place: 2 },
        { userId: 'novo', place: 4 },
      ]),
    ).toEqual({ a: 2, b: -1 });
  });
});
