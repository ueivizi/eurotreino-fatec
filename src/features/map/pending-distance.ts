/**
 * Distância medida no mapa esperando o Registrar abrir. Fica só na memória: "Usar no registro"
 * guarda aqui e o Registrar pega ao ganhar foco, venha a pessoa dele ou do Perfil.
 */
let pendingMeters: number | null = null;

export function rememberDistance(meters: number) {
  pendingMeters = meters;
}

export function takePendingDistance(): number | null {
  const meters = pendingMeters;
  pendingMeters = null;
  return meters;
}
