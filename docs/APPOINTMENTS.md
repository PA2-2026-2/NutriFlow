# API de agendamento de consultas

Todas as rotas exigem o token Supabase Auth no cabeçalho
`Authorization: Bearer <token>`. O perfil usado para autorização é consultado
no banco pelo middleware atual; IDs de identidade nunca são aceitos como
substitutos do usuário autenticado.

## Status

- `AGENDADA`: status inicial, definido exclusivamente pelo servidor.
- `CONFIRMADA`: confirmada pelo nutricionista.
- `CANCELADA`: cancelada; não bloqueia horários.
- `CONCLUIDA`: consulta concluída; permanece no histórico.

Transições permitidas: `AGENDADA` para `CONFIRMADA` ou `CANCELADA`; e
`CONFIRMADA` para `CANCELADA` ou `CONCLUIDA`. Status cancelados/concluídos são
terminais. Apenas `AGENDADA` e `CONFIRMADA` podem ser remarcadas.

## `POST /api/appointments`

Apenas nutricionistas podem criar consultas, e somente para pacientes com
perfil de paciente vinculados ao nutricionista autenticado.

Campos obrigatórios: `patientId`, `startAt`, `endAt`. Os horários devem ser
strings ISO 8601 com fuso explícito (por exemplo, UTC `Z` ou `-03:00`).
`description` é opcional, com até 1000 caracteres. O início deve ser futuro e
o término posterior ao início. O status é sempre `AGENDADA`; envio de status,
identificadores de nutricionista ou campos desconhecidos é rejeitado.

Requisição:

```http
POST /api/appointments
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "patientId": "id-do-paciente",
  "startAt": "2027-01-15T13:00:00Z",
  "endAt": "2027-01-15T13:50:00Z",
  "description": "Consulta inicial"
}
```

Sucesso (`201 Created`):

```json
{
  "appointment": {
    "id": "id-da-consulta",
    "patientId": "id-do-paciente",
    "nutritionistId": "id-do-nutricionista-autenticado",
    "startAt": "2027-01-15T13:00:00.000Z",
    "endAt": "2027-01-15T13:50:00.000Z",
    "status": "AGENDADA",
    "description": "Consulta inicial",
    "createdAt": "2026-11-01T12:00:00.000Z",
    "updatedAt": "2026-11-01T12:00:00.000Z"
  }
}
```

## `GET /api/appointments`

Pacientes recebem apenas suas próprias consultas; nutricionistas, somente
consultas sob sua responsabilidade. O corpo da resposta é
`{ "appointments": [...] }`, ordenado do horário mais próximo ao mais distante.
Uma lista vazia é retornada quando não há registros. Filtros opcionais:

- `status`: `AGENDADA`, `CONFIRMADA`, `CANCELADA` ou `CONCLUIDA`.
- `from` e `to`: limites ISO 8601 inclusivos aplicados ao início da consulta.

```http
GET /api/appointments?status=AGENDADA&from=2027-01-01T00:00:00Z&to=2027-02-01T00:00:00Z
Authorization: Bearer <token>
```

Sucesso (`200 OK`):

```json
{ "appointments": [] }
```

## `PUT /api/appointments/:id`

Somente o nutricionista responsável pode atualizar a consulta. Apesar do método
`PUT`, o contrato é de atualização parcial: campos omitidos são preservados.
Aceita `status`, `description` e, para remarcar, `startAt` e `endAt` juntos.
O status aceita `CONFIRMADA`, `CANCELADA` ou `CONCLUIDA`; o servidor valida a
transição a partir do status atual. IDs de paciente/nutricionista não podem ser
alterados.

```http
PUT /api/appointments/id-da-consulta
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "status": "CONFIRMADA",
  "startAt": "2027-01-16T13:00:00-03:00",
  "endAt": "2027-01-16T13:50:00-03:00"
}
```

Sucesso (`200 OK`) retorna `{ "appointment": { ... } }` com os dados atualizados.

## Conflitos e erros

Há conflito quando `novoInicio < fimExistente && novoFim > inicioExistente`
para o mesmo paciente ou nutricionista. Intervalos usam a convenção `[início,
fim)`: consultas consecutivas são permitidas. Consultas canceladas não ocupam
horário. O PostgreSQL também aplica restrições de exclusão para impedir
conflitos mesmo em gravações concorrentes.

- `400 Bad Request`: campos ausentes/inválidos, data passada, fim não posterior
  ao início ou transição de status não permitida.
- `401 Unauthorized`: token ausente/inválido.
- `403 Forbidden`: papel sem permissão ou paciente não vinculado.
- `404 Not Found`: paciente ou consulta não encontrado; consulta fora da
  responsabilidade do nutricionista é indistinguível de inexistente.
- `409 Conflict`: sobreposição com consulta ativa.
- `500 Internal Server Error`: falha inesperada, sem detalhes internos.
