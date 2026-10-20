# Preparação de produção na Vercel

O projeto mantém o Express e o frontend no mesmo deployment. A função em
`api/index.js` exporta `createApp()` sem abrir um listener; as rotas atuais,
aliases de páginas e arquivos de `frontend/` continuam sendo tratados pelo
Express. A configuração Vercel inclui os arquivos estáticos no bundle da
função. `npm start` e `npm run dev` continuam iniciando o servidor local.

## Variáveis de ambiente

Configure os valores no projeto Vercel, para cada ambiente adequado. Não os
adicione ao Git nem compartilhe em logs:

| Variável | Produção | Desenvolvimento |
| --- | --- | --- |
| `NODE_ENV` | Definido pela Vercel como `production` | `development` ou `test` |
| `DATABASE_URL` | URL PostgreSQL com TLS conforme exigido pelo provedor | `file:./dev.db` |
| `SUPABASE_URL` | URL HTTPS do projeto Supabase | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública `anon`/publishable do projeto; pode ser enviada ao navegador | Chave pública `anon`/publishable |
| `APP_BASE_URL` | Origem HTTPS canônica da aplicação | `http://127.0.0.1:3000` (padrão) |
| `CORS_ALLOWED_ORIGINS` | Opcional; lista separada por vírgula de origens HTTPS para clientes em outros domínios | Opcional |
| `PHOTO_STORAGE_PROVIDER` | `supabase` (automático quando as duas variáveis Supabase existem) | `local` (padrão) |
| `SUPABASE_SECRET_KEY` | Chave secreta; somente backend, necessária apenas para armazenamento Supabase de fotos | Opcional |

O CORS não é necessário para o frontend hospedado na mesma origem. Se outro
domínio precisar acessar a API, inclua somente a origem HTTPS exata em
`CORS_ALLOWED_ORIGINS`. Origens não autorizadas recebem HTTP 403. Em produção,
a aplicação falha na inicialização se `DATABASE_URL` não for PostgreSQL ou
`SUPABASE_URL`/`SUPABASE_ANON_KEY` estiverem ausentes. Em solicitações de
recuperação feitas pelo frontend na mesma origem, o redirect enviado ao Supabase
usa a origem HTTPS da própria requisição, evitando retornar a um hostname
temporário de deployment da Vercel. Para chamadas cross-origin ou outros
redirects, `APP_BASE_URL` é a origem canônica; configure-a com o domínio público
da aplicação.
Não configure `SUPABASE_SECRET_KEY` no navegador; a chave administrativa não
é usada nos fluxos de autenticação.

## Supabase Auth: confirmação, sessão e recuperação

1. No painel Supabase, habilite **Authentication → Providers → Email → Confirm
   email**. A aplicação recusa novos cadastros se o Supabase devolver uma
   sessão imediatamente, e o login/backend também exigem `email_confirmed_at`.
2. Em **Authentication → URL Configuration**, configure o `Site URL` para o
   domínio público da aplicação. Inclua estas URLs exatas em
   **Redirect URLs**:
   - `http://127.0.0.1:3000/auth/confirm`
   - `http://127.0.0.1:3000/reset-password`
   - `https://<dominio-producao>/auth/confirm`
   - `https://<dominio-producao>/reset-password`
   Para Preview Deployments da Vercel, inclua também o padrão de domínio
   `.vercel.app` correspondente ao projeto/time no formato aceito pelo painel
   Supabase. Não use curingas amplos fora dos domínios controlados pela equipe.
3. Mantenha os templates nativos de confirmação e recuperação do Supabase
   apontando para `{{ .ConfirmationURL }}`. O SDK usa os callbacks
   `/auth/confirm` e `/reset-password`; o Supabase gera, valida e consome os
   tokens temporários. Não crie tokens próprios nem tabelas de confirmação ou
   recuperação.
4. Configure um provedor SMTP confiável no Supabase para produção. Os limites
   padrão de envio são baixos; monitore o rate limit do Auth e configure
   limites/antispam adequados. A API retorna respostas genéricas para
   solicitação de recuperação e novo e-mail de confirmação para reduzir
   enumeração de contas.
5. `SUPABASE_ANON_KEY` é pública e serve ao cliente navegador; o backend usa a
   mesma chave pública para Auth e valida cada bearer token com
   `auth.getUser()`. Nunca exponha a chave `service_role`/secret key. A chave
   `SUPABASE_SECRET_KEY` já documentada para fotos permanece exclusivamente no
   backend e não é usada para cadastro, login, confirmação ou recuperação.

O Auth é a fonte das credenciais e sessões. Para perfis novos, `User.id` no
Prisma usa o UUID devolvido pelo Supabase Auth; o campo único opcional
`User.authUserId` associa contas antigas sem alterar IDs já referenciados por
pacientes, planos, mensagens ou outros registros. Essa coluna é adicionada por
uma migration aditiva. Nome, papel e permissões continuam no perfil Prisma, e
todas as rotas protegidas carregam o papel atual do banco após validar a sessão
Supabase.

Para associar um perfil antigo por e-mail, a pessoa deve realizar o cadastro
com o mesmo endereço do perfil existente e confirmar a nova identidade
Supabase; o backend mantém o ID, nome, papel, status e relações do perfil e
grava a associação em `authUserId`. Um login Supabase confirmado também pode
associar um perfil legado ainda não vinculado com o mesmo e-mail. Não são
alterados IDs de dados relacionados. O campo legado `passwordHash` permanece
no schema por compatibilidade, é limpo quando uma identidade é associada e
nunca é usado para autenticar. Contas existentes precisam cadastrar/redefinir
sua senha no Supabase; hashes locais não são migrados para Auth.

Para criar o perfil de administrador, crie primeiro no Supabase Auth a
identidade administrativa confirmada e execute `npm run db:seed` com
`ADMIN_EMAIL`, `ADMIN_USER_ID` (UUID exato da identidade) e, opcionalmente,
`ADMIN_NAME`. O seed não cria senha nem identidade Supabase; não permite
cadastro público de administrador.

## PostgreSQL e schema

1. Crie um PostgreSQL gerenciado e um usuário com permissões limitadas ao
   banco da aplicação. Configure a URL como `DATABASE_URL` na Vercel, sem
   publicar o valor.
2. Revise `prisma/migrations/` e aplique o schema **somente** após confirmar
   o banco de destino:

   ```bash
   npm run db:migrate:deploy
   ```

   `db:migrate:deploy` cria/atualiza o schema a partir das migrações; não
   transfere registros do SQLite. Não use `db push` no banco de produção.
   No deployment Vercel, o comando `vercel-build` gera o Prisma Client do
   schema PostgreSQL e executa `prisma migrate deploy` antes de publicar a
   função. Se uma execução concorrente estiver segurando o advisory lock do
   PostgreSQL, o deploy repete a migração até quatro vezes com espera crescente;
   outros erros continuam falhando imediatamente. Configure uma `DATABASE_URL`
   apropriada para cada ambiente Vercel (Production, Preview e Development);
   o build aplica migrations no banco selecionado para aquele ambiente.
3. O schema PostgreSQL é `prisma/schema.prisma`. O schema SQLite separado
   (`prisma/schema.sqlite.prisma`) gera um client local para manter testes e
   desenvolvimento sem alterar a cópia SQLite atual.
4. Em ambiente serverless, use o endpoint/pooler recomendado pelo provedor
   PostgreSQL e configure limites de conexão compatíveis com o número de
   instâncias concorrentes da função.

## Migração dos registros SQLite

Não migre até ter uma cópia de segurança íntegra, interrompido as gravações
na origem e confirmado que o banco de destino recém-criado está vazio. As
fotos em disco exigem uma migração de arquivos separada. O script abaixo não
altera a origem e verifica que todas as tabelas do destino estão vazias. O
modo de simulação não escreve dados:

```bash
$env:SOURCE_DATABASE_URL = "file:./dev.db"
$env:DATABASE_URL = "<URL do PostgreSQL configurada localmente, sem a incluir no Git>"
npm run db:migrate:data
```

Revise as contagens exibidas e autorize explicitamente a escrita apenas após
verificar os destinos e cópias de segurança:

```bash
npm run db:migrate:data -- --execute
```

O script copia IDs, hashes de senha, datas e demais campos de todos os modelos
em ordem de relacionamento, usando uma transação PostgreSQL e validando as
contagens antes do commit. Em falha, a transação é revertida. Ele recusa
destinos com registros e não imprime dados pessoais nem URLs. Faça backup
antes, mantenha a origem intacta e valide a aplicação com as contagens e
fluxos funcionais antes de trocar o tráfego.

## Fotos de perfil

Em produção, configure `SUPABASE_URL` e `SUPABASE_SECRET_KEY` na Vercel para os
ambientes necessários. Com ambas configuradas, o provider `supabase` é
selecionado automaticamente; também pode ser definido explicitamente com
`PHOTO_STORAGE_PROVIDER=supabase`. A aplicação usa o bucket privado
`nutriflow-images` e requer que ele aceite JPEG, PNG e WebP, com limite de
5 MB. A chave secreta só é lida no backend. Não torne o bucket público nem
coloque essa chave no frontend.

O PostgreSQL mantém somente a chave do objeto em `profilePhotoUrl`. Para exibir
as imagens, a API gera URLs assinadas com validade de uma hora. Uploads e
assinaturas são realizados pela função Express e não dependem de disco local,
compatibilizando com a Vercel. O provider `local` continua disponível para
desenvolvimento e testes; não use esse provider em produção.

Esta integração não migra, apaga ou reescreve fotos já existentes. Se o banco
contiver URLs locais antigas, planeje separadamente a cópia desses arquivos
para o bucket e a atualização das referências após backup e validação; nenhum
dado de produção é alterado automaticamente.

## Deploy e verificação

Após configurar as variáveis, revisar/aplicar a migração de schema e decidir
como tratar as fotos:

1. Conecte o repositório à Vercel e faça o deploy pela integração Vercel ou
   pela CLI autenticada. A configuração `buildCommand` executa
   `npm run vercel-build`, que gera o client do schema PostgreSQL e aplica
   migrations pendentes antes da publicação. Este repositório não executa
   deploy automaticamente.
2. Verifique `GET https://<dominio>/health`. HTTP 200 com
   `{"status":"OK","database":"connected",...}` confirma API e consulta ao
   banco; HTTP 503 indica banco indisponível.
3. Verifique uma página frontend, os aliases existentes e um fluxo de API
   autenticado. Não considere o deploy ou a migração concluídos sem executar
   essas verificações no ambiente remoto.
