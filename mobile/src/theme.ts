import { useColorScheme } from 'react-native';

const light = {
  background: '#f7f9f8', surface: '#ffffff', foreground: '#163b2a',
  secondary: '#3c5b4b', primary: '#215c3e', onPrimary: '#ffffff',
  outline: '#81978b', separator: '#d6e2db', error: '#962e25', selected: '#e0f0e6',
};
const dark: typeof light = {
  background: '#111b16', surface: '#1a2920', foreground: '#e4f1e8',
  secondary: '#b2cabb', primary: '#add9bc', onPrimary: '#123821',
  outline: '#849b8c', separator: '#385043', error: '#ffb4a9', selected: '#294c37',
};

export function useTheme() { return useColorScheme() === 'dark' ? dark : light; }

export const typography = {
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700' as const },
  heading: { fontSize: 22, lineHeight: 30, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 25 },
  label: { fontSize: 16, lineHeight: 24, fontWeight: '600' as const },
  detail: { fontSize: 15, lineHeight: 22 },
};
