/**
 * Escolha de exercício entre telas. O Expo Router navega, não devolve valor: a tela do catálogo
 * deixa aqui o que foi escolhido e quem pediu recolhe ao voltar. Fica só na memória, como o convite
 * pendente — some quando o app fecha, e é isso mesmo que se espera de uma escolha em andamento.
 */
export type PickerTarget = { kind: 'routine'; routineId: string | null } | { kind: 'session' };

let request: PickerTarget | null = null;
let picked: string | null = null;

export function requestExercise(target: PickerTarget) {
  request = target;
  picked = null;
}

export function currentRequest(): PickerTarget | null {
  return request;
}

export function pickExercise(exerciseId: string) {
  picked = exerciseId;
}

/** Recolhe o exercício escolhido (uma vez só). */
export function takePickedExercise(): string | null {
  const value = picked;
  picked = null;
  request = null;
  return value;
}
