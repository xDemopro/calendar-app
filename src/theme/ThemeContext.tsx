import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme as useRNColorScheme } from 'react-native';

import { dark, light, type ThemeMode, type ThemePalette } from './tokens';

const STORAGE_KEY = 'ffcal.themeMode';

type ThemeContextValue = {
  mode: ThemeMode; // user's selected mode: system | light | dark
  setMode: (m: ThemeMode) => void;
  scheme: 'light' | 'dark'; // resolved scheme actually in use
  tokens: ThemePalette;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  setMode: () => {},
  scheme: 'light',
  tokens: light,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sysScheme = useRNColorScheme() ?? Appearance.getColorScheme() ?? 'light';
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'system' || v === 'light' || v === 'dark') setModeState(v);
    });
  }, []);

  const scheme: 'light' | 'dark' = mode === 'system' ? (sysScheme ?? 'light') : mode;
  const tokens = scheme === 'dark' ? dark : light;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      scheme,
      tokens,
      setMode: (m) => {
        setModeState(m);
        AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
      },
    }),
    [mode, scheme, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Convenience: just the resolved token palette. Same name as the old hook for migration. */
export function useThemeColors(): ThemePalette {
  return useContext(ThemeContext).tokens;
}
