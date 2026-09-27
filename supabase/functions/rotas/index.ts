// Edge Function rotas: rota que segue ruas e ciclovias, e voltas geradas a partir de um ponto,
// calculadas pelo OpenRouteService (HeiGIT).
//
// Segurança e privacidade:
// - A plataforma valida o JWT (verify_jwt ligado); a cota é conferida no banco com o token da
//   própria pessoa (claim_route_request), então só quem tem perfil usa e ninguém passa do limite.
// - A chave do OpenRouteService existe só no ambiente da função (ORS_API_KEY); nunca vai ao app.
// - O OpenRouteService recebe só as coordenadas, a partir deste servidor: sem conta, nome ou IP.
// - Nada é guardado aqui, e os logs nunca levam coordenadas, token ou identificador.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0';

import {
  MAX_BODY_BYTES,
  ORS_CREDIT,
  ORS_URL,
  bearerToken,
  corsHeadersFor,
  orsCalls,
  orsFailure,
  parseOrsRoute,
  parseRouteRequest,
  projectPublishableKey,
  type RouteResult,
} from './policy.ts';

const ORS_TIMEOUT_MS = 15_000;

Deno.serve(async (request) => {
  const cors = corsHeadersFor(request.headers.get('Origin'), Deno.env.get('ALLOWED_ORIGINS'));
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = projectPublishableKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'), Deno.env.get('SUPABASE_ANON_KEY'));
  const orsKey = Deno.env.get('ORS_API_KEY');
  if (!url || !publishableKey || !orsKey) {
    console.error('rotas: ambiente sem URL, chave publicável ou chave do roteador');
    return reply(503, { error: 'unavailable' });
  }

  const token = bearerToken(request.headers.get('Authorization'));
  if (!token) return reply(401, { error: 'not_authenticated' });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return reply(413, { error: 'invalid_request' });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reply(400, { error: 'invalid_request' });
  }
  const parsed = parseRouteRequest(body);
  if (!parsed) return reply(400, { error: 'invalid_request' });

  // A cota é da pessoa: a RPC roda com o token dela, confere o limite e registra o pedido.
  const supabase = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: quotaError } = await supabase.rpc('claim_route_request');
  if (quotaError) {
    if (quotaError.code === 'PT429' || quotaError.message.includes('rate_limited')) return reply(429, { error: 'rate_limited' });
    if (quotaError.code === '42501' || quotaError.message.includes('not_authenticated')) return reply(401, { error: 'not_authenticated' });
    console.error('rotas: falha ao conferir a cota', quotaError.code ?? 'sem código');
    return reply(500, { error: 'unavailable' });
  }

  const routes: RouteResult[] = [];
  let failure: 'no_route' | 'unavailable' = 'no_route';
  for (const call of orsCalls(parsed)) {
    let response: Response;
    try {
      response = await fetch(`${ORS_URL}/${call.profile}/geojson`, {
        method: 'POST',
        headers: { Authorization: orsKey, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
        body: JSON.stringify(call.body),
        signal: AbortSignal.timeout(ORS_TIMEOUT_MS),
      });
    } catch {
      console.error('rotas: roteador não respondeu');
      failure = 'unavailable';
      break;
    }
    if (!response.ok) {
      // Só o status vai para o log: o corpo do erro pode repetir as coordenadas.
      console.error('rotas: roteador recusou', response.status);
      await response.body?.cancel();
      failure = orsFailure(response.status);
      if (failure === 'unavailable') break;
      continue;
    }
    const route = parseOrsRoute(await response.json().catch(() => null));
    if (route) routes.push(route);
  }

  if (routes.length === 0) return reply(failure === 'unavailable' ? 503 : 422, { error: failure });
  return reply(200, { rotas: routes, credito: ORS_CREDIT });
});
