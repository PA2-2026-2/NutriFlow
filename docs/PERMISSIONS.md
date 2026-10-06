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
| `POST /api/patients/me/nutritionist` | ✅ | ❌ | ❌ | Vincula o paciente logado a um nutricionista pelo e-mail dele |
| `POST /api/patients/:id/measurements` | ❌ | ✅ | ❌ | Registra medidas de paciente vinculado ao nutricionista autenticado |
| `GET /api/nutritionist/patients` | ❌ | ✅ | ❌ | Lista pacientes vinculados ao nutricionista autenticado |
| `POST /api/nutritionist/link-patient` | ❌ | ✅ | ❌ | Vincula um paciente pelo e-mail dele |
| `GET /api/admin/users` | ❌ | ❌ | ✅ | Lista usuários (`?role=` e `?search=`) |
| `GET /api/admin/summary` | ❌ | ❌ | ✅ | Exibe o resumo administrativo |
| `PUT /api/admin/users/:userId` | ❌ | ❌ | ✅ | Edita nome, e-mail e telefone de um usuário |
| `PATCH /api/admin/users/:userId/status` | ❌ | ❌ | ✅ | Bloqueia/desbloqueia (`{ "isActive": boolean }`) |
| `DELETE /api/admin/users/:userId` | ❌ | ❌ | ✅ | Remove um usuário |

Regras adicionais do admin: não pode bloquear nem remover a própria conta.

Regra adicional do vínculo paciente-nutricionista: o paciente só pode ter um
nutricionista responsável por vez — vincular de novo substitui o anterior. O
endpoint retorna `404` se o e-mail informado não pertencer a um nutricionista
cadastrado, e `403` se o nutricionista estiver inativo.

O endpoint de medidas recebe o ID do usuário do paciente. `weightKg` e
`heightCm` são obrigatórios; circunferências (`*CircumferenceCm`) e dobras
cutâneas (`*SkinfoldMm`) são opcionais. Os limites aceitos são peso de 1–500 kg,
altura de 30–300 cm, circunferências de pescoço/braço/panturrilha de 5–100 cm,
tórax/cintura/quadril de 20–250 cm, coxa de 10–150 cm e dobras cutâneas de
1–100 mm. `recordedAt` é definido automaticamente e não pode ser enviado no
corpo da requisição.

## Ao criar uma rota nova

1. Declare-a em `PUBLIC_ROUTES` ou `PROTECTED_ROUTES` (`src/constants/permissions.js`).
2. Use `authorize('<MÉTODO> <caminho>')` na rota (as rotas protegidas também precisam de `authenticate`).
3. Adicione a linha nesta tabela.