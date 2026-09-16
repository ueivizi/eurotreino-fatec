import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { LoadingScreen, StatusScreen } from '@/components/status-screen';
import { useSession } from '@/features/auth/session';
import { OAUTH_CANCELLED_MESSAGE, exchangeAuthCode, isAuthCode } from '@/features/auth/oauth';

/**
 * Retorno do login social (Web, e no celular quando o sistema entrega o link ao app).
 * O código só é trocado pela sessão sem ninguém conectado; depois, vai direto à tela do estado.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { state } = useSession();
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const code = isAuthCode(params.code) ? params.code : null;
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    // Navegar para rota protegida é bloqueado (não redireciona): vai direto à tela do estado atual.
    if (state.status === 'ready') router.replace('/');
    else if (state.status === 'needs-profile') router.replace('/perfil-inicial');
  }, [state.status, router]);

  useEffect(() => {
    if (state.status !== 'signed-out' || !code) return;
    let active = true;
    exchangeAuthCode(code)
      .then((result) => {
        if (active && result.status === 'error') setFailure(result.message);
      })
      .catch(() => {
        if (active) setFailure('Não foi possível concluir a entrada. Tente de novo.');
      });
    return () => {
      active = false;
    };
  }, [state.status, code]);

  if (state.status === 'signed-out' && (!code || failure)) {
    const description =
      failure ??
      (params.error === 'access_denied' ? OAUTH_CANCELLED_MESSAGE : 'O retorno do login veio incompleto. Tente entrar de novo.');
    return (
      <StatusScreen
        icon="info"
        title="Não foi possível entrar"
        description={description}
        actions={[{ label: 'Voltar para a entrada', onPress: () => router.replace('/entrar') }]}
      />
    );
  }

  return <LoadingScreen />;
}
