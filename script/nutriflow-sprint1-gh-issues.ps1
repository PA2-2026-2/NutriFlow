# ============================================================
# NutriFlow — Sprint 1 (Fundação e Autenticação) — GitHub CLI
# Realinhado ao documento de requisitos (RF01, RF06, RF07/12, RNF06, RNF07)
# ============================================================
# Pré-requisitos:
#   1. GitHub CLI instalado (winget install --id GitHub.cli) - OK
#   2. Autenticado (gh auth login) - OK
#
# Uso (no PowerShell):
#   cd pasta-onde-salvou-o-arquivo
#   .\nutriflow-sprint1-gh-issues.ps1
#
# Se aparecer erro de permissão de execução, rode antes:
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# ============================================================

$Repo = "PA2-2026-2/NutriFlow"

Write-Host "Criando labels (ignora erro se ja existirem)..."

$labels = @(
    @{ Name = "setup";    Color = "0E8A16"; Desc = "Configuração e infraestrutura do projeto" },
    @{ Name = "auth";     Color = "D93F0B"; Desc = "Autenticação e autorização" },
    @{ Name = "database"; Color = "5319E7"; Desc = "Modelagem e banco de dados" },
    @{ Name = "api";      Color = "1D76DB"; Desc = "Endpoints e regras de negócio" },
    @{ Name = "testing";  Color = "C2E0C6"; Desc = "Testes automatizados" },
    @{ Name = "docs";     Color = "BFD4F2"; Desc = "Documentação" }
)

foreach ($l in $labels) {
    gh label create $l.Name --repo $Repo --color $l.Color --description $l.Desc 2>$null
}

Write-Host "Criando issues da Sprint 1..."

function New-NutriflowIssue {
    param(
        [string]$Title,
        [string]$Labels,
        [string]$Body
    )
    gh issue create --repo $Repo --title $Title --label $Labels --body $Body
}

New-NutriflowIssue -Title "Inicializar projeto Node.js + Express" `
  -Labels "setup" `
  -Body @"
Criar a estrutura base do backend: package.json, Express configurado, estrutura de pastas (src/routes, src/controllers, src/services, src/middlewares, src/models), scripts npm (start, dev), .env.example, .gitignore.

Criterios de aceite:
- [ ] Servidor Express inicia em http://127.0.0.1:3000
- [ ] Estrutura de pastas criada e documentada no README
- [ ] Variaveis de ambiente (NODE_ENV, HOST, PORT, DATABASE_URL, TOKEN_SECRET) carregadas via .env
"@

New-NutriflowIssue -Title "Configurar Prisma + banco de dados" `
  -Labels "setup,database" `
  -Body @"
Instalar e configurar o Prisma ORM apontando para SQLite em desenvolvimento (prisma/dev.db), com scripts prisma:generate e db:push.

Criterios de aceite:
- [ ] npm run prisma:generate e npm run db:push funcionando
- [ ] Conexao com banco validada por um endpoint de healthcheck (GET /health)
"@

New-NutriflowIssue -Title "Modelagem completa do schema do banco de dados" `
  -Labels "database" `
  -Body @"
Desenhar no schema.prisma todas as entidades previstas no documento de requisitos, para servir de base as 6 sprints (RNF08 - integridade referencial):
- User (id, nome, email, senha hash, telefone, foto, role: paciente/nutricionista/admin)
- Patient / Nutritionist (vinculo entre os dois)
- Measurement (peso, altura, circunferencias, dobras cutaneas, data)
- ChatMessage (remetente, destinatario, conteudo, lida/nao lida)
- MealPlan, Meal, NutritionalGoal
- Challenge, ChallengeParticipant
- Consultation

Criterios de aceite:
- [ ] Schema revisado e aprovado pelo time
- [ ] Relacionamentos definidos corretamente (1:N, N:N onde aplicavel)
- [ ] Migracao inicial aplicada sem erros
"@

New-NutriflowIssue -Title "Endpoint de cadastro (POST /auth/register)" `
  -Labels "auth,api" `
  -Body @"
Cadastro e autenticacao de usuarios (paciente, nutricionista ou admin), conforme escopo do documento. RNF06: senha criptografada com Bcrypt antes de ser armazenada.

Criterios de aceite:
- [ ] Validacao de campos obrigatorios e e-mail unico
- [ ] Senha armazenada com hash, nunca em texto puro
- [ ] Retorna erro claro em caso de e-mail duplicado
"@

New-NutriflowIssue -Title "Endpoint de login (POST /auth/login) - RF01" `
  -Labels "auth,api" `
  -Body @"
O sistema deve permitir que os usuarios se autentiquem informando e-mail e senha. O fluxo de navegacao e permissoes devem se adaptar ao perfil logado (Admin, Nutricionista ou Paciente).

Criterios de aceite:
- [ ] Login valido retorna token JWT + dados basicos do usuario (incluindo role)
- [ ] Credenciais invalidas retornam 401 com mensagem generica
"@

New-NutriflowIssue -Title "Endpoint de logout (POST /auth/logout) - RF07/RF12" `
  -Labels "auth,api" `
  -Body @"
O sistema deve permitir que o usuario encerre sua sessao de forma segura, invalidando o token de acesso.

Criterios de aceite:
- [ ] Token invalidado nao pode mais ser usado em rotas protegidas
- [ ] Retorna sucesso mesmo se o token ja estiver expirado
"@

New-NutriflowIssue -Title "Middleware de autenticacao e controle de sessao segura - RNF07" `
  -Labels "auth" `
  -Body @"
Usuarios nao autenticados nao devem ter permissao para acessar rotas internas dos dashboards, mesmo digitando a URL diretamente. Middleware deve validar o token JWT e restringir rotas por papel (role).

Criterios de aceite:
- [ ] Rotas protegidas retornam 401 sem token valido
- [ ] Rotas restritas por papel retornam 403 para papel incorreto
"@

New-NutriflowIssue -Title "Endpoint de Health Check (GET /health) - RF06" `
  -Labels "setup,api" `
  -Body @"
Disponibilizar um endpoint automatizado de verificacao de integridade para testar e garantir que a API, as rotas e a conexao com o banco de dados (Prisma) estao operando corretamente.

Criterios de aceite:
- [ ] Endpoint retorna status 200 e informacoes basicas de saude (API up, conexao com banco ok)
- [ ] Retorna erro claro se a conexao com o banco falhar
"@

New-NutriflowIssue -Title "Setup de testes automatizados (Jest + Supertest)" `
  -Labels "testing" `
  -Body @"
Configurar ambiente de testes e escrever testes para os endpoints de autenticacao e o health check.

Criterios de aceite:
- [ ] npm test roda a suite de testes
- [ ] Cobertura dos endpoints de auth (register, login, logout) e /health
"@

New-NutriflowIssue -Title "Documentacao da API - Sprint 1" `
  -Labels "docs" `
  -Body "Documentar os endpoints criados na Sprint 1 (rota, metodo, parametros, resposta esperada)."

Write-Host "Concluido! 10 issues criadas em $Repo."
Write-Host "Nao esqueca de adicionar cada issue ao seu GitHub Project e move-las para a coluna Backlog."
