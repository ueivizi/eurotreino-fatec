import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { deviceStorage } from '@/lib/device-storage';

import { palettes, type Palette, type ThemeName } from './tokens';

/**
 * Tema do app: "Ônix" (escuro, padrão) e "Mármore" (claro). A escolha fica neste aparelho, não na
 * conta: quem usa o celular no sol e o computador à noite quer coisas diferentes em cada um.
 */
export type ThemePreference = ThemeName | 'sistema';

const STORAGE_KEY = 'eurotreino.tema';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'onix' || value === 'marmore' || value === 'sistema';
}

type Theme = {
  name: ThemeName;
  colors: Palette;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<Theme>({
  name: 'onix',
  colors: palettes.onix,
  preference: 'onix',
  setPreference: () => undefined,
});

export const THEME_OPTIONS = [
  { id: 'onix', label: 'Ônix' },
  { id: 'marmore', label: 'Mármore' },
  { id: 'sistema', label: 'Do sistema' },
] as const satisfies readonly { id: ThemePreference; label: string }[];

export function AppThemeProvider({ initial = 'onix', children }: { initial?: ThemePreference; children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setStored] = useState<ThemePreference>(initial);

  useEffect(() => {
    let active = true;
    deviceStorage
      .getItem(STORAGE_KEY)
      .then((saved) => {
        // Valor estranho no armazenamento (edição manual, versão antiga) cai no padrão.
        if (active && isThemePreference(saved)) setStored(saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStored(next);
    // Guardar é conveniência: se falhar, o tema vale nesta sessão e volta ao padrão depois.
    deviceStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const name: ThemeName = preference === 'sistema' ? (system === 'light' ? 'marmore' : 'onix') : preference;

  const value = useMemo(
    () => ({ name, colors: palettes[name], preference, setPreference }),
    [name, preference, setPreference],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
