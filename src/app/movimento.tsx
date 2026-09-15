import { Redirect } from 'expo-router';

import { MotionGallery } from '@/features/celebrations/motion-gallery';

/**
 * Galeria de movimento (só desenvolvimento): celebrações e kit com dados de exemplo, sem conta
 * e sem chamadas ao servidor. Em produção a rota não mostra nada e volta para o início.
 */
export default function MotionGalleryScreen() {
  if (!__DEV__) return <Redirect href="/" />;
  return <MotionGallery />;
}
