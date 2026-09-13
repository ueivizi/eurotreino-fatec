import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { palettes, type Palette, type ThemeName } from './tokens';

type Theme = {
  name: ThemeName;
  colors: Palette;
};

const ThemeContext = createContext<Theme>({ name: 'onix', colors: palettes.onix });

/** Ônix é o tema padrão; Mármore fica disponível para a futura opção de tema claro. */
export function AppThemeProvider({ name = 'onix', children }: { name?: ThemeName; children: ReactNode }) {
  const value = useMemo(() => ({ name, colors: palettes[name] }), [name]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
