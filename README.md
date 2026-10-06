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