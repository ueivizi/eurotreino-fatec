// Edge Function delete-account (RF011 · LGPD): exclui a conta de quem chama e, em cascata no
// banco, perfil, treinos, vínculos com Legiões e tentativas de convite.
//
// Segurança:
// - A plataforma valida o JWT antes de chegar aqui (verify_jwt ligado) e a função valida de novo
//   com getClaims: só o próprio usuário é excluído, nunca um id vindo do corpo do pedido.
// - Exige confirmação recente por código no e-mail (ver policy.ts): sessão roubada não basta.
// - A chave secreta existe só no ambiente da função; nunca vai para o app nem para os logs.
// - CORS só para as origens da versão Web listadas em ALLOWED_ORIGINS (padrão: servidor local).

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import { bearerToken, corsHeadersFor, decideDeletion, latestAuthenticationAt, projectSecretKey } from './policy.ts';

Deno.serve(async (request) => {
  const cors = corsHeadersFor(request.headers.get('Origin'), Deno.env.get('ALLOWED_ORIGINS'));
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const url = Deno.env.get('SUPABASE_URL');
  const secretKey = projectSecretKey(Deno.env.get('SUPABASE_SECRET_KEYS'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  if (!url || !secretKey) {
    console.error('delete-account: ambiente sem URL ou chave secreta do projeto');
    return reply(500, { error: 'unavailable' });
  }

  const token = bearerToken(request.headers.get('Authorization'));
  if (!token) return reply(401, { error: 'not_authenticated' });

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: verified, error: claimsError } = await admin.auth.getClaims(token);
  if (claimsError || !verified) return reply(401, { error: 'not_authenticated' });
  const claims = verified.claims;

  let authenticatedAt = latestAuthenticationAt(claims);
  if (authenticatedAt === null && typeof claims.sub === 'string') {
    // Token sem horário de autenticação: usa o último login registrado no Auth.
    const { data: found } = await admin.auth.admin.getUserById(claims.sub);
    const lastSignIn = found?.user?.last_sign_in_at ? Date.parse(found.user.last_sign_in_at) : Number.NaN;
    authenticatedAt = Number.isFinite(lastSignIn) ? Math.floor(lastSignIn / 1000) : null;
  }

  const decision = decideDeletion(claims, authenticatedAt, Math.floor(Date.now() / 1000));
  if (!decision.allowed) return reply(decision.status, { error: decision.error });
  // O método é conferido depois da autenticação: só um POST de quem acabou de confirmar exclui.
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const { error: deleteError } = await admin.auth.admin.deleteUser(decision.userId);
  if (deleteError) {
    if (deleteError.status === 404) return reply(401, { error: 'not_authenticated' });
    // Só o status vai para o log: nada de token, e-mail ou identificador da pessoa.
    console.error('delete-account: falha ao excluir usuário', deleteError.status ?? 'sem status');
    return reply(500, { error: 'delete_failed' });
  }

  console.log('delete-account: conta excluída');
  return reply(200, { deleted: true });
});
