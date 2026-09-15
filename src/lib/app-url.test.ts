import { parseAppUrl } from './app-url';

describe('parseAppUrl', () => {
  it('aceita só a origem https da versão Web', () => {
    expect(parseAppUrl('https://app.eurotreino.com.br')).toBe('https://app.eurotreino.com.br');
    expect(parseAppUrl('https://eurotreino.pages.dev/')).toBe('https://eurotreino.pages.dev');
    expect(parseAppUrl(' HTTPS://EuroTreino.expo.app ')).toBe('https://eurotreino.expo.app');
  });

  it('recusa endereços que poderiam desviar o convite', () => {
    for (const value of [
      undefined,
      '',
      'http://app.eurotreino.com.br',
      'https://app.eurotreino.com.br/convite',
      'https://app.eurotreino.com.br?x=1',
      'https://user@app.eurotreino.com.br',
      'javascript:alert(1)',
      'https://localhost',
      'https://app.eurotreino.com.br#fragmento',
    ]) {
      expect(parseAppUrl(value)).toBeNull();
    }
  });
});
