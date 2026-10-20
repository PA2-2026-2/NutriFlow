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
| `POST /api/users/me/photo` | ✅ | ✅ | ✅ | Envia a própria foto (JPEG/PNG/WebP, até 5 MB) |
| `POST /api/patients/me/nutritionist` | ✅ | ❌ | ❌ | Vincula o paciente logado a um nutricionista pelo e-mail dele |
| `POST /api/patients/:id/measurements` | ❌ | ✅ | ❌ | Registra medidas de paciente vinculado ao nutricionista autenticado |
| `PUT /api/patients/:id/measurements/:measurementId` | ❌ | ✅ | ❌ | Substitui os dados da medida de paciente vinculado; peso e altura são obrigatórios |
| `PATCH /api/patients/:id/measurements/:measurementId` | ❌ | ✅ | ❌ | Atualiza parcialmente a medida; campos opcionais podem ser limpos com `null` |
| `DELETE /api/patients/:id/measurements/:measurementId` | ❌ | ✅ | ❌ | Remove a medida do histórico de evolução do paciente vinculado |
| `GET /api/patients/:id/measurements` | ✅ | ✅ | ❌ | Lista medidas em ordem cronológica; paciente consulta apenas as próprias e nutricionista apenas pacientes vinculados |
| `GET /api/patient/dashboard` | ✅ | ❌ | ❌ | Carrega dados, plano alimentar e históricos do paciente |
| `GET /api/patient/chat` | ✅ | ❌ | ❌ | Alias compatível para carregar a conversa do paciente vinculado |
| `POST /api/patient/meals` | ✅ | ❌ | ❌ | Registra uma refeição do paciente |
| `POST /api/patient/messages` | ✅ | ❌ | ❌ | Alias compatível para enviar mensagem ao nutricionista vinculado |
| `POST /api/patient/weights` | ✅ | ❌ | ❌ | Registra uma pesagem semanal do paciente |
| `GET /api/nutritionist/patients` | ❌ | ✅ | ❌ | Lista pacientes vinculados ao nutricionista autenticado |
| `POST /api/nutritionist/link-patient` | ❌ | ✅ | ❌ | Vincula um paciente pelo e-mail dele |
| `GET /api/nutritionist/foods` | ❌ | ✅ | ❌ | Lista a base de alimentos para montar planos |
| `GET /api/nutritionist/meal-plans` | ❌ | ✅ | ❌ | Lista os planos alimentares do nutricionista |
| `POST /api/nutritionist/meal-plans` | ❌ | ✅ | ❌ | Cria um plano alimentar para paciente vinculado |
| `GET /chat/messages` | ✅ | ✅ | ❌ | Carrega mensagens entre participantes com vínculo ativo e marca recebidas como lidas |
| `GET /api/chat/messages` | ✅ | ✅ | ❌ | Alias da consulta de conversa |
| `GET /chat/messages/:messageId/audio` | ✅ | ✅ | ❌ | Recupera áudio apenas para participantes com vínculo ativo |
| `GET /api/chat/messages/:messageId/audio` | ✅ | ✅ | ❌ | Alias da recuperação privada do áudio |
| `POST /chat/messages` | ✅ | ✅ | ❌ | Envia mensagem de texto ou voz para participante com vínculo ativo |
| `POST /api/chat/messages` | ✅ | ✅ | ❌ | Alias da rota de envio de mensagens |
| `GET /chat/conversations` | ✅ | ✅ | ❌ | Lista conversas dos vínculos ativos, última mensagem e quantidade de não lidas |
| `GET /api/chat/conversations` | ✅ | ✅ | ❌ | Alias da listagem de conversas |
| `GET /chat/conversations/:conversationId/messages` | ✅ | ✅ | ❌ | Histórico cronológico paginado; somente participantes vinculados |
| `GET /api/chat/conversations/:conversationId/messages` | ✅ | ✅ | ❌ | Alias do histórico paginado |
| `GET /api/admin/users` | ❌ | ❌ | ✅ | Lista usuários (`?role=` e `?search=`) |
| `GET /api/admin/summary` | ❌ | ❌ | ✅ | Exibe o resumo administrativo |
| `GET /api/admin/foods` | ❌ | ❌ | ✅ | Lista o catálogo global de alimentos |
| `POST /api/admin/foods` | ❌ | ❌ | ✅ | Cadastra alimento disponível para planos e registros alimentares |
| `DELETE /api/admin/foods/:foodId` | ❌ | ❌ | ✅ | Remove alimento do catálogo e atualiza ou remove planos que o utilizavam |
| `PUT /api/admin/users/:userId` | ❌ | ❌ | ✅ | Edita nome, e-mail e telefone de um usuário |
| `PATCH /api/admin/users/:userId/status` | ❌ | ❌ | ✅ | Bloqueia/desbloqueia (`{ "isActive": boolean }`) |
| `DELETE /api/admin/users/:userId` | ❌ | ❌ | ✅ | Remove um usuário |

Regras adicionais do admin: não pode bloquear nem remover a própria conta.

Regra adicional do vínculo paciente-nutricionista: o paciente só pode ter um
nutricionista responsável por vez — vincular de novo substitui o anterior. O
endpoint retorna `404` se o e-mail informado não pertencer a um nutricionista
cadastrado, e `403` se o nutricionista estiver inativo.

O envio de mensagens de texto aceita `recipientId` e `content`; o envio de áudio
aceita `recipientId`, `audioBase64`, `audioMimeType` e `audioDurationSeconds`. O
remetente é sempre o usuário autenticado. Áudios são limitados a 512 KB e 120
segundos. A conversa só pode ser iniciada entre paciente e nutricionista
atualmente vinculados, e a mensagem começa com status `UNREAD`. O conteúdo de
áudio só é retornado por uma rota autenticada após validar que quem solicita é
participante do vínculo ativo. Ao consultar a conversa, somente seus
participantes têm acesso e as mensagens recebidas com status `UNREAD` passam
para `READ`, com `readAt` definido pelo servidor.

O endpoint de medidas recebe o ID do usuário do paciente. `weightKg` e
`heightCm` são obrigatórios; circunferências (`*CircumferenceCm`) e dobras
cutâneas (`*SkinfoldMm`) são opcionais. Os limites aceitos são peso de 1–500 kg,
altura de 30–300 cm, circunferências de pescoço/braço/panturrilha de 5–100 cm,
tórax/cintura/quadril de 20–250 cm, coxa de 10–150 cm e dobras cutâneas de
1–100 mm. `recordedAt` é definido automaticamente e não pode ser enviado no
corpo da requisição.

Para substituir um registro, `PUT /api/patients/:id/measurements/:measurementId`
exige peso e altura; campos de medida opcionais omitidos são limpos. Para alterar
somente alguns campos, use `PATCH`; campos opcionais e observações podem receber
`null` para serem limpos. A exclusão usa `DELETE` no mesmo caminho e remove
permanentemente o registro do histórico. As operações são restritas ao
nutricionista atualmente vinculado ao paciente.

Planos alimentares só podem ser criados para pacientes vinculados ao nutricionista
autenticado. Os itens referenciam alimentos da base; calorias, proteínas,
carboidratos e gorduras são calculados no servidor com os valores por 100 g do
catálogo inicial, e o plano fica ativo por 30 dias.

O catálogo de alimentos é compartilhado entre os painéis: alimentos cadastrados
O catálogo de alimentos é compartilhado entre os painéis: alimentos cadastrados
pelo administrador ficam disponíveis para nutricionistas criarem planos e para o
paciente visualizar o catálogo e o plano associado. Ao remover um alimento, ele
deixa de aparecer no catálogo; seus itens são retirados dos planos e os valores
nutricionais são recalculados. Planos sem itens restantes também são removidos.
O cadastro recebe calorias,
proteínas, carboidratos e gorduras por 100 g; o nome deve ser único, calorias
devem ser não negativas (sem limite superior) e cada macronutriente fica entre
0 e 100 g.

## Ao criar uma rota nova

1. Declare-a em `PUBLIC_ROUTES` ou `PROTECTED_ROUTES` (`src/constants/permissions.js`).
2. Use `authorize('<MÉTODO> <caminho>')` na rota (as rotas protegidas também precisam de `authenticate`).
3. Adicione a linha nesta tabela.