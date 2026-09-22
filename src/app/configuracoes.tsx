import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { LinkRow } from '@/components/ui/link-row';
import { Notice } from '@/components/ui/notice';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AppText } from '@/components/ui/text';
import { setHealthConsent } from '@/features/account/account-api';
import { useSession } from '@/features/auth/session';
import { useOfflineQueue } from '@/features/workouts/offline-queue-provider';
import { queryKeys } from '@/lib/query-client';
import { errorMessage } from '@/lib/rpc-errors';
import { THEME_OPTIONS, useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

/**
 * Configurações: aparência, privacidade, aparelhos e conta.
 *
 * Estavam todas no Perfil, misturadas com rank e Legiões — e quem testou em 20/09 disse que
 * procurava ajuste e achava conquista. Perfil é quem você é; aqui é como o app se comporta.
 */
export default function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { state, signOut, retry: refreshProfile } = useSession();
  const queryClient = useQueryClient();
  const queue = useOfflineQueue();
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const consent = useMutation({
    mutationFn: (granted: boolean) => setHealthConsent(granted),
    onSuccess: () => {
      // O perfil guarda o consentimento: recarrega para a tela refletir na hora.
      refreshProfile();
      void queryClient.invalidateQueries({ queryKey: queryKeys.progress });
    },
  });

  if (state.status !== 'ready') return null;
  const { profile } = state;

  async function leave() {
    if (queue.pending.length > 0 && !confirmSignOut) {
      setConfirmSignOut(true);
      return;
    }
    await queue.discardMine();
    await signOut();
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xxxl }]}>
      <ScreenHeader title="Configurações" subtitle="Aparência, privacidade e conta" />

      <View style={styles.section}>
        <AppText variant="overline" tone="muted">Aparência</AppText>
        <SegmentedControl options={THEME_OPTIONS} value={preference} onChange={setPreference} accessibilityLabel="Tema do app" />
        <AppText variant="caption" tone="muted">
          {preference === 'sistema'
            ? 'Segue o tema claro ou escuro do seu aparelho.'
            : preference === 'marmore'
              ? 'Mármore: tema claro, para luz forte.'
              : 'Ônix: tema escuro, o padrão do EuroTreino.'}
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="overline" tone="muted">Aparelhos</AppText>
        <LinkRow
          label="Relógios e GPX"
          icon="relogio"
          description="Traga os treinos do seu relógio ou de um arquivo"
          onPress={() => router.push('/dispositivos')}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="overline" tone="muted">Privacidade</AppText>
        <View style={styles.privacy}>
          <Icon name="escudo" size={18} color={colors.gold} />
          <AppText variant="label" tone="secondary" style={styles.flex}>
            Seu perfil só aparece para membros das suas Legiões. Seus treinos ficam só com você.
          </AppText>
        </View>
        <View style={styles.consent}>
          <View style={styles.flex}>
            <AppText variant="bodyMedium">Registrar frequência cardíaca</AppText>
            <AppText variant="caption" tone="muted">
              {profile.healthConsentAt
                ? 'Ligado: o campo aparece ao registrar treino. Desligar apaga as medidas já guardadas.'
                : 'Desligado. Frequência cardíaca é dado sensível de saúde: só registramos com seu consentimento.'}
            </AppText>
          </View>
        </View>
        <Button
          label={consent.isPending ? 'Salvando…' : profile.healthConsentAt ? 'Desligar e apagar medidas' : 'Ligar o registro'}
          variant="secondary"
          icon={profile.healthConsentAt ? 'excluir' : 'check'}
          onPress={() => consent.mutate(!profile.healthConsentAt)}
          disabled={consent.isPending}
        />
        {consent.isError ? <Notice tone="danger" message={errorMessage(consent.error)} /> : null}
        <LinkRow label="Política de Privacidade" icon="pergaminho" onPress={() => router.push('/privacidade')} />
        <LinkRow label="Termos de Uso" icon="pergaminho" onPress={() => router.push('/termos')} />
      </View>

      <View style={styles.section}>
        <AppText variant="overline" tone="muted">Conta</AppText>
        {confirmSignOut ? (
          <Notice
            message={`Você tem ${queue.pending.length} ${queue.pending.length === 1 ? 'treino guardado' : 'treinos guardados'} neste aparelho, ainda sem envio. Ao sair, eles são descartados e não rendem Glória.`}
          />
        ) : null}
        <Button label={confirmSignOut ? 'Sair mesmo assim' : 'Sair'} icon="sair" variant="secondary" onPress={() => void leave()} />
        {confirmSignOut ? <Button label="Cancelar" variant="ghost" onPress={() => setConfirmSignOut(false)} /> : null}
        <LinkRow
          label="Excluir conta e dados"
          icon="excluir"
          tone="danger"
          description="Apaga seu perfil, seus treinos e sua Glória"
          onPress={() => router.push('/excluir-conta')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.xl,
    gap: space.xl,
  },
  section: {
    gap: space.xs,
  },
  consent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginBottom: space.xs,
  },
  flex: {
    flex: 1,
  },
});
