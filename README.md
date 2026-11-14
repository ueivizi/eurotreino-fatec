# EuroTreino

Aplicativo de treino gamificado com ranking privado entre amigos. Cada treino registrado vira **Glória**,
você sobe de rank do Recruta ao Olimpiano, e a disputa semanal acontece só dentro da sua **Legião**,
nunca com desconhecidos.

Projeto da disciplina de Laboratório de Desenvolvimento Mobile do curso de Tecnologia em Desenvolvimento
de Software Multiplataforma da Fatec Osasco – Prefeito Hirant Sanazar (2026, 6º semestre), sob orientação
do Prof. Elias Carneiro de Oliveira.

## Versão descrita nos documentos

Os documentos de entrega (Objetivos 4 a 6 e P2) descrevem o aplicativo no commit
[`6867897`](https://github.com/ueivizi/eurotreino-fatec/tree/6867897), de 17/09/2026. Os trechos de código citados na seção 5.3 indicam o arquivo
e as linhas desse commit.

Os commits seguintes, até 27/09/2026, implementam o que ficou como trabalho futuro e os ajustes pedidos na
validação com usuários: histórico de treinos (Anais) com edição, meta semanal, campo de código com um
quadrado por dígito, imagem de compartilhamento, Mural da Legião, mapa e rotas, temporadas competitivas,
foto de perfil com consentimento e o treino na tela bloqueada do Android. Nessa fase, a Arena passou a se
chamar Coliseu na interface; o código e o banco continuam usando `arena`.

## Tecnologias

- **Aplicativo:** React Native e Expo SDK 57, em TypeScript estrito, com Expo Router. Um código só para
  Android, iOS e Web.
- **Servidor:** Supabase, com PostgreSQL, Auth, segurança por linha (RLS) e Edge Functions.
- **Testes:** Jest no aplicativo, PGlite (PostgreSQL em WebAssembly) no banco e `node:test` nas funções.
- **Qualidade:** ESLint, GitHub Actions e gitleaks a cada envio.

## Estrutura

```
src/app/              telas (rotas do Expo Router)
src/components/       componentes de interface, tema Ônix & Ouro e Mármore
src/features/         regras de cada área, chamadas ao banco e validação das respostas, com testes
src/lib/              cliente Supabase, sessão segura, cache de consultas e utilitários
src/theme/            cores, tipografia e espaçamento
modules/              módulo nativo do Android (cartão do treino na tela bloqueada)
supabase/migrations/  esquema do banco: tabelas, RLS e funções, em migrações SQL versionadas
supabase/functions/   Edge Functions (exclusão da conta e rotas)
supabase/tests/       testes do banco
```

## Banco de dados

O banco é criado só por migrações em `supabase/migrations`. As regras de negócio (pontuação, convites,
Coliseu) ficam em funções do PostgreSQL; o aplicativo lê pelas políticas de RLS e grava apenas chamando
essas funções.

```bash
npm run test:db          # aplica as migrações num PostgreSQL em memória e roda os testes do banco
npx supabase login       # uma vez por máquina
npx supabase db push     # aplica as migrações no projeto Supabase ligado
```

Nenhum dos comandos precisa de Docker.

## Como rodar

Pré-requisitos: Node.js 22 e um projeto Supabase com as migrações aplicadas.

```bash
npm install
cp .env.example .env     # preencha com a URL e a chave publicável do projeto Supabase
npm start
```

- **Web:** com o servidor rodando, pressione `w` no terminal ou use `npm run web`.
- **Celular:** Health Connect, mapas e o cartão da tela bloqueada usam código nativo e exigem uma
  development build (`eas build --profile development --platform android`); o Expo Go não basta.

## Verificação

```bash
npm run lint
npm run typecheck
npm test
npm run test:functions
npm run test:db
```

A integração contínua (`.github/workflows/ci.yml`) roda esses mesmos comandos e a busca de segredos com o
gitleaks a cada envio ao repositório.
