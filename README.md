# NutriFlow

Plataforma web de acompanhamento nutricional que conecta pacientes,
nutricionistas e administradores. O projeto reúne uma interface web, uma API
HTTP e um banco de dados para centralizar o acompanhamento e a comunicação
entre os perfis.

## Funcionalidades

- **Pacientes:** painel de acompanhamento, registro de refeições e água,
  histórico de peso, medidas corporais e acesso ao plano alimentar.
- **Nutricionistas:** acompanhamento de pacientes, consulta a registros e
  medidas, criação de planos alimentares com alimentos e dados nutricionais.
- **Comunicação:** chat entre paciente e nutricionista, com suporte a mensagens
  de texto e de voz.
- **Administradores:** painel para consultar e administrar usuários.
- **Contas e perfis:** cadastro e autenticação integrados ao Supabase Auth,
  com permissões definidas pelo perfil do usuário.

## Tecnologias

- Node.js 20 ou superior e npm
- JavaScript, Express 5 e API REST
- Prisma ORM
- SQLite para desenvolvimento local e PostgreSQL para produção
- Supabase Auth; armazenamento local de fotos em desenvolvimento e Supabase
  Storage como opção para produção
- Frontend em HTML, CSS e JavaScript

## Requisitos

- [Node.js 20 ou superior](https://nodejs.org/) (o npm é instalado junto).
- Acesso à internet para instalar as dependências.

Para executar a aplicação localmente com SQLite, não é necessário configurar
um serviço externo. Para testar cadastro, login e outros recursos de
autenticação, configure também um projeto Supabase (veja
[Configuração do Supabase](#configuração-do-supabase)).

## Como executar localmente

Na raiz do repositório, rode:

```bash
npm install
npm run prisma:generate
npm run db:push
npm run dev
```

O comando `db:push` prepara o schema SQLite e cria o arquivo local do banco em
`prisma/dev.db` (se ainda não existir). O servidor de desenvolvimento inicia
em `http://127.0.0.1:3000`.

- Aplicação: <http://127.0.0.1:3000/>
- Verificação da API e da conexão com o banco: <http://127.0.0.1:3000/health>
- Página do paciente: <http://127.0.0.1:3000/dashboard>
- Página do nutricionista: <http://127.0.0.1:3000/dashboard-nutricionista>
- Página do administrador: <http://127.0.0.1:3000/dashboard-admin>

O endpoint `/health` deve responder com `status: "OK"` e
`database: "connected"` quando o servidor e o banco estiverem disponíveis.

Para iniciar sem o modo de observação de arquivos, use `npm start`. Por padrão,
o servidor usa o host `127.0.0.1` e a porta `3000`; personalize-os com as
variáveis `HOST` e `PORT`.

## Configuração do Supabase

Sem configuração do Supabase, é possível iniciar a aplicação com SQLite, mas
os fluxos de autenticação que dependem de um projeto Supabase não estarão
disponíveis. Para habilitá-los:

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Crie um arquivo `.env` na raiz do repositório.
3. Defina nele a URL do projeto e a chave pública `anon`/publishable:

   ```dotenv
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua-chave-publica
   ```

4. Configure confirmação de e-mail e URLs de redirecionamento no Supabase Auth
   conforme o guia de implantação.
5. Reinicie o servidor após alterar as variáveis.

Não compartilhe nem versione chaves secretas. A `SUPABASE_ANON_KEY` é a chave
pública do cliente; `SUPABASE_SECRET_KEY` deve permanecer exclusivamente no
backend e só é necessária para configurar o armazenamento de fotos no
Supabase.

## Variáveis de ambiente

Todas as variáveis são opcionais para iniciar o modo local com os padrões
abaixo. Configure-as no `.env` para substituir esses valores.

| Variável | Padrão / finalidade |
| --- | --- |
| `NODE_ENV` | `development` localmente. |
| `PORT` | `3000`. |
| `HOST` | `127.0.0.1`. |
| `DATABASE_URL` | `file:./dev.db` (SQLite local); em produção, URL PostgreSQL. |
| `APP_BASE_URL` | `http://127.0.0.1:3000`; origem pública usada pela aplicação. |
| `SUPABASE_URL` | URL HTTPS do projeto; necessária para autenticação Supabase. |
| `SUPABASE_ANON_KEY` | Chave pública do projeto; necessária para autenticação Supabase. |
| `PHOTO_STORAGE_PROVIDER` | `local` em desenvolvimento; aceita `local`, `disabled` ou `supabase`. |
| `SUPABASE_SECRET_KEY` | Chave secreta do backend, necessária para `PHOTO_STORAGE_PROVIDER=supabase`. |
| `UPLOADS_DIR` | Pasta local de fotos; por padrão, `uploads/`. |
| `CORS_ALLOWED_ORIGINS` | Origens adicionais permitidas, separadas por vírgulas. |

O arquivo `.env` e os bancos SQLite locais são ignorados pelo Git.

## Comandos úteis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor com reinicialização automática durante o desenvolvimento. |
| `npm start` | Inicia o servidor sem modo de observação. |
| `npm test` | Gera os clientes Prisma e executa a suíte de testes. |
| `npm run prisma:generate` | Gera os clientes Prisma para SQLite e PostgreSQL. |
| `npm run db:push` | Sincroniza o schema Prisma SQLite com o banco local. |
| `npm run db:seed` | Associa um perfil de administrador a uma identidade Supabase já criada. |

O seed de administrador requer `ADMIN_EMAIL` e `ADMIN_USER_ID` (UUID da conta
confirmada no Supabase Auth); `ADMIN_NAME` é opcional. Ele não cria uma conta
ou senha no Supabase.

## Estrutura do projeto

```text
.
├── api/                  # Entrada da função serverless da Vercel
├── docs/                 # Guias de permissões e implantação
├── frontend/             # Páginas, estilos e scripts da aplicação
├── prisma/               # Schemas, migrations e seed do banco
├── public/               # Recursos estáticos públicos
├── scripts/              # Testes e tarefas de banco/migração
├── src/
│   ├── controllers/      # Tratamento das requisições HTTP
│   ├── infra/           # Banco de dados, autenticação e fotos
│   ├── middlewares/     # Autenticação, erros e utilitários HTTP
│   ├── repositories/    # Acesso a dados
│   ├── routes/          # Rotas da API
│   └── services/        # Regras de negócio
└── tests/                # Testes automatizados
```

A aplicação local é iniciada por `index.js`. O `src/app.js` configura a API
Express e serve também os arquivos do frontend; a lógica de negócio é separada
em controllers, services e repositories. O schema SQLite de desenvolvimento
fica em `prisma/schema.sqlite.prisma`, e o schema de PostgreSQL usado em
produção fica em `prisma/schema.prisma`.

## Documentação adicional

- [Permissões por perfil](docs/PERMISSIONS.md)
- [Preparação para implantação na Vercel, Supabase e PostgreSQL](docs/VERCEL_DEPLOY.md)
