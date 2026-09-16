import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

/**
 * Compartilhar texto. No celular abre a folha do sistema; na Web usa a partilha do navegador
 * quando existe e, quando não existe, copia para a área de transferência — assim o botão nunca
 * fica sem resposta. Falha aqui não quebra a tela: o treino já está registrado.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

type WebShare = { share?: (data: { text: string }) => Promise<void> };

export async function shareText(message: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const navigatorWithShare = (globalThis as { navigator?: WebShare }).navigator;
    if (typeof navigatorWithShare?.share === 'function') {
      try {
        await navigatorWithShare.share({ text: message });
        return 'shared';
      } catch {
        // Cancelado pela pessoa ou bloqueado pelo navegador: cai na cópia.
      }
    }
    try {
      await Clipboard.setStringAsync(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }

  try {
    const result = await Share.share({ message });
    return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return 'failed';
  }
}

export const SHARE_FEEDBACK: Record<ShareOutcome, string | null> = {
  shared: null,
  copied: 'Texto copiado. É só colar onde quiser.',
  cancelled: null,
  failed: 'Não foi possível compartilhar agora.',
};
