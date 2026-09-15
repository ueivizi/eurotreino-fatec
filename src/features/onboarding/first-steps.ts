/**
 * Primeiros passos logo depois do perfil inicial: "Como conquistar Glória" e "Treine com sua Legião".
 * Fica só na memória: se o app for recarregado no meio, as telas são puladas e o Início continua
 * mostrando o caminho para fundar ou entrar em uma Legião.
 */
let pending = false;

export function startFirstSteps() {
  pending = true;
}

export function takeFirstSteps(): boolean {
  const value = pending;
  pending = false;
  return value;
}
