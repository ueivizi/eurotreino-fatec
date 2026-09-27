import type { ComponentProps } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { space } from '@/theme/tokens';

type Props = ComponentProps<typeof KeyboardAwareScrollView>;

/**
 * Rolagem de tela com campo de digitação. Com o teclado aberto, rola até o campo focado e deixa
 * uma folga por cima dele: no Android de ponta a ponta o sistema não encolhe a tela sozinho, e o
 * campo ficava atrás do teclado (achado do teste de 27/09). Na Web, é uma rolagem comum.
 */
export function FormScrollView({ bottomOffset = space.xxl, keyboardShouldPersistTaps = 'handled', ...rest }: Props) {
  return <KeyboardAwareScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...rest} />;
}
