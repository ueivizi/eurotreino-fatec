import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Reveal } from '@/components/motion/reveal';
import { EmblemAvatar } from '@/components/rank/emblem-avatar';
import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { StepProgress } from '@/components/ui/step-progress';
import { AppText } from '@/components/ui/text';
import { setDataConsent, setHealthConsent } from '@/features/account/account-api';
import { useSession } from '@/features/auth/session';
import { takePendingInvite } from '@/features/legions/pending-invite';
import { fetchOwnProfile } from '@/features/profile/profile-api';
import { deletePhotoFile, pickAndUploadPhoto, removePhoto, useMyPhoto } from '@/features/profile/photo';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

type Detail = { label: string; text: string };

function ChoiceCard({
  icon,
  title,
  promise,
  details,
  value,
  onChange,
  busy,
  disabled,
  children,
}: {
  icon: IconName;
  title: string;
  promise: string;
  details: Detail[];
  value: boolean;
  onChange: (next: boolean) => void;
  busy: boolean;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Card style={[styles.card, value ? { borderColor: colors.gold } : null]}>
      <View style={styles.cardHead}>
        <View style={[styles.cardIcon, { borderColor: value ? colors.gold : colors.hairline }]}>
          <Icon name={icon} size={22} color={value ? colors.goldHighlight : colors.textSecondary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="subheading">{title}</AppText>
          <AppText variant="label" tone="secondary">{promise}</AppText>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={busy || disabled}
          trackColor={{ false: colors.track, true: colors.goldDeep }}
          thumbColor={value ? colors.goldHighlight : colors.textSecondary}
          accessibilityLabel={`${title}: ${value ? 'ligado' : 'desligado'}`}
        />
      </View>
      {details.map((detail) => (
        <View key={detail.label} style={styles.detail}>
          <AppText variant="caption" tone="gold" style={styles.detailLabel}>{detail.label}</AppText>
          <AppText variant="caption" tone="secondary" style={styles.flex}>{detail.text}</AppText>
        </View>
      ))}
      {children}
    </Card>
  );
}

/**
 * Suas escolhas de dados: o que o app pode usar, uma finalidade por vez e tudo desligado de
 * início. Aparece no primeiro acesso (etapa 3 de 4) e fica em Configurações.
 */
export default function ChoicesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { state, profileSaved } = useSession();
  const onboarding = useLocalSearchParams<{ primeiro?: string }>().primeiro === '1';
  const [notice, setNotice] = useState<{ tone: 'info' | 'danger'; message: string } | null>(null);

  const profile = state.status === 'ready' ? state.profile : null;
  const userId = profile?.id ?? null;
  const photo = useMyPhoto(userId, profile?.avatarUpdatedAt);

  // Recarrega o perfil sem passar pela tela de carregamento (que desmontaria a navegação).
  async function reloadProfile() {
    if (!userId) return;
    const lookup = await fetchOwnProfile(userId);
    if (lookup.kind === 'found') profileSaved(lookup.profile);
    void queryClient.invalidateQueries({ queryKey: queryKeys.photosAll });
  }

  const change = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => {
      setNotice(null);
      await action();
    },
    onSettled: () => void reloadProfile(),
    onError: (error) => setNotice({ tone: 'danger', message: errorMessage(error) }),
  });

  if (!profile || !userId) return null;

  const health = profile.healthConsentAt !== null;
  const location = profile.locationConsentAt !== null;
  const photoOn = profile.photoConsentAt !== null;

  function toggleHealth(next: boolean) {
    change.mutate(() => setHealthConsent(next));
  }

  function toggleLocation(next: boolean) {
    change.mutate(async () => {
      if (next) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          setNotice({
            tone: 'info',
            message: 'O aparelho não liberou a localização. Libere para o EuroTreino nas configurações do celular e ligue de novo aqui.',
          });
          return;
        }
      }
      await setDataConsent('localizacao', next);
    });
  }

  function togglePhoto(next: boolean) {
    change.mutate(async () => {
      if (next) {
        await setDataConsent('foto', true);
        return;
      }
      // Desligar esconde a foto na hora; apagar o arquivo vem em seguida.
      await setDataConsent('foto', false);
      await deletePhotoFile(userId as string);
    });
  }

  function choosePhoto(from: 'camera' | 'galeria') {
    change.mutate(async () => {
      const result = await pickAndUploadPhoto(userId as string, from);
      if (result === 'permission_denied') {
        setNotice({ tone: 'info', message: 'O aparelho não liberou o acesso. Libere nas configurações do celular e tente de novo.' });
      }
    });
  }

  function next() {
    const code = takePendingInvite();
    if (code) router.replace({ pathname: '/legioes/entrar', params: { codigo: code } });
    else router.replace('/comecar');
  }

  const gpsAvailable = Platform.OS !== 'web';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      {onboarding ? (
        <>
          <StepProgress step={3} total={4} />
          <View style={styles.header}>
            <AppText variant="title">O que o app pode usar?</AppText>
            <AppText variant="motto" tone="gold">Você escolhe, e muda quando quiser.</AppText>
          </View>
        </>
      ) : (
        <ScreenHeader title="Suas escolhas" subtitle="O que o EuroTreino pode usar" fallbackHref="/configuracoes" />
      )}

      <AppText tone="secondary">
        Tudo começa desligado. Cada opção diz o que guarda, quem vê e onde fica. Sem nenhuma delas o app funciona inteiro.
      </AppText>

      <Reveal index={0}>
        <ChoiceCard
          icon="camera"
          title="Foto no perfil"
          promise="Uma foto sua no lugar do emblema."
          value={photoOn}
          onChange={togglePhoto}
          busy={change.isPending}
          details={[
            { label: 'Quem vê', text: 'Só os membros das suas Legiões. Ninguém de fora, nem na busca, que não existe.' },
            { label: 'Onde fica', text: 'No servidor do EuroTreino, em São Paulo, reduzida a 512 px e sem a localização da foto.' },
            { label: 'Desligar', text: 'A foto some da Legião na hora e o arquivo é apagado.' },
          ]}>
          {photoOn ? (
            <View style={styles.photoRow}>
              <EmblemAvatar emblem={profile.emblem} color={profile.emblemColor} size={72} photoUri={photo} />
              <View style={styles.photoActions}>
                {gpsAvailable ? (
                  <Button label="Tirar foto" icon="camera" variant="secondary" disabled={change.isPending} onPress={() => choosePhoto('camera')} />
                ) : null}
                <Button label="Escolher da galeria" icon="imagem" variant="secondary" disabled={change.isPending} onPress={() => choosePhoto('galeria')} />
                {profile.avatarUpdatedAt ? (
                  <Button
                    label="Tirar a foto do perfil"
                    variant="ghost"
                    disabled={change.isPending}
                    onPress={() => change.mutate(() => removePhoto(userId))}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </ChoiceCard>
      </Reveal>

      <Reveal index={1}>
        <ChoiceCard
          icon="local"
          title="GPS no treino"
          promise={gpsAvailable ? 'Mede o percurso da corrida, caminhada ou bike.' : 'Só no app instalado no celular.'}
          value={location}
          onChange={toggleLocation}
          busy={change.isPending}
          disabled={!gpsAvailable}
          details={[
            { label: 'Quando', text: 'Só durante a sessão, com o app aberto. Com a tela apagada, a gravação pausa.' },
            { label: 'Onde fica', text: 'O trajeto fica neste aparelho. Para o registro vai só a distância.' },
            { label: 'Desligar', text: 'O app para de pedir a localização. Dá para tirar a permissão no celular também.' },
          ]}
        />
      </Reveal>

      <Reveal index={2}>
        <ChoiceCard
          icon="coracao"
          title="Frequência cardíaca"
          promise="Média e máxima do treino, digitadas ou do relógio."
          value={health}
          onChange={toggleHealth}
          busy={change.isPending}
          details={[
            { label: 'Quem vê', text: 'Só você. Nunca vai para a Legião, o Coliseu ou a imagem de compartilhar.' },
            { label: 'Por quê', text: 'É dado de saúde: por lei, só com esta escolha feita por você.' },
            { label: 'Desligar', text: 'Apaga na hora todas as medidas já guardadas; os treinos continuam.' },
          ]}
        />
      </Reveal>

      {notice ? <Notice tone={notice.tone === 'danger' ? 'danger' : undefined} message={notice.message} /> : null}
      {notice?.tone === 'info' && Platform.OS !== 'web' ? (
        <Button label="Abrir configurações do celular" variant="ghost" onPress={() => void Linking.openSettings()} />
      ) : null}

      {onboarding ? <Button label="Continuar" onPress={next} disabled={change.isPending} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  header: {
    gap: space.xs,
  },
  card: {
    gap: space.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detail: {
    flexDirection: 'row',
    gap: space.sm,
  },
  detailLabel: {
    width: 64,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.sm,
  },
  photoActions: {
    flex: 1,
    gap: space.sm,
  },
  flex: {
    flex: 1,
  },
});
