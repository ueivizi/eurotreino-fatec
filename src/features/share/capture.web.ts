import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * No navegador não existe folha de partilha do sistema. A captura vira um arquivo em memória e
 * segue por um de dois caminhos: a partilha do próprio navegador, quando ela aceita arquivo, ou o
 * download. Em nenhum dos dois a imagem sai do aparelho por nossa conta.
 */

export const IMAGE_WIDTH = 1080;
export const IMAGE_HEIGHT = 1920;

export type CaptureOutcome = 'shared' | 'downloaded' | 'unsupported' | 'failed';

export const CAPTURE_FEEDBACK: Record<CaptureOutcome, string | null> = {
  shared: null,
  downloaded: 'Imagem baixada. É só publicar onde quiser.',
  unsupported: 'Este navegador não consegue gerar a imagem. Use o aplicativo no celular.',
  failed: 'Não foi possível gerar a imagem agora.',
};

type FileShare = {
  canShare?: (data: { files: File[] }) => boolean;
  share?: (data: { files: File[] }) => Promise<void>;
};

export async function shareViewAsImage(ref: RefObject<View | null>): Promise<CaptureOutcome> {
  let file: File;
  try {
    const dataUri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'data-uri',
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    });
    const blob = await (await fetch(dataUri)).blob();
    file = new File([blob], 'eurotreino.png', { type: 'image/png' });
  } catch {
    return 'failed';
  }

  const navigatorWithShare = (globalThis as { navigator?: FileShare }).navigator;
  if (navigatorWithShare?.canShare?.({ files: [file] }) && typeof navigatorWithShare.share === 'function') {
    try {
      await navigatorWithShare.share({ files: [file] });
      return 'shared';
    } catch {
      // Cancelado pela pessoa ou bloqueado pelo navegador: cai no download.
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}
