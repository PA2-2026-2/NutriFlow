# NutriFlow — Backend

Backend da plataforma NutriFlow: acompanhamento nutricional para pacientes, nutricionistas e administradores.

## Requisitos

* Node.js 20 ou superior
* npm

## Como rodar

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:push
npm run dev
```

Depois acesse:

```
http://127.0.0.1:3000
```

Você deve ver `{"status":"ok","service":"nutriflow-backend"}`.

## Configuração

As variáveis de ambiente ficam no arquivo `.env` (copie de `.env.example`):

| Variável | Descrição | Padrão |
|---|---|---|
| `NODE_ENV` | Ambiente de execução | `development` |
| `HOST` | Host do servidor | `127.0.0.1` |
| `PORT` | Porta do servidor | `3000` |
| `DATABASE_URL` | Caminho do banco SQLite (relativo à pasta `prisma/`) | `file:./dev.db` |
| `TOKEN_SECRET` | Chave usada para assinar os tokens JWT — **troque em produção** | — |

## Estrutura de pastas

```
src/
├── app.js              # Configuração do Express (middlewares e rotas globais)
├── server.js            # Ponto de entrada — sobe o servidor HTTP
├── config/
│   └── env.js           # Carrega e valida as variáveis de ambiente
├── routes/               # Definição das rotas HTTP, uma por módulo (auth, patients, ...)
│   └── index.js          # Agregador de todas as rotas
├── controllers/          # Recebem a requisição, chamam os services e devolvem a resposta
├── services/             # Regras de negócio e acesso ao banco (via Prisma)
├── middlewares/          # Autenticação, autorização, validação, tratamento de erros
└── models/               # Tipos, DTOs e helpers relacionados às entidades do domínio
```

Cada módulo (autenticação, pacientes, nutricionistas, admin...) segue o fluxo:
`routes → controllers → services → (Prisma) banco de dados`.

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o servidor em modo produção |
| `npm run dev` | Sobe o servidor com reload automático (`node --watch`) |
| `npm run prisma:generate` | Gera o client do Prisma a partir do schema |
| `npm run db:push` | Sincroniza o schema do Prisma com o banco de dados |
| `npm test` | Roda a suíte de testes (configuração completa em issue própria) |

## Status do projeto

Backend em construção, organizado por sprints. Este README será atualizado conforme cada módulo for implementado.
