import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { AppText } from '@/components/ui/text';
import { deviceStorage } from '@/lib/device-storage';
import { useTheme } from '@/theme/theme';
import { space } from '@/theme/tokens';

import type { Profile } from './profile-api';

const SEEN_KEY = 'eurotreino.escolhas.aviso';

/**
 * Aviso único no Início para quem já usava o app antes das escolhas de dados: quem chega agora vê
 * as escolhas no primeiro acesso. Some ao abrir as escolhas ou ao dispensar.
 */
export function ChoicesInvite({ profile }: { profile: Profile }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const untouched = profile.photoConsentAt === null && profile.locationConsentAt === null;

  useEffect(() => {
    if (!untouched) return;
    let alive = true;
    void deviceStorage
      .getItem(SEEN_KEY)
      .then((seen) => {
        if (alive && seen !== '1') setVisible(true);
      })
      // Sem armazenamento, o aviso não aparece: as escolhas continuam em Configurações.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [untouched]);

  if (!visible || !untouched) return null;

  function dismiss(open: boolean) {
    setVisible(false);
    void deviceStorage.setItem(SEEN_KEY, '1').catch(() => undefined);
    if (open) router.push('/escolhas');
  }

  return (
    <Reveal>
      <Card style={[styles.card, { borderColor: colors.gold }]}>
        <View style={styles.row}>
          <Icon name="escudo" size={22} color={colors.goldHighlight} />
          <View style={styles.text}>
            <AppText variant="overline" tone="gold">Novo · suas escolhas</AppText>
            <AppText variant="label" tone="secondary">
              Foto no perfil, localização (mapa e GPS no treino) e frequência cardíaca agora são escolhas suas. Tudo fica desligado até você ligar.
            </AppText>
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.text}>
            <Button label="Ver escolhas" variant="secondary" onPress={() => dismiss(true)} />
          </View>
          <Button label="Agora não" variant="ghost" onPress={() => dismiss(false)} />
        </View>
      </Card>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
