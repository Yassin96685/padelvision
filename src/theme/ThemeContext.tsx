import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@padelvision/theme';

export const lightColors = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  cardAlt: '#F1F5F9',
  border: '#E2E8F0',
  primary: '#00C96B',
  primaryDim: '#00C96B18',
  blue: '#3B82F6',
  blueDim: '#3B82F618',
  purple: '#7C3AED',
  purpleDim: '#7C3AED18',
  danger: '#EF4444',
  dangerDim: '#EF444418',
  warning: '#F59E0B',
  warningDim: '#F59E0B18',
  text: '#0F172A',
  textSec: '#64748B',
  textMuted: '#CBD5E1',
};

export const darkColors = {
  bg: '#090C14',
  card: '#0F1320',
  cardAlt: '#141B2B',
  border: '#1D2535',
  primary: '#00E87D',
  primaryDim: '#00E87D1A',
  blue: '#3B82F6',
  blueDim: '#3B82F61A',
  purple: '#8B5CF6',
  purpleDim: '#8B5CF61A',
  danger: '#EF4444',
  dangerDim: '#EF44441A',
  warning: '#F59E0B',
  warningDim: '#F59E0B1A',
  text: '#FFFFFF',
  textSec: '#8B95A6',
  textMuted: '#2E3A4E',
};

export type Colors = typeof lightColors;
export type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  colors: Colors;
  theme: Theme;
  toggleTheme: () => void;
}>({ colors: darkColors, theme: 'dark', toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const colors = theme === 'dark' ? darkColors : lightColors;

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    }).catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ colors, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
