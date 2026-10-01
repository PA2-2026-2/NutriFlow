# NutriFlow

Plataforma de acompanhamento nutricional para pacientes, nutricionistas e administradores. O repositório contém a aplicação web, uma API Express e persistência SQLite com Prisma.

## Requisitos

- Node.js 20 ou superior
- npm

## Início rápido

```bash
npm install
npm run prisma:generate
npm run db:push
npm run dev
```

O servidor inicia por padrão em `http://127.0.0.1:3000`. A raiz exibe a aplicação web; `GET /health` verifica a API e a conexão com o banco. Para executar a suíte de testes, use `npm test`.

## Configuração

As configurações podem ser fornecidas por variáveis de ambiente em um arquivo `.env` na raiz. Todas têm valores padrão para desenvolvimento.

| Variável | Descrição | Padrão |
|---|---|---|
| `NODE_ENV` | Ambiente de execução | `development` |
| `HOST` | Interface de rede do servidor | `127.0.0.1` |
| `PORT` | Porta HTTP | `3000` |
| `DATABASE_URL` | URL de conexão do SQLite (caminho relativo ao schema Prisma) | `file:./dev.db` |
| `TOKEN_SECRET` | Segredo de assinatura dos tokens; defina um valor forte em produção | `nutriflow-dev-secret-change-me` |
| `UPLOADS_DIR` | Diretório para fotos de perfil | `uploads/` na raiz |

As fotos aceitas são JPG e PNG, limitadas a 2 MB, e são servidas sob `/uploads`. O diretório `uploads/`, assim como o banco local e `.env`, não deve ser versionado.

## Estrutura

```text
index.js                 Inicialização HTTP e encerramento gracioso
src/
	app.js                 Configuração do Express, dependências e rotas
	config.js              Configuração por variáveis de ambiente
	constants/             Perfis e matriz de permissões
	controllers/           Adaptadores HTTP
	errors/                Erros da aplicação
	http/                  Parser e respostas HTTP
	infra/                 Prisma e armazenamento de fotos
	middlewares/           Autenticação, autorização e tratamento de erros
	repositories/          Acesso a dados
	routes/                Rotas da API
	services/              Regras de negócio
	utils/                 Validadores e formatadores
frontend/                Aplicação web servida pelo backend
prisma/schema.prisma     Modelos e configuração do banco
prisma/seed.js           Dados iniciais
tests/                   Testes automatizados com Jest e Supertest
docs/                    Documentação, incluindo a matriz de permissões
```

O fluxo da API é `routes → controllers → services → repositories → Prisma`.

## API

Autenticação: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` e `GET /api/auth/me`.

Perfil autenticado: `GET /api/users/me`, `PUT /api/users/me` e `POST /api/users/me/photo`.

Administração (perfil ADMIN): `GET /api/admin/users`, `PUT /api/admin/users/:userId`, `PATCH /api/admin/users/:userId/status` e `DELETE /api/admin/users/:userId`.

Os detalhes dos perfis autorizados por rota estão em [docs/PERMISSIONS.md](docs/PERMISSIONS.md).

## Scripts

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor |
| `npm run dev` | Inicia o servidor com reinicialização ao alterar arquivos |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run db:push` | Sincroniza o schema com o banco configurado |
| `npm test` | Executa os testes com Jest |
