import { nearbyPlaces, placeKindOf, placeSubclasses } from './places';

const here = { lat: -23.5505, lng: -46.6333 };

function poi(subclass: string, lng: number, lat: number, name?: string) {
  return { type: 'Feature', properties: { subclass, ...(name ? { name } : {}) }, geometry: { type: 'Point', coordinates: [lng, lat] } };
}

describe('lugares do mapa', () => {
  it('reconhece só as categorias escolhidas', () => {
    expect(placeKindOf('cafe')).toBe('cafe');
    expect(placeKindOf('bicycle')).toBe('bicicletaria');
    expect(placeKindOf('restaurant')).toBeNull();
    expect(placeKindOf(42)).toBeNull();
    expect(placeSubclasses(['agua', 'shopping'])).toEqual(['drinking_water', 'mall', 'department_store']);
  });

  it('ordena pela distância, junta os repetidos e dá nome a quem não tem', () => {
    const list = nearbyPlaces(
      [
        poi('cafe', -46.64, -23.555, 'Café Longe'),
        poi('cafe', -46.6334, -23.5506, 'Café Perto'),
        poi('cafe', -46.6334, -23.5506, 'Café Perto'),
        poi('drinking_water', -46.635, -23.551),
        poi('restaurant', -46.6333, -23.5505, 'Não entra'),
      ],
      here,
    );
    expect(list.map((place) => place.name)).toEqual(['Café Perto', 'Bebedouro', 'Café Longe']);
    expect(list[0]?.distanceM).toBeLessThan(20);
  });

  it('descarta o que não tem forma de lugar', () => {
    const list = nearbyPlaces(
      [
        null,
        'texto',
        { properties: { subclass: 'cafe' }, geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
        { properties: { subclass: 'cafe' }, geometry: { type: 'Point', coordinates: [200, 0] } },
        { properties: { subclass: 'cafe' }, geometry: { type: 'Point', coordinates: ['a', 'b'] } },
        { geometry: { type: 'Point', coordinates: [-46.6, -23.5] } },
      ],
      here,
    );
    expect(list).toEqual([]);
  });

  it('corta nomes compridos e respeita o limite', () => {
    const many = Array.from({ length: 30 }, (_, i) => poi('toilets', -46.6333 + i * 0.001, -23.5505, `B${'x'.repeat(80)}${i}`));
    const list = nearbyPlaces(many, here, 5);
    expect(list).toHaveLength(5);
    expect(list.every((place) => place.name.length <= 60)).toBe(true);
  });
});
