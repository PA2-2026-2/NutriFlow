# ============================================================
# NutriFlow — Sprint 4 (Comunicação - Chat) — GitHub CLI
# ============================================================
# Uso: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#      .\nutriflow-sprint4-gh-issues.ps1
# ============================================================

$Repo = "PA2-2026-2/NutriFlow"

Write-Host "Criando labels..."
$labels = @(
    @{ Name = "api";          Color = "1D76DB"; Desc = "Endpoints e regras de negócio" },
    @{ Name = "patient";      Color = "FBCA04"; Desc = "Módulo do paciente" },
    @{ Name = "nutritionist"; Color = "0052CC"; Desc = "Módulo do nutricionista" },
    @{ Name = "testing";      Color = "C2E0C6"; Desc = "Testes automatizados" },
    @{ Name = "docs";         Color = "BFD4F2"; Desc = "Documentação" },
    @{ Name = "sprint-4";     Color = "EEEEEE"; Desc = "Sprint 4 - Comunicação (Chat)" }
)
foreach ($l in $labels) { gh label create $l.Name --repo $Repo --color $l.Color --description $l.Desc 2>$null }

function New-NutriflowIssue {
    param([string]$Title, [string]$Labels, [string]$Body)
    gh issue create --repo $Repo --title $Title --label $Labels --body $Body
}

Write-Host "Criando issues da Sprint 4..."

New-NutriflowIssue -Title "Endpoint enviar mensagem (POST /chat/messages) - RF04" -Labels "api,patient,nutritionist,sprint-4" -Body @"
Troca de mensagens de texto entre nutricionista e paciente vinculados.

Criterios de aceite:
- [ ] Mensagem so pode ser enviada entre paciente e nutricionista vinculados
- [ ] Retorna erro se o vinculo nao existir
"@

New-NutriflowIssue -Title "Endpoint listar conversas (GET /chat/conversations)" -Labels "api,sprint-4" -Body "Lista as conversas do usuario autenticado, com a ultima mensagem e contagem de nao lidas."

New-NutriflowIssue -Title "Endpoint historico de mensagens (GET /chat/conversations/:id/messages)" -Labels "api,sprint-4" -Body @"
Historico paginado de mensagens de uma conversa especifica.

Criterios de aceite:
- [ ] Mensagens retornadas em ordem cronologica
- [ ] Suporta paginacao
"@

New-NutriflowIssue -Title "Marcar mensagens como lidas / contagem de nao lidas" -Labels "api,sprint-4" -Body "Endpoint para marcar mensagens como lidas ao abrir a conversa, e contagem de nao lidas usada no dashboard do paciente (RF08)."

New-NutriflowIssue -Title "Testes automatizados - modulo Chat" -Labels "testing,sprint-4" -Body "Cobrir envio de mensagens, listagem de conversas e marcacao de leitura."

New-NutriflowIssue -Title "Documentacao da API - Sprint 4" -Labels "docs,sprint-4" -Body "Documentar os endpoints criados na Sprint 4."

Write-Host "Concluido! Issues da Sprint 4 enviadas para $Repo."
