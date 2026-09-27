import { Cinzel_600SemiBold, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { useReducedMotionPreference } from '@/components/motion/reduced-motion';
import { LoadingScreen, StatusScreen } from '@/components/status-screen';
import { SessionProvider, useSession } from '@/features/auth/session';
import { TrainingSessionProvider } from '@/features/training/session-provider';
import { OfflineQueueProvider } from '@/features/workouts/offline-queue-provider';
import { queryClient } from '@/lib/query-client';
import type { SupabaseConfigProblem } from '@/lib/supabase-config';
import { supabaseConfig } from '@/lib/supabase';
import { duration } from '@/theme/motion';
import { AppThemeProvider, useTheme } from '@/theme/theme';
import { palettes, type ThemeName } from '@/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Se a splash já tiver sido escondida (ex.: recarga rápida), o app segue normalmente.
});

/** O tema da navegação segue o tema do app: fundo, cartões e filetes iguais aos das telas. */
function navigationThemeFor(name: ThemeName) {
  const base = name === 'marmore' ? DefaultTheme : DarkTheme;
  const colors = palettes[name];
  return {
    ...base,
    colors: {
      ...base.colors,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.hairlineSoft,
      primary: colors.gold,
    },
  };
}

const CONFIG_PROBLEMS: Record<SupabaseConfigProblem, string> = {
  missing: 'Crie o arquivo .env a partir do .env.example, com a URL e a chave publicável do projeto Supabase.',
  invalid_url: 'A URL do projeto no arquivo .env não está no formato esperado.',
  invalid_key: 'A chave publicável no arquivo .env não está no formato esperado.',
  secret_key: 'O arquivo .env tem uma chave secreta. Troque pela chave publicável: a secreta nunca pode ir para o app.',
};

function useHideSplash(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {
      // Esconder a splash é só visual; uma falha aqui não bloqueia o uso do app.
    });
  }, [ready]);
}

function RootNavigator() {
  const { state, retry, signOut } = useSession();
  const { colors } = useTheme();
  const reduced = useReducedMotionPreference();
  useHideSplash(state.status !== 'loading');

  if (state.status === 'loading') return <LoadingScreen />;

  if (state.status === 'unavailable') {
    return (
      <StatusScreen
        icon="info"
        title="Sem conexão com o servidor"
        description="Não conseguimos carregar seu perfil. Verifique a internet e tente de novo."
        actions={[
          { label: 'Tentar de novo', onPress: retry },
          { label: 'Sair', onPress: () => void signOut(), variant: 'ghost' },
        ]}
      />
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        /*
         * Abrir uma tela é movimento também. O Android não tinha transição nenhuma — a tela
         * trocava seca —, então ganha a entrada pela direita, no mesmo tempo do resto do kit
         * (`duration.base`). O iPhone mantém a sua: a transição nativa é que carrega o gesto de
         * voltar arrastando da borda, e trocá-la custaria mais do que ganharia.
         * Com "reduzir movimento" ligado no sistema, nada desliza: as telas se cruzam.
         */
        animation: reduced ? 'fade' : Platform.OS === 'ios' ? 'default' : 'slide_from_right',
        animationDuration: duration.base,
      }}>
      <Stack.Protected guard={state.status === 'signed-out'}>
        <Stack.Screen name="entrar" />
        <Stack.Screen name="criar-conta" />
        <Stack.Screen name="recuperar-senha" />
      </Stack.Protected>
      <Stack.Protected guard={state.status === 'needs-profile'}>
        <Stack.Screen name="perfil-inicial" />
      </Stack.Protected>
      {/* Toda rota precisa estar declarada aqui: rota não declarada fica acessível sem guarda. */}
      <Stack.Protected guard={state.status === 'ready'}>
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
        <Stack.Screen name="legioes/nova" />
        <Stack.Screen name="legioes/entrar" />
        <Stack.Screen name="legioes/[id]" />
        <Stack.Screen name="membro/[id]" />
        <Stack.Screen name="mural/[id]" />
        <Stack.Screen name="editar-perfil" />
        <Stack.Screen name="configuracoes" />
        <Stack.Screen name="anais" />
        <Stack.Screen name="corrigir/[id]" />
        <Stack.Screen name="compartilhar/[id]" />
        <Stack.Screen name="meta" />
        <Stack.Screen name="excluir-conta" />
        <Stack.Screen name="ranks" />
        <Stack.Screen name="honra" />
        <Stack.Screen name="dispositivos" />
        <Stack.Screen name="fichas" />
        <Stack.Screen name="fichas/[id]" />
        <Stack.Screen name="exercicios" />
        <Stack.Screen name="sessao" />
        <Stack.Screen name="gloria" />
        <Stack.Screen name="comecar" />
      </Stack.Protected>
      {/* Abrem em qualquer estado: link de convite (guarda o código até a pessoa entrar), retorno do
          login social e documentos legais (acessíveis antes de criar a conta). */}
      <Stack.Screen name="convite/[codigo]" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="privacidade" />
      <Stack.Screen name="termos" />
    </Stack>
  );
}

/** Fica dentro do provedor de tema: navegação, barra de status e fundo seguem o tema escolhido. */
function ThemedApp({ children }: { children: ReactNode }) {
  const { name } = useTheme();
  return (
    <ThemeProvider value={navigationThemeFor(name)}>
      <StatusBar style={name === 'marmore' ? 'dark' : 'light'} />
      {children}
    </ThemeProvider>
  );
}

function ConfigurationProblem({ problem }: { problem: SupabaseConfigProblem }) {
  useHideSplash(true);
  return <StatusScreen icon="info" title="Configuração incompleta" description={CONFIG_PROBLEMS[problem]} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    CormorantGaramond_500Medium_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  // Sem as fontes, o texto cai nas fontes do sistema: o app continua utilizável.
  if (!fontsLoaded && !fontError) return null;

  return (
    <AppThemeProvider>
      <ThemedApp>
        {supabaseConfig.ok ? (
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <OfflineQueueProvider>
                <TrainingSessionProvider>
                  <RootNavigator />
                </TrainingSessionProvider>
              </OfflineQueueProvider>
            </SessionProvider>
          </QueryClientProvider>
        ) : (
          <ConfigurationProblem problem={supabaseConfig.problem} />
        )}
      </ThemedApp>
    </AppThemeProvider>
  );
}
