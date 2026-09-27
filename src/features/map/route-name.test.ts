import { isValidRouteName, shareableRouteName } from './route-name';

describe('nome de rota compartilhada', () => {
  it('segue a regra do banco', () => {
    for (const ok of ['Volta da Paulista', 'Volta de 5,2 km', 'Pedal (domingo)', 'Ibirapuera/Obelisco', "D'Ávila 10 km", 'Vá']) {
      expect(isValidRouteName(ok)).toBe(true);
    }
    for (const bad of ['V', ' Volta', 'Volta ', 'Volta  dupla', '<b>Volta</b>', 'Volta 💪', '-Volta', 'a'.repeat(41)]) {
      expect(isValidRouteName(bad)).toBe(false);
    }
  });

  it('limpa o nome do aparelho ou usa o de reserva', () => {
    expect(shareableRouteName('Volta 💪 do parque!', 'Rota')).toBe('Volta do parque');
    expect(shareableRouteName('  -- Pedal  ', 'Rota')).toBe('Pedal');
    expect(shareableRouteName('💪', 'Rota de 5 km')).toBe('Rota de 5 km');
  });
});
