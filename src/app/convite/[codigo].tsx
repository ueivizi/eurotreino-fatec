import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { LoadingScreen, StatusScreen } from '@/components/status-screen';
import { useSession } from '@/features/auth/session';
import { inviteCodeFromLink } from '@/features/legions/invite-code';
import { rememberInvite } from '@/features/legions/pending-invite';

/**
 * Link de convite (eurotreino://convite/ABCD-2345). O parâmetro é validado pela regra do código
 * antes de qualquer uso; sem sessão, o código fica guardado até a pessoa entrar.
 */
export default function InviteLinkScreen() {
  const router = useRouter();
  const { state } = useSession();
  const params = useLocalSearchParams<{ codigo?: string }>();
  const code = inviteCodeFromLink(params.codigo);

  useEffect(() => {
    if (!code) return;
    // Navegar para uma rota protegida é bloqueado (não redireciona): vai direto à tela do estado atual.
    if (state.status === 'ready') {
      router.replace({ pathname: '/legioes/entrar', params: { codigo: code } });
    } else if (state.status === 'signed-out') {
      rememberInvite(code);
      router.replace('/entrar');
    } else if (state.status === 'needs-profile') {
      rememberInvite(code);
      router.replace('/perfil-inicial');
    }
  }, [code, state.status, router]);

  if (!code) {
    return (
      <StatusScreen
        icon="legiao"
        title="Link de convite inválido"
        description="O link está incompleto. Peça um novo ou digite o código em Legião › Entrar com código."
        actions={[
          {
            label: 'Continuar',
            onPress: () =>
              router.replace(
                state.status === 'ready' ? '/' : state.status === 'needs-profile' ? '/perfil-inicial' : '/entrar',
              ),
          },
        ]}
      />
    );
  }

  return <LoadingScreen />;
}
