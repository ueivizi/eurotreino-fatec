/**
 * As funções do banco sinalizam erros esperados com códigos estáveis na mensagem
 * (ex.: 'invalid_group_name'). Aqui eles viram texto para a pessoa. Qualquer código
 * desconhecido cai na mensagem genérica: detalhes do servidor nunca aparecem na tela.
 */

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Sua sessão terminou. Entre de novo.',
  profile_required: 'Complete seu perfil para continuar.',
  invalid_display_name: 'Use de 2 a 32 caracteres: letras, números, espaço, ponto, apóstrofo ou hífen.',
  invalid_emblem: 'Escolha um dos emblemas.',
  invalid_group_name: 'Use de 3 a 40 caracteres: letras, números, espaço e os sinais . \' - & !',
  group_limit_reached: 'Você já está no limite de 10 Legiões.',
  group_full: 'Esta Legião já tem 50 membros.',
  not_a_member: 'Você não faz parte desta Legião.',
  not_group_owner: 'Só o fundador da Legião pode fazer isso.',
  rate_limited: 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.',
  invalid_workout_type: 'Escolha um dos tipos de treino.',
  invalid_duration: 'A duração vai de 1 a 300 minutos.',
  invalid_intensity: 'Escolha a intensidade do treino.',
  performed_at_in_future: 'O horário do treino não pode estar no futuro.',
  performed_at_too_old: 'Só dá para registrar treinos das últimas 48 horas.',
  request_id_conflict: 'Este registro já foi enviado com outros dados. Abra o registro de novo.',
  invalid_request_id: 'Não foi possível identificar o registro. Tente de novo.',
  invalid_week_offset: 'Semana indisponível.',
};

export const RPC_MESSAGES = {
  network: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  generic: 'Não foi possível concluir agora. Tente de novo em instantes.',
} as const;

export function rpcErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return RPC_MESSAGES.generic;
  const { code, message } = error as { code?: unknown; message?: unknown };

  if (typeof message === 'string' && Object.hasOwn(MESSAGES, message)) return MESSAGES[message];
  // Falha de rede no supabase-js: sem código do Postgres e mensagem vinda do fetch.
  if ((code === '' || code === undefined) && typeof message === 'string' && /fetch|network/i.test(message)) {
    return RPC_MESSAGES.network;
  }
  return RPC_MESSAGES.generic;
}

/** Código estável do erro, quando é um dos conhecidos (para decidir o que fazer, não para exibir). */
export function rpcErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { message } = error as { message?: unknown };
  return typeof message === 'string' && Object.hasOwn(MESSAGES, message) ? message : null;
}
