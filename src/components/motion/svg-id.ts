import { useId } from 'react';

/**
 * Id único para gradientes SVG. Na Web, dois `<radialGradient>` com o mesmo id no documento
 * se sobrescrevem; os dois-pontos do `useId` quebrariam o `url(#...)`, então ficam de fora.
 */
export function useSvgId(prefix: string): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
