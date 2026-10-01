# Matriz de permissões por rota

Fonte única no código: [`src/constants/permissions.js`](../src/constants/permissions.js).
As rotas protegidas usam `authorize('<MÉTODO> <caminho>')`; uma rota sem entrada na
matriz faz a aplicação falhar ao subir. O teste `tests/permissions.test.js` confere
esta tabela com o código e exercita **todas** as combinações de perfil × rota.

## Como a autorização funciona

1. `authenticate` valida o token (assinatura, expiração e revogação por logout) e
   confere **no banco** que o usuário existe e está ativo. Resultados:
   - sem token, token inválido/expirado/revogado ou usuário removido → **401**
   - usuário bloqueado → **403**
2. `authorize(...)` compara o perfil **atual do banco** (não o gravado no token)
   com os perfis permitidos para a rota. Perfil não permitido → **403**.

Perfis: `PATIENT` (Paciente), `NUTRITIONIST` (Nutricionista), `ADMIN` (Administrador).

## Rotas públicas (sem token)

| Rota | Observação |
|---|---|
| `GET /health` | Verificação de saúde da API e do banco |
| `POST /api/auth/register` | Cria apenas `PATIENT` ou `NUTRITIONIST`. Tentar criar `ADMIN` retorna 403 |
| `POST /api/auth/login` | Retorna o token |
| `POST /api/auth/logout` | Revoga o token informado; responde 200 mesmo sem token ou com token expirado |

## Rotas protegidas

| Rota | Paciente | Nutricionista | Admin | Descrição |
|---|:-:|:-:|:-:|---|
| `GET /api/auth/me` | ✅ | ✅ | ✅ | Dados do usuário autenticado |
| `GET /api/users/me` | ✅ | ✅ | ✅ | Dados do próprio perfil |
| `PUT /api/users/me` | ✅ | ✅ | ✅ | Atualiza o próprio nome e telefone |
| `POST /api/users/me/photo` | ✅ | ✅ | ✅ | Envia a própria foto (JPG/PNG, até 2 MB) |
| `GET /api/admin/users` | ❌ | ❌ | ✅ | Lista usuários (`?role=` e `?search=`) |
| `PUT /api/admin/users/:userId` | ❌ | ❌ | ✅ | Edita nome, e-mail e telefone de um usuário |
| `PATCH /api/admin/users/:userId/status` | ❌ | ❌ | ✅ | Bloqueia/desbloqueia (`{ "isActive": boolean }`) |
| `DELETE /api/admin/users/:userId` | ❌ | ❌ | ✅ | Remove um usuário |

Regras adicionais do admin: não pode bloquear nem remover a própria conta.

## Ao criar uma rota nova

1. Declare-a em `PUBLIC_ROUTES` ou `PROTECTED_ROUTES` (`src/constants/permissions.js`).
2. Use `authorize('<MÉTODO> <caminho>')` na rota (as rotas protegidas também precisam de `authenticate`).
3. Adicione a linha nesta tabela.
