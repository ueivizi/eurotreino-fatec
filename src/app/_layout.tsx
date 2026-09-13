import { Cinzel_600SemiBold, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppThemeProvider } from '@/theme/theme';
import { palettes } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Se a splash já tiver sido escondida (ex.: recarga rápida), o app segue normalmente.
});

const colors = palettes.onix;

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.hairlineSoft,
    primary: colors.gold,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    CormorantGaramond_500Medium_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {
        // Esconder a splash é só visual; uma falha aqui não bloqueia o uso do app.
      });
    }
  }, [fontsLoaded, fontError]);

  // Sem as fontes, o texto cai nas fontes do sistema: o app continua utilizável.
  if (!fontsLoaded && !fontError) return null;

  return (
    <AppThemeProvider name="onix">
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="registrar"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.9],
              sheetGrabberVisible: true,
              sheetCornerRadius: 12,
              contentStyle: { backgroundColor: colors.surfaceRaised },
            }}
          />
        </Stack>
      </ThemeProvider>
    </AppThemeProvider>
  );
}
