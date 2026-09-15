/** Aviso mostrado na tela de entrada logo depois de a conta ser excluída (só na memória). */
let deleted = false;

export function markAccountDeleted() {
  deleted = true;
}

export function takeAccountDeleted(): boolean {
  const value = deleted;
  deleted = false;
  return value;
}
