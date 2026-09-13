# EuroTreino

Aplicativo de treino gamificado com ranking privado entre amigos. Cada treino registrado vira **Glória**, você sobe de rank do Recruta ao Olimpiano, e a disputa semanal acontece só dentro da sua **Legião** — nunca com desconhecidos.

> Em desenvolvimento. As telas usam dados de exemplo até a integração com o Supabase.

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
```

## Como rodar

Pré-requisitos: Node.js 20 ou superior e o app **Expo Go** no celular (Android ou iPhone).

```bash
npm install
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
