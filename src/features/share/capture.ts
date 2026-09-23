import type { RefObject } from 'react';
import type { View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

/**
 * Captura o cartão e entrega à folha de partilha do sistema.
 *
 * A imagem é montada **no aparelho** e o arquivo nasce na pasta temporária do app: a foto de quem
 * compartilha não passa por servidor nenhum, nem pelo nosso. Quem decide para onde vai é a folha
 * do sistema, com a pessoa olhando.
 */

/** Tamanho da imagem final, em pixels: 9:16, o formato dos stories. */
export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1920;

export type CaptureOutcome = 'shared' | 'downloaded' | 'unsupported' | 'failed';

export const CAPTURE_FEEDBACK: Record<CaptureOutcome, string | null> = {
  shared: null,
  downloaded: 'Imagem baixada. É só publicar onde quiser.',
  unsupported: 'Este aparelho não tem para onde compartilhar a imagem.',
  failed: 'Não foi possível gerar a imagem agora.',
};

export async function shareViewAsImage(ref: RefObject<View | null>): Promise<CaptureOutcome> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unsupported';
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Compartilhar treino' });
    return 'shared';
  } catch {
    return 'failed';
  }
}
