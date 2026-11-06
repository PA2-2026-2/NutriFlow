# Metas nutricionais

Nutricionistas podem criar metas para pacientes vinculados, consultar o histórico, editar metas ativas e cancelá-las. Pacientes autenticados consultam somente as próprias metas e podem acrescentar atualizações; os campos da meta são imutáveis para o paciente. O usuário que registrou cada valor vem da sessão validada no backend.

## Categorias, unidade e progresso

As categorias disponíveis são água, proteínas, calorias, frutas e vegetais, peso corporal, frequência de refeições e personalizada. Para a categoria personalizada, o nutricionista informa também o nome da categoria. A unidade é informada individualmente (por exemplo, `L/dia`, `g`, `kg` ou `refeições/semana`), sem conversões ou interpretação automática entre categorias.

O sentido é definido pelos valores inicial e desejado. Para alvos crescentes ou decrescentes, aplica-se:

`percentual = limitar(((valor atual - valor inicial) / (valor desejado - valor inicial)) * 100, 0, 100)`

Valores inicial e desejado iguais são inválidos, evitando divisão por zero. Uma meta só se conclui quando uma atualização alcança ou ultrapassa o alvo no sentido definido. Metas ativas cujo prazo terminou são apresentadas como expiradas; a leitura não altera registros no banco. Cada atualização é uma linha nova no histórico.

## API

- Paciente: `GET /api/patients/goals`, `GET /api/patients/goals/:goalId` e `POST /api/patients/goals/:goalId/progress`.
- Nutricionista: `GET/POST /api/nutritionists/goals`, `GET/PUT /api/nutritionists/goals/:goalId` e `PATCH /api/nutritionists/goals/:goalId/status`.
- A forma singular `/api/nutritionist/goals` é mantida como alias compatível.

Os filtros de listagem do nutricionista aceitam `patientId`, `category` e `status`. A autorização por papel está documentada em [PERMISSIONS.md](./PERMISSIONS.md).
