# ============================================================
# NutriFlow — Sprint 3 (Avaliação Física) — GitHub CLI
# ============================================================
# Uso: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#      .\nutriflow-sprint3-gh-issues.ps1
# ============================================================

$Repo = "PA2-2026-2/NutriFlow"

Write-Host "Criando labels..."
$labels = @(
    @{ Name = "api";          Color = "1D76DB"; Desc = "Endpoints e regras de negócio" },
    @{ Name = "patient";      Color = "FBCA04"; Desc = "Módulo do paciente" },
    @{ Name = "nutritionist"; Color = "0052CC"; Desc = "Módulo do nutricionista" },
    @{ Name = "testing";      Color = "C2E0C6"; Desc = "Testes automatizados" },
    @{ Name = "docs";         Color = "BFD4F2"; Desc = "Documentação" },
    @{ Name = "sprint-3";     Color = "EEEEEE"; Desc = "Sprint 3 - Avaliação Física" }
)
foreach ($l in $labels) { gh label create $l.Name --repo $Repo --color $l.Color --description $l.Desc 2>$null }

function New-NutriflowIssue {
    param([string]$Title, [string]$Labels, [string]$Body)
    gh issue create --repo $Repo --title $Title --label $Labels --body $Body
}

Write-Host "Criando issues da Sprint 3..."

New-NutriflowIssue -Title "Endpoint registrar medidas corporais (POST /patients/:id/measurements) - RF02" -Labels "api,patient,nutritionist,sprint-3" -Body @"
Nutricionista cadastra dados antropometricos do paciente vinculado: peso, altura, circunferencias e dobras cutaneas.

Criterios de aceite:
- [ ] Apenas o nutricionista vinculado pode registrar
- [ ] Validacao de valores numericos plausiveis
- [ ] Data do registro salva automaticamente
"@

New-NutriflowIssue -Title "Endpoint historico de evolucao (GET /patients/:id/measurements) - RF03" -Labels "api,patient,nutritionist,sprint-3" -Body @"
Listagem cronologica das medidas corporais, disponivel tanto para o nutricionista quanto para o proprio paciente.

Criterios de aceite:
- [ ] Retorna registros ordenados por data
- [ ] Paciente ve apenas seus proprios dados; nutricionista ve dados dos pacientes vinculados
"@

New-NutriflowIssue -Title "Endpoint editar/excluir medida corporal" -Labels "api,nutritionist,sprint-3" -Body @"
Permitir corrigir ou remover um registro de medida corporal lancado incorretamente.

Criterios de aceite:
- [ ] Apenas o nutricionista responsavel pode editar/excluir
- [ ] Exclusao remove o registro do historico de evolucao
"@

New-NutriflowIssue -Title "Testes automatizados - modulo Avaliacao Fisica" -Labels "testing,sprint-3" -Body "Cobrir os endpoints de registro, listagem, edicao e exclusao de medidas corporais."

New-NutriflowIssue -Title "Documentacao da API - Sprint 3" -Labels "docs,sprint-3" -Body "Documentar os endpoints criados na Sprint 3."

Write-Host "Concluido! Issues da Sprint 3 enviadas para $Repo."
