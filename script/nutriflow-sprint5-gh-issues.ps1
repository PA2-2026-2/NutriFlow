# ============================================================
# NutriFlow — Sprint 5 (Planos, Refeições, Metas, Desafios,
#             Dashboards, Agendamentos e Fechamento) — GitHub CLI
# Versão reduzida (9 issues)
# ============================================================
# Uso: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#      .\nutriflow-sprint5-gh-issues.ps1
# ============================================================

$Repo = "PA2-2026-2/NutriFlow"

Write-Host "Criando labels..."
$labels = @(
    @{ Name = "api";          Color = "1D76DB"; Desc = "Endpoints e regras de negócio" },
    @{ Name = "patient";      Color = "FBCA04"; Desc = "Módulo do paciente" },
    @{ Name = "nutritionist"; Color = "0052CC"; Desc = "Módulo do nutricionista" },
    @{ Name = "admin";        Color = "B60205"; Desc = "Módulo do administrador" },
    @{ Name = "testing";      Color = "C2E0C6"; Desc = "Testes automatizados" },
    @{ Name = "docs";         Color = "BFD4F2"; Desc = "Documentação" },
    @{ Name = "sprint-5";     Color = "EEEEEE"; Desc = "Sprint 5 - Nutrição, Desafios, Dashboards e Agendamentos" }
)
foreach ($l in $labels) { gh label create $l.Name --repo $Repo --color $l.Color --description $l.Desc 2>$null }

function New-NutriflowIssue {
    param([string]$Title, [string]$Labels, [string]$Body)
    gh issue create --repo $Repo --title $Title --label $Labels --body $Body
}

Write-Host "Criando issues da Sprint 5..."

New-NutriflowIssue -Title "CRUD de planos alimentares (/nutritionists/plans)" -Labels "api,nutritionist,sprint-5" -Body "Nutricionista cria, edita e remove planos alimentares para os pacientes vinculados."

New-NutriflowIssue -Title "Registro de refeicoes pelo paciente (/patients/meals)" -Labels "api,patient,sprint-5" -Body @"
Paciente registra refeicoes e alimentos consumidos, conforme o plano alimentar.

Criterios de aceite:
- [ ] Paciente cria, lista e remove registros de refeicao
- [ ] Refeicoes vinculadas a data e horario
"@

New-NutriflowIssue -Title "Metas nutricionais (/patients/goals ou /nutritionists/goals)" -Labels "api,nutritionist,patient,sprint-5" -Body "Nutricionista define metas nutricionais para o paciente; paciente visualiza seu progresso em relacao a meta."

New-NutriflowIssue -Title "CRUD de desafios nutricionais (/nutritionists/challenges, /patients/challenges)" -Labels "api,nutritionist,patient,sprint-5" -Body @"
Nutricionista cria desafios (titulo, descricao, periodo); paciente se inscreve em desafios do seu nutricionista; ambos conseguem listar desafios com status de participacao/progresso.

Criterios de aceite:
- [ ] Validacao de data de inicio anterior a data de fim na criacao
- [ ] Paciente so participa de desafios do proprio nutricionista
- [ ] Nao permite inscricao duplicada no mesmo desafio
- [ ] Listagem retorna status de participacao/progresso
"@

New-NutriflowIssue -Title "Dashboard do paciente (GET /patients/dashboard) - RF08" -Labels "api,patient,sprint-5" -Body "Painel consolidando as ultimas medidas corporais e mensagens nao lidas do paciente."

New-NutriflowIssue -Title "Dashboard do nutricionista e do admin - RF10" -Labels "api,nutritionist,admin,sprint-5" -Body "Paineis personalizados com resumo de pacientes, atividades recentes (nutricionista) e metricas gerais da plataforma (admin)."

New-NutriflowIssue -Title "Endpoints de agendamento de consultas - RF11" -Labels "api,nutritionist,patient,sprint-5" -Body @"
Nutricionista registra consultas e acompanhamentos (sem integracao de pagamento ou nota fiscal, conforme delimitacao do escopo); nutricionista e paciente listam suas consultas; nutricionista atualiza status ou remarca.

Criterios de aceite:
- [ ] Criacao com validacao de data/hora (sem conflito de horario) e status inicial 'agendada'
- [ ] GET para nutricionista e paciente listarem suas consultas
- [ ] PUT para o nutricionista atualizar status (confirmada, cancelada, concluida) ou remarcar
"@

New-NutriflowIssue -Title "Otimizacao de performance dos endpoints - RNF01/RNF02" -Labels "api,sprint-5" -Body @"
Revisar queries e respostas para garantir tempo de resposta da API inferior a 1,5s em operacoes de consulta comuns.

Criterios de aceite:
- [ ] Endpoints de consulta (historico de medidas, dashboards) revisados
- [ ] Indices de banco adicionados onde necessario
"@

New-NutriflowIssue -Title "Testes automatizados e documentacao final da Sprint 5" -Labels "testing,docs,sprint-5" -Body @"
Cobrir com testes os modulos de planos alimentares, refeicoes, metas, desafios, dashboards e agendamentos, e consolidar a documentacao de todos os endpoints das 5 sprints em um unico local (README detalhado ou Swagger/OpenAPI).

Criterios de aceite:
- [ ] npm test cobre os principais fluxos da Sprint 5
- [ ] Documentacao final publicada e revisada
"@

Write-Host "Concluido! Issues da Sprint 5 enviadas para $Repo."
