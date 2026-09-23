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
  reauthentication_required: 'Por segurança, confirme com o código enviado ao seu e-mail.',
  // Detalhes por modalidade
  distance_not_allowed: 'Distância não vale para esta modalidade.',
  strength_not_allowed: 'Séries e carga não valem para esta modalidade.',
  invalid_distance: 'A distância vai de 10 metros a 200 km.',
  invalid_sets: 'O número de séries vai de 1 a 60.',
  invalid_load: 'A carga vai de 0,5 a 500 kg, de meio em meio quilo.',
  // Catálogo, fichas e sessão
  invalid_exercise_name: 'Use de 2 a 60 caracteres: letras, números, espaço, parênteses, ponto, apóstrofo ou hífen.',
  invalid_muscle_group: 'Escolha um dos grupos musculares.',
  invalid_equipment: 'Escolha um dos equipamentos.',
  invalid_exercise: 'Escolha um exercício do catálogo ou um dos seus.',
  invalid_routine_name: 'Use de 2 a 40 caracteres no nome da ficha.',
  invalid_routine_items: 'Confira as séries, repetições e cargas da ficha.',
  routine_not_found: 'Esta ficha não existe mais.',
  invalid_sets_list: 'Confira as séries do treino: repetições de 1 a 200 e carga de meio em meio quilo.',
  sets_not_allowed: 'Séries valem só para musculação e funcional.',
  // Anais e correção de treino
  workout_not_found: 'Este treino não existe mais.',
  week_closed: 'Esta semana já fechou. Só dá para corrigir treino da semana corrente — o Coliseu daquela semana já foi disputado.',
  invalid_workout: 'Não foi possível identificar o treino.',
  note_not_allowed: 'O campo livre existe só nas modalidades "outro".',
  invalid_note: 'O campo livre tem no máximo 40 caracteres.',
  // Juramento da semana
  invalid_goal: 'A meta vai de 1 a 7 dias por semana.',
  // Medidas de saúde
  health_consent_required: 'Ligue o registro de frequência cardíaca no Perfil antes de informá-la.',
  invalid_heart_rate: 'A frequência cardíaca vai de 30 a 240 bpm, e a média não passa da máxima.',
  invalid_consent: 'Não foi possível salvar essa escolha. Tente de novo.',
};

export const RPC_MESSAGES = {
  network: 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  generic: 'Não foi possível concluir agora. Tente de novo em instantes.',
} as const;

/** Falha de rede no supabase-js: sem código do Postgres e mensagem vinda do fetch. */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (code === '' || code === undefined) && typeof message === 'string' && /fetch|network/i.test(message);
}

export function rpcErrorMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null) return RPC_MESSAGES.generic;
  const { message } = error as { message?: unknown };

  if (typeof message === 'string' && Object.hasOwn(MESSAGES, message)) return MESSAGES[message];
  if (isNetworkFailure(error)) return RPC_MESSAGES.network;
  return RPC_MESSAGES.generic;
}

/** Código estável do erro, quando é um dos conhecidos (para decidir o que fazer, não para exibir). */
export function rpcErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const { message } = error as { message?: unknown };
  return typeof message === 'string' && Object.hasOwn(MESSAGES, message) ? message : null;
}

/** Erro já pronto para a tela: `message` é texto para a pessoa; `code`, o código estável (ou null). */
export class ApiError extends Error {
  readonly code: string | null;
  /** Verdadeiro quando o pedido nem chegou ao servidor (sem internet, servidor fora do ar). */
  readonly network: boolean;

  constructor(message: string, code: string | null = null, network = false) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.network = network;
  }
}

export function toApiError(error: unknown): ApiError {
  return new ApiError(rpcErrorMessage(error), rpcErrorCode(error), isNetworkFailure(error));
}

/** Resposta fora do formato combinado com o banco: tratada como falha, nunca como dado válido. */
export function unexpectedResponse(): ApiError {
  return new ApiError(RPC_MESSAGES.generic);
}

/** Texto de erro para qualquer falha vinda de uma consulta ou ação. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : RPC_MESSAGES.generic;
}
