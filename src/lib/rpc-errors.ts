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
  // Mural da Legião
  invalid_message: 'A mensagem vai de 1 a 500 caracteres.',
  link_not_allowed: 'O Mural não aceita link. Combine o treino por aqui e mande o endereço por fora.',
  message_not_found: 'Esta mensagem não existe mais.',
  cannot_report_own: 'Você não pode denunciar a própria mensagem. Se quiser, apague.',
  // Estandarte e modos de Legião
  invalid_emblem_color: 'Escolha uma das cores.',
  invalid_group_mode: 'Escolha entre Legião clássica e competitiva.',
  invalid_weekly_minimum: 'Na Legião competitiva, o mínimo é de 2, 3 ou 4 treinos por semana.',
  minimum_locked: 'O mínimo fica o mesmo enquanto a Legião é competitiva. Para mudar, volte para clássica e recomece.',
  not_competitive: 'Esta Legião é clássica: não tem temporada nem Louros.',
  invalid_season_offset: 'Temporada indisponível.',
  member_not_found: 'Este perfil não está em nenhuma das suas Legiões.',
  // Medidas de saúde
  health_consent_required: 'Ligue o registro de frequência cardíaca em Configurações antes de informá-la.',
  invalid_heart_rate: 'A frequência cardíaca vai de 30 a 240 bpm, e a média não passa da máxima.',
  invalid_consent: 'Não foi possível salvar essa escolha. Tente de novo.',
  // Foto de perfil
  photo_consent_required: 'Ligue a foto de perfil nas suas escolhas antes de enviar uma foto.',
  avatar_not_uploaded: 'A foto não chegou ao servidor. Tente enviar de novo.',
  invalid_avatar: 'Não foi possível salvar a foto. Tente de novo.',
  // Roteador (função rotas)
  no_route: 'Não achamos caminho por ali. Tente pontos mais perto de uma rua, ciclovia ou trilha.',
  routing_unavailable: 'O roteador está indisponível agora. Dá para desenhar a rota à mão, ponto a ponto.',
  // Rotas da Legião
  invalid_route_name: 'Use de 2 a 40 caracteres no nome: letras, números, espaço e os sinais . , \' ( ) / -',
  invalid_route: 'Essa rota não pode ser compartilhada: ela precisa ter de 100 m a 200 km.',
  route_limit_reached: 'Esta Legião já tem 100 rotas. Apague alguma antes de compartilhar outra.',
  cannot_delete_route: 'Só quem compartilhou a rota ou o fundador pode apagá-la.',
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
