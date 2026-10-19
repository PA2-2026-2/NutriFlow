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
| `TOKEN_SECRET` | Segredo aleatório com pelo menos 32 caracteres | Pode omitir para usar o segredo local padrão |
| `CORS_ALLOWED_ORIGINS` | Opcional; lista separada por vírgula de origens HTTPS para clientes em outros domínios | Opcional |
| `PHOTO_STORAGE_PROVIDER` | `disabled` até configurar armazenamento persistente | `local` (padrão) |

O CORS não é necessário para o frontend hospedado na mesma origem. Se outro
domínio precisar acessar a API, inclua somente a origem HTTPS exata em
`CORS_ALLOWED_ORIGINS`. Origens não autorizadas recebem HTTP 403. Em produção,
a aplicação falha na inicialização se `DATABASE_URL` não for PostgreSQL ou
`TOKEN_SECRET` estiver ausente/curto.

## PostgreSQL e schema

1. Crie um PostgreSQL gerenciado e um usuário com permissões limitadas ao
   banco da aplicação. Configure a URL como `DATABASE_URL` na Vercel, sem
   publicar o valor.
2. Revise `prisma/migrations/` e aplique o schema **somente** após confirmar
   o banco de destino:

   ```bash
   npm run prisma:generate
   npm run db:migrate:deploy
   ```

   `db:migrate:deploy` cria/atualiza o schema a partir das migrações; não
   transfere registros do SQLite. Não use `db push` no banco de produção.
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

Uploads locais e `uploads/` são adequados somente a desenvolvimento/testes;
o disco da função Vercel não é persistente. Em produção, o padrão
`PHOTO_STORAGE_PROVIDER=disabled` impede gravações efêmeras, responde HTTP
503 a novos envios e não serve o diretório local. URLs salvas não são
reescritas nem removidas. Escolha e configure um serviço compatível com
armazenamento de objetos antes de habilitar fotos em produção, incluindo
migração dos arquivos existentes e atualização coordenada das URLs; essa
integração depende da escolha do provedor/credenciais e ainda não está
implementada.

## Deploy e verificação

Após configurar as variáveis, revisar/aplicar a migração de schema e decidir
como tratar as fotos:

1. Conecte o repositório à Vercel e faça o deploy pela integração Vercel ou
   pela CLI autenticada. Este repositório não executa deploy automaticamente.
2. Verifique `GET https://<dominio>/health`. HTTP 200 com
   `{"status":"OK","database":"connected",...}` confirma API e consulta ao
   banco; HTTP 503 indica banco indisponível.
3. Verifique uma página frontend, os aliases existentes e um fluxo de API
   autenticado. Não considere o deploy ou a migração concluídos sem executar
   essas verificações no ambiente remoto.
