# EuroTreino

Aplicativo de treino gamificado com ranking privado entre amigos. Cada treino registrado vira **Glória**, você sobe de rank do Recruta ao Olimpiano, e a disputa semanal acontece só dentro da sua **Legião** — nunca com desconhecidos.

> Em desenvolvimento. A entrada por código no e-mail e o perfil já usam o Supabase; Glória, Arena e Legiões ainda mostram dados de exemplo.

## Stack

- **App:** React Native + Expo SDK 57 (TypeScript, Expo Router) — Android, iOS e Web
- **Backend:** Supabase — PostgreSQL, Auth, Row Level Security e Edge Functions

## Estrutura

```
src/app/         rotas (Expo Router): abas Início, Arena, Legião e Perfil + registro de treino
src/components/  componentes de interface (tema Ônix & Ouro, medalhões de rank, barra de abas)
src/features/    regras de domínio com testes (ranks, Arena, tipos de treino)
src/lib/         utilitários (semana da Arena no horário de Brasília, numerais romanos)
src/theme/       tokens de cor, tipografia e espaçamento
src/data/        dados de exemplo usados enquanto o backend não está ligado
supabase/        migrações SQL (tabelas, RLS e funções) e testes do banco
```

## Banco de dados

O banco é criado só por migrações versionadas em `supabase/migrations`. As regras de negócio (pontuação, convites, Arena) ficam em funções do Postgres; o app lê pelo RLS e grava apenas chamando essas funções.

```bash
npm run test:db          # aplica as migrações num Postgres em memória e roda os testes
npx supabase login       # uma vez por máquina
npx supabase db push     # aplica as migrações no projeto Supabase ligado
npm run test:db:linked   # roda os mesmos testes no projeto ligado, desfazendo tudo no fim
```

Nenhum dos comandos precisa de Docker.

## Como rodar

Pré-requisitos: Node.js 20 ou superior e o app **Expo Go** no celular (Android ou iPhone).

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave publicável do projeto Supabase
npm start
```

- **Celular:** abra o Expo Go e escaneie o QR code exibido no terminal (celular e computador na mesma rede).
- **Web:** com o servidor rodando, pressione `w` no terminal ou use `npm run web`.

## Qualidade

```bash
npm run lint
npm run typecheck
npm test
```
