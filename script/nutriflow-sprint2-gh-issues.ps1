# ============================================================
# NutriFlow — Sprint 2 (Perfis e Administração) — GitHub CLI
# ============================================================
# Uso: Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#      .\nutriflow-sprint2-gh-issues.ps1
# ============================================================

$Repo = "PA2-2026-2/NutriFlow"

Write-Host "Criando labels..."
$labels = @(
    @{ Name = "api";          Color = "1D76DB"; Desc = "Endpoints e regras de negócio" },
    @{ Name = "auth";         Color = "D93F0B"; Desc = "Autenticação e autorização" },
    @{ Name = "admin";        Color = "B60205"; Desc = "Módulo do administrador" },
    @{ Name = "patient";      Color = "FBCA04"; Desc = "Módulo do paciente" },
    @{ Name = "nutritionist"; Color = "0052CC"; Desc = "Módulo do nutricionista" },
    @{ Name = "testing";      Color = "C2E0C6"; Desc = "Testes automatizados" },
    @{ Name = "docs";         Color = "BFD4F2"; Desc = "Documentação" },
    @{ Name = "sprint-2";     Color = "EEEEEE"; Desc = "Sprint 2 - Perfis e Administração" }
)
foreach ($l in $labels) { gh label create $l.Name --repo $Repo --color $l.Color --description $l.Desc 2>$null }

function New-NutriflowIssue {
    param([string]$Title, [string]$Labels, [string]$Body)
    gh issue create --repo $Repo --title $Title --label $Labels --body $Body
}

Write-Host "Criando issues da Sprint 2..."

New-NutriflowIssue -Title "Endpoint CRUD de usuarios pelo admin (/admin/users) - RF05" -Labels "api,admin,sprint-2" -Body @"
Admin gerencia o cadastro de profissionais e pacientes: listar, editar, bloquear/desbloquear ou excluir usuarios.

Criterios de aceite:
- [ ] GET lista usuarios com filtro por role
- [ ] PUT edita dados de um usuario
- [ ] PATCH bloqueia/desbloqueia usuario
- [ ] Apenas admin acessa essas rotas
"@

New-NutriflowIssue -Title "Endpoint de edicao de perfil (GET/PUT /users/me) - RF09" -Labels "api,sprint-2" -Body @"
Usuario (nutricionista ou paciente) atualiza seus proprios dados basicos: nome, telefone, foto de perfil.

Criterios de aceite:
- [ ] GET retorna dados do usuario autenticado
- [ ] PUT permite atualizar nome, telefone e outros campos permitidos
"@

New-NutriflowIssue -Title "Upload de foto de perfil (POST /users/me/photo)" -Labels "api,sprint-2" -Body @"
Endpoint para upload e atualizacao da foto de perfil do usuario, referenciado na edicao de perfil (RF09).

Criterios de aceite:
- [ ] Aceita apenas formatos de imagem validos (jpg, png)
- [ ] Limite de tamanho de arquivo definido
- [ ] URL da foto salva vinculada ao usuario
"@

New-NutriflowIssue -Title "Controle de permissoes por perfil (3 niveis)" -Labels "auth,sprint-2" -Body @"
Refinar o middleware de autorizacao para garantir que cada um dos 3 perfis (Admin, Nutricionista, Paciente) so acesse os recursos previstos no escopo.

Criterios de aceite:
- [ ] Matriz de permissoes documentada por rota
- [ ] Testes cobrindo acesso negado entre perfis
"@

New-NutriflowIssue -Title "Cadastro e vinculo paciente - nutricionista" -Labels "api,patient,nutritionist,sprint-2" -Body @"
Endpoint para vincular um paciente a um nutricionista responsavel (cadastro de pacientes previsto no escopo).

Criterios de aceite:
- [ ] Paciente vinculado a apenas um nutricionista por vez
- [ ] Endpoint retorna erro se o nutricionista nao existir
"@

New-NutriflowIssue -Title "Listagem de pacientes vinculados (GET /nutritionists/patients)" -Labels "api,nutritionist,sprint-2" -Body "Nutricionista visualiza a lista de pacientes vinculados a ele."

New-NutriflowIssue -Title "Testes automatizados - modulo Perfis e Admin" -Labels "testing,sprint-2" -Body "Cobrir os endpoints de CRUD de usuarios, edicao de perfil e vinculo paciente-nutricionista."

New-NutriflowIssue -Title "Documentacao da API - Sprint 2" -Labels "docs,sprint-2" -Body "Documentar os endpoints criados na Sprint 2."

Write-Host "Concluido! Issues da Sprint 2 enviadas para $Repo."
