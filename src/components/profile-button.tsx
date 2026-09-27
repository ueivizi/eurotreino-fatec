import { useRouter } from 'expo-router';

import { PressableScale } from '@/components/motion/pressable-scale';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { useProfile } from '@/features/auth/session';
import { useMyPhoto } from '@/features/profile/photo';

/**
 * A foto (ou o emblema) no topo de cada aba: é o caminho para o Perfil, que saiu da barra de baixo
 * para o medalhão do Registrar voltar ao centro (decisão do usuário em 27/09).
 */
export function ProfileButton({ size = 40 }: { size?: number }) {
  const router = useRouter();
  const profile = useProfile();
  const photo = useMyPhoto(profile?.id, profile?.avatarUpdatedAt);
  if (!profile) return null;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel="Abrir meu perfil" hitSlop={8} onPress={() => router.navigate('/perfil')}>
      <EmblemAvatar emblem={profile.emblem} color={profile.emblemColor} size={size} photoUri={photo} />
    </PressableScale>
  );
}
