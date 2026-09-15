import { authStorage } from './auth-storage';

/**
 * Dados do app guardados no aparelho (fila de treinos sem conexão, preferências). Usa o mesmo
 * armazenamento da sessão: Keychain/Keystore em pedaços no celular e localStorage na Web.
 * As chaves começam com "eurotreino." para não colidir com as do Supabase.
 */
export const deviceStorage = authStorage;
