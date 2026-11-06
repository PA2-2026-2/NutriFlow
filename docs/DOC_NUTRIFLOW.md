# Documentação completa do projeto NutriFlow

## 1. Visão geral do projeto

O NutriFlow é uma plataforma web de acompanhamento nutricional desenvolvida para conectar pacientes, nutricionistas e administradores em um único ecossistema digital. O sistema centraliza a gestão de pacientes, planos alimentares, desafios nutricionais, agendamentos de consultas, registro de evolução corporal, controle de refeições e comunicação direta entre o profissional e o paciente.

A proposta do projeto é reduzir a dependência de processos manuais, como planilhas, mensagens dispersas, anexos em canais externos e registros fragmentados, substituindo tudo por uma solução organizada e acessível dentro de uma mesma aplicação. O foco principal é apoiar o acompanhamento clínico e comportamental de forma contínua, com rastreabilidade e segurança.

### Objetivo principal

- Organizar e digitalizar o processo de acompanhamento nutricional.
- Conectar nutricionistas a pacientes em um ambiente com autenticação, permissões e histórico.
- Apoiar a evolução do paciente por meio de métricas, refeições, peso, medidas corporais, planos e desafios.
- Permitir que o nutricionista acompanhe o progresso de forma estruturada e centralizada.

### Problema que resolve

Muitos atendimentos nutricionais ainda dependem de comunicação por WhatsApp, planilhas, tabelas manuais e registros dispersos. Isso gera:

- perda de histórico;
- baixa organização do acompanhamento;
- dificuldades em revisar evolução em cada consulta;
- baixa rastreabilidade de metas e desafios;
- ausência de controle de acesso e privacidade;
- duplicação de informações entre paciente e profissional.

O NutriFlow busca resolver isso com uma solução digital própria, organizada por perfis de usuário e por regras de negócio bem definidas.

### Público-alvo

- Pacientes que desejam acompanhar alimentação, evolução corporal e metas de saúde.
- Nutricionistas que precisam organizar seus atendimentos, pacientes e prescrições.
- Administradores que supervisionam usuários, aprovações, catalogação de alimentos e status de contas.

### Proposta de valor

- centralização da informação;
- melhoria do atendimento e da retenção;
- maior transparência entre paciente e nutricionista;
- automação de processos repetitivos;
- maior controle de acesso e segurança;
- base para crescimento de uma prática de nutrição digital.

### Diferenciais do NutriFlow

- fluxo de aprovação administrativa para nutricionistas;
- autenticação integrada ao Supabase;
- separação de permissões por perfil;
- chat com mensagens de texto e áudio;
- desafios nutricionais com check-ins e progresso;
- cadastro de alimentos, metas e evolução de medidas;
- gestão de consultas e planejamento de atendimento;
- arquitetura organizada por camadas (controllers, services, repositories, routes, middlewares).

---

## 2. Tipos de usuários

### 2.1 Paciente

O paciente é o usuário principal do acompanhamento clínico. Ele cadastra sua conta, define seu perfil, acompanha evolução, registra refeições e medidas e participa dos desafios propostos pelo nutricionista.

Principais objetivos:
- acompanhar sua saúde e sua rotina alimentar;
- registrar peso, medidas e refeições;
- receber e consultar o plano alimentar;
- interagir com o nutricionista;
- participar de desafios e check-ins.

Cadastro e login:
- pode se cadastrar pela rota pública de registro;
- usa autenticação via Supabase;
- precisa confirmar o e-mail para ativar o acesso;
- não precisa de aprovação administrativa.

Áreas acessadas:
- dashboard do paciente;
- visualização do seu plano alimentar;
- histórico de refeições, pesos e medidas;
- chat com o nutricionista vinculado;
- desafios individuais;
- consultas agendadas vinculadas ao seu nutricionista.

Permissões e limitações:
- pode visualizar apenas seus próprios dados e registros;
- não pode gerenciar usuários;
- não pode criar desafios ou consultar dados de outros pacientes;
- só conversa com nutricionista vinculado;
- não pode aprovar ou bloquear outros perfis.

### 2.2 Nutricionista

O nutricionista é o profissional responsável por acompanhar pacientes, prescrever planos alimentares, monitorar progresso e orientar ações de saúde.

Principais objetivos:
- vincular pacientes;
- registrar e acompanhar evolução;
- criar planos alimentares personalizados;
- criar desafios nutricionais;
- agendar consultas;
- comunicar-se com pacientes.

Cadastro e login:
- realiza cadastro como nutricionista;
- o sistema marca `requiresAdminApproval = true`;
- o e-mail precisa ser confirmado no Supabase;
- após confirmação, a solicitação vai para análise do administrador;
- só obtém acesso pleno após aprovação.

Áreas acessadas:
- dashboard do nutricionista;
- lista de pacientes vinculados;
- gestão de medidas, pesagens e planos alimentares;
- criação de desafios;
- acompanhamento de progresso e check-ins;
- envio e leitura de mensagens;
- agendamento de consultas.

Permissões e limitações:
- pode gerenciar apenas seus pacientes vinculados;
- não pode acessar áreas de administração;
- não pode mexer em dados de outro nutricionista;
- não pode aprovar novos profissionais.

### 2.3 Administrador

O administrador atua como operador da plataforma. Ele valida cadastros de nutricionistas, gerencia usuários e tem controle sobre a base de dados operacional.

Principais objetivos:
- revisar solicitações de aprovação;
- bloquear ou ativar usuários;
- consultar usuários cadastrados;
- cadastrar e remover alimentos do catálogo;
- acompanhar métricas gerais do sistema.

Cadastro e login:
- criado por meio de seed ou configuração específica do ambiente;
- não é permitida auto-criação por cadastro público;
- acesso protegido por autenticação e autorização.

Áreas acessadas:
- painel administrativo;
- gestão de usuários;
- solicitações de nutricionistas;
- catálogo de alimentos;
- painel de resumo da plataforma.

Permissões e limitações:
- tem acesso total às operações administrativas;
- não é parte do atendimento clínico direto;
- não deve ter acesso automático aos dados de pacientes sem necessidade funcional.

---

## 3. Matriz completa de permissões

A matriz foi extraída do código da aplicação, especialmente do arquivo `src/constants/permissions.js`. A autorização é realizada por rota e valida o perfil atual do usuário no banco, não apenas o dado do token.

| Funcionalidade | Paciente | Nutricionista | Administrador |
|---|---|---|---|
| Visualizar dashboard | Permitido | Permitido | Permitido |
| Gerenciar perfil | Permitido | Permitido | Permitido |
| Gerenciar pacientes | Não permitido | Permitido com restrições | Não permitido |
| Criar planos alimentares | Não permitido | Permitido | Não permitido |
| Visualizar plano alimentar | Permitido | Permitido com restrições | Não permitido |
| Gerenciar consultas | Não permitido | Permitido | Não permitido |
| Participar de desafios | Permitido | Não permitido | Não permitido |
| Criar desafios | Não permitido | Permitido | Não permitido |
| Realizar check-ins | Permitido | Não permitido | Não permitido |
| Acompanhar progresso | Permitido | Permitido com restrições | Não permitido |
| Enviar mensagens | Permitido com restrições | Permitido com restrições | Não permitido |
| Enviar áudios | Permitido com restrições | Permitido com restrições | Não permitido |
| Gerenciar usuários | Não permitido | Não permitido | Permitido |
| Gerenciar permissões | Não permitido | Não permitido | Permitido |
| Aprovar nutricionistas | Não permitido | Não permitido | Permitido |
| Visualizar solicitações | Não permitido | Não permitido | Permitido |
| Gerenciar catálogo de alimentos | Não permitido | Não permitido | Permitido |

### Observações sobre restrições

- Pacientes só acessam seus próprios dados e o vínculo com o nutricionista responsável.
- Nutricionistas só gerenciam pacientes vinculados ao seu perfil e consultas relacionadas a esses pacientes.
- Administradores não participam do cuidado clínico, mas podem visualizar agregados e tarefas operacionais da plataforma.
- Mensagens e áudios só são permitidos entre paciente e nutricionista com vínculo ativo.

### Operações por perfil

- Visualizar: paciente e nutricionista podem consultar dados de sua interação; administrador visualiza dados agregados e de usuários.
- Criar: nutricionista pode criar planos, desafios e consultas; paciente pode registrar refeições, pesos e check-ins; administrador pode criar alimentos.
- Editar: nutricionista edita métricas de pacientes vinculados, planos e desafios; paciente edita seu próprio perfil; administrador edita usuários e status.
- Excluir: nutricionista exclui medidas e desafios próprios; administrador remove alimentos e usuários quando necessário.
- Aprovar: somente administrador.
- Administrar: somente administrador na camada de usuários, permissões e catálogo.

---

## 4. Funcionalidades do sistema

### 4.1 Autenticação e gerenciamento de usuários

O sistema usa Supabase Auth para autenticação, com tokens e sessão gerenciada em backend. A aplicação valida token, login, e-mail confirmado e vínculo no banco local/Prisma.

Funcionalidades:
- registro de paciente e nutricionista;
- login com e-mail e senha;
- confirmação de e-mail;
- recuperação de senha;
- reenvio de confirmação;
- logout;
- recuperação do perfil autenticado;
- gerenciamento de foto de perfil;
- bloqueio de conta com `isActive`;
- aprovação administrativa de nutricionistas.

Regra importante:
- confirmar o e-mail não equivale a ser aprovado como nutricionista.
- o fluxo de aprovação é obrigatório para esse perfil e só é liberado após análise administrativa.

### 4.2 Gestão de pacientes

Há um vínculo entre paciente e nutricionista, representado no banco pela tabela `PatientProfile` e pelo campo `nutritionistId`.

Funções:
- paciente se vincula a um nutricionista;
- nutricionista vincula um paciente pela identificação do e-mail;
- nutricionista acessa dados importantes do paciente vinculado;
- paciente pode registrar medidas e peso;
- o profissional acompanha histórico e evolução.

### 4.3 Planos alimentares

A base de alimentos é cadastrada e gerenciada, com nutrientes como calorias, proteínas, carboidratos e gordura.

Estrutura:
- `Food`: base de alimentos;
- `MealPlan`: plano alimentar vinculado a paciente e nutricionista;
- `MealPlanItem`: cada item do plano com alimento e quantidade.

O nutricionista cria o plano e associa ao paciente. O paciente pode visualizar o plano e o status da prescrição.

### 4.4 Agendamento de consultas

A aplicação oferece agendamento de consultas com regras rígidas:
- status inicial: `AGENDADA`;
- depois pode ficar `CONFIRMADA`, `CANCELADA` ou `CONCLUIDA`;
- conflitos de horário são bloqueados;
- períodos consecutivos são permitidos, mas sobreposição é rejeitada;
- consultas canceladas não ocupam horário para o sistema;
- só nutricionistas podem criar consultas e apenas para pacientes vinculados.

Principais campos:
- pacienteId;
- nutritionistId;
- startAt;
- endAt;
- status;
- description.

### 4.5 Desafios nutricionais

O sistema conta com um módulo de desafios com categorias e inscrições. Um desafio possui:
- título;
- descrição;
- categoria;
- meta;
- data inicial e final;
- status;
- participantes.

Cada participante pode realizar check-ins diários. O progresso é calculado com base no número de check-ins concluídos ou, quando há `goalTarget`, pela soma dos valores registrados pela meta.

Fluxo:
1. nutricionista cria desafio;
2. paciente se inscreve no desafio;
3. paciente realiza check-ins;
4. progresso é atualizado automaticamente;
5. paciente pode finalizar o desafio manualmente.

### 4.6 Chat entre paciente e nutricionista

O sistema oferece comunicação direta entre paciente e nutricionista, validando vínculo ativo antes do envio.

Recursos:
- mensagens de texto;
- mensagens de áudio;
- validação de extensão e tamanho do áudio;
- duração máxima permitida;
- suporte a transcrição textual do áudio;
- marcação de mensagens como lidas;
- listagem de conversas e histórico.

Regra de negócio importante:
- mensagens só podem ser trocadas entre pessoas com vínculo funcional e ativo.
- o paciente não pode enviar mensagem para qualquer usuário da plataforma.

### 4.7 Administração

O administrador acessa:
- usuários ativos e bloqueados;
- métricas gerais da plataforma;
- solicitações de nutricionista;
- aprovação/reprovação de cadastro;
- cadastro e remoção de alimentos;
- edição de usuários e status.

O sistema também gerencia a segurança e a integridade dos dados com autenticação e autorização por rota.

---

## 5. Fluxos de utilização

### 5.1 Cadastro e primeiro acesso do paciente

1. O paciente acessa a página de registro.
2. Preenche nome, e-mail, senha e perfil (`PATIENT`).
3. O backend cria a conta no Supabase Auth.
4. O sistema envia e-mail de confirmação.
5. O paciente confirma o e-mail.
6. A conta é validada e liberada para login.
7. O paciente pode entrar na plataforma e acessar sua área.

### 5.2 Cadastro de nutricionista

1. O nutricionista inicia cadastro com perfil `NUTRITIONIST`.
2. O sistema registra o usuário com `requiresAdminApproval = true`.
3. O e-mail precisa ser confirmado no Supabase.
4. Após a confirmação, a solicitação é registrada para análise.
5. O acesso não é liberado até a decisão da administração.

### 5.3 Confirmação de e-mail do nutricionista

1. O profissional recebe link de confirmação enviado pelo Supabase.
2. Ao confirmar, a API valida a conta e o e-mail.
3. Se o perfil exige aprovação, a solicitação administrativa é criada ou retomada.
4. O status da solicitação pode ficar em `PENDING`, `APPROVED` ou `REJECTED`.

### 5.4 Envio da solicitação de aprovação

A solicitação de aprovação só é criada se o usuário tiver o perfil de nutricionista e o e-mail confirmado. Isso impede que um profissional sem validacão acesse áreas protegidas antes da análise do administrador.

### 5.5 Análise do cadastro pelo administrador

1. O administrador acessa a rota de solicitações.
2. Visualiza informações do nutricionista e status da solicitação.
3. Pode aprovar ou recusar.
4. Se recusar, deve informar o motivo.

### 5.6 Aprovação do nutricionista

1. O administrador aceita a solicitação.
2. O status da solicitação é alterado para `APPROVED`.
3. O sistema permite que a conta faça login normalmente.
4. O nutricionista passa a ter acesso às funções protegidas.

### 5.7 Recusa do cadastro

1. O administrador rejeita a solicitação.
2. A aplicação registra o motivo da recusa.
3. O profissional continua registrado no sistema, mas não consegue acessar as áreas do nutricionista.
4. O login pode ser bloqueado com mensagem explicando a recusa.

### 5.8 Criação de plano alimentar

1. Nutricionista escolhe o paciente vinculado.
2. Define nome, alimentos, quantidade e objetivos.
3. O sistema valida os dados e cria o plano.
4. O paciente pode visualizar o plano e seguir as orientações.

### 5.9 Agendamento de consulta

1. Nutricionista escolhe paciente vinculado.
2. Define data, horário e descrição.
3. O backend valida se há conflito com outros agendamentos.
4. A consulta é criada com status inicial `AGENDADA`.
5. O paciente e o nutricionista visualizam o compromisso em seus dashboards.

### 5.10 Participação do paciente em desafio nutricional

1. O nutricionista cria desafio.
2. Paciente é inscrito ou se inscreve.
3. O sistema valida vínculo com o nutricionista.
4. O paciente registra check-ins diários.
5. O progresso é recalculado automaticamente.

### 5.11 Realização de check-in

1. O paciente acessa a página do desafio.
2. Registra data, valor e observações.
3. O sistema valida se a data está dentro do período do desafio.
4. Se o valor atinge a meta, o check-in é marcado como concluído.
5. O progresso total do paciente é atualizado.

### 5.12 Comunicação pelo chat

1. O paciente ou nutricionista seleciona a conversa.
2. Envia texto ou mensagem de voz.
3. O backend valida o vínculo ativo e a estrutura da mensagem.
4. O conteúdo é salvo no banco.
5. O destinatário pode visualizar a mensagem e, se for recebida, é marcada como lida.

---

## 6. Aprovação de nutricionistas

Esse processo é um diferencial-chave do sistema e foi implementado como controle de governança do atendimento profissional.

### Por que existe a aprovação administrativa?

Porque a plataforma trata de dados clínicos e de aconselhamento alimentar, então a criação de um nutricionista não pode ser totalmente aberta para qualquer registro. A aprovação administrativa atua como filtro de qualidade, segurança e legitimidade profissional.

### Informações solicitadas

O cadastro do nutricionista inclui:
- nome;
- e-mail;
- senha;
- perfil Nutricionista;
- vínculo com conta autenticada no Supabase.

A lógica da aplicação também marca o perfil como sujeito a aprovação administrativa, com `requiresAdminApproval` ativado.

### Como funciona a confirmação de e-mail no Supabase

Durante o cadastro, a aplicação utiliza o Supabase Auth para criar a conta com confirmação de e-mail obrigatória. O link de confirmação é enviado ao usuário e o backend valida o token enviado no redirect.

Esse processo garante que a conta real pertença à pessoa que se cadastrou.

### Por que a confirmação do e-mail acontece antes da solicitação administrativa?

Porque o sistema precisa garantir que o endereço de e-mail informado seja válido, pertencente ao profissional e que a conta esteja realmente ativa antes de iniciar a análise. A aprovação administrativa não substitui a verificação de identidade da autenticação.

### Quando a solicitação aparece para o administrador?

Após a confirmação do e-mail do profissional, o backend cria ou recupera a solicitação de aprovação e a mantém em status `PENDING`. A partir desse ponto, o admin passa a ver a solicitação em sua lista.

### Status possíveis

- `PENDING`: aguardando decisão.
- `APPROVED`: aprovado, o acesso é liberado.
- `REJECTED`: recusado, com motivo informado.

### Como funciona a aprovação

O administrador acessa a rota de solicitações, verifica a solicitação e define `APPROVED`. O backend atualiza o status e libera o acesso do nutricionista ao ambiente protegido.

### Como funciona a recusa

Se o administrador rejeita, ele precisa informar o motivo. Esse motivo é salvo na solicitação e exibido ao profissional em respostas de autenticação e login bloqueado.

### Como o acesso é liberado

O sistema verifica no login:
- se o usuário é nutricionista;
- se possui aprovação administrativa;
- se a solicitação está `APPROVED`;
- se a conta está ativa.

Se qualquer desses critérios falhar, o login é negado com mensagens claras.

### Como o sistema impede que um profissional não aprovado acesse áreas protegidas

A lógica do middleware de autenticação e do serviço de autorização valida:
- presença do token;
- autenticação no Supabase;
- usuário existente e ativo;
- perfil no banco;
- aprovação administrativa, quando aplicável;
- permissão da rota para o perfil.

Ou seja, um usuário sem aprovação não consegue prosseguir em rotas de nutricionista mesmo que tenha um token válido.

---

## 7. Tecnologias utilizadas

### 7.1 Linguagem e runtime

- JavaScript
- Node.js 20+

Essas tecnologias são visíveis no `package.json` e no ambiente de execução da aplicação. O sistema é executado em um ambiente Node.js clássico com Express.

### 7.2 Backend

- Express 5
- API REST
- Controllers, services, repositories, routes, middlewares

A estrutura do backend está organizada em camadas, permitindo separar regras de negócio, acesso ao banco e apresentação de respostas.

### 7.3 Frontend

- HTML
- CSS
- JavaScript
- Tailwind CSS (via CDN no HTML)

O frontend não é um framework SPA completo. Ele é composto por páginas estáticas e scripts que consomem a API REST. Há páginas dedicadas para:
- landing page;
- dashboard do paciente;
- dashboard do nutricionista;
- dashboard do administrador;
- desafios;
- autenticação.

### 7.4 Banco de dados

- SQLite em desenvolvimento
- PostgreSQL em produção

O Prisma usa `schema.sqlite.prisma` para ambiente local e `schema.prisma` para produção. Isso permite desenvolvimento local sem infraestrutura externa e implantação em ambiente profissional com PostgreSQL.

### 7.5 ORM

- Prisma ORM

O Prisma centraliza modelagem de dados, migrations, queries e acesso estruturado ao banco. Ele organiza modelos como `User`, `MealPlan`, `Challenge`, `ChatMessage`, `Appointment`, `PatientProfile`, dentre outros.

### 7.6 Autenticação e sessão

- Supabase Auth

A autenticação é externalizada para o Supabase, responsável por login, sign-up, confirmação de e-mail, recuperação de senha e sessão. O backend valida as sessões e confirma o perfil no banco para acesso e permissões.

### 7.7 Armazenamento de arquivos

- storage local em desenvolvimento
- Supabase Storage como alternativa para produção

O sistema permite fazer upload de fotos de perfil e, em ambiente de produção, pode usar um bucket do Supabase.

### 7.8 E-mail

- Supabase Auth + fluxo de confirmação de e-mail

O envio de confirmação, recuperação de e-mail e login dependem do mecanismo do Supabase Auth, e não de um serviço de e-mail separado implementado manualmente.

### 7.9 Hospedagem e deploy

- Vercel
- ambiente de produção com PostgreSQL e Supabase

O repositório possui configuração para Vercel e também documentação de implantação específica para Vercel, Supabase e PostgreSQL.

### 7.10 Controle de versão

- Git
- GitHub

O projeto está versionado e possui infraestrutura para GitHub e Vercel.

### 7.11 Testes automatizados

- Jest
- Supertest

Existem testes automatizados para validar regras e permissões. O script principal executa a suíte com `npm test`.

### 7.12 Integrações e bibliotecas adicionais

- dotenv: leitura de variáveis de ambiente
- @supabase/supabase-js: comunicação com Supabase
- Prisma Client: acesso ao banco

---

## 8. Arquitetura do sistema

A arquitetura do NutriFlow é organizada em camadas e segue um padrão simples, funcional e previsível.

### 8.1 Frontend

A interface está em `frontend/` e é servida pelo Express. A aplicação entrega páginas HTML, CSS e JS. Há também rotas internas e aliases para páginas do dashboard.

Exemplos:
- `/` para landing page;
- `/dashboard` para paciente;
- `/dashboard-nutricionista` para nutricionista;
- `/dashboard-admin` para administração;
- `/nutritionists/challenges` e `/patients/challenges` para lista de desafios.

### 8.2 Backend

A lógica principal fica em `src/`:
- `routes/`: declara endpoints de API;
- `controllers/`: recebe requisições e encaminha para os services;
- `services/`: implementa regras de negócio;
- `repositories/`: encapsula acesso ao Prisma;
- `middlewares/`: autenticação, autorização e tratamento de erros;
- `infra/`: integração com Supabase e banco.

### 8.3 API REST

A API é acessada via endpoints com prefixos:
- `/api/auth` para autenticação;
- `/api/users` para gestão de perfil;
- `/api/patients` para ações de pacientes e medidas;
- `/api/patient` para dashboard do paciente;
- `/api/nutritionist` e `/api/nutritionists` para áreas do nutricionista;
- `/api/admin` para administração;
- `/api/appointments` para agendamento e consultas;
- `/chat` e `/api/chat` para mensagens.

### 8.4 Fluxo de comunicação

1. O cliente envia requisição HTTP ao Express.
2. O middleware de autenticação valida token Supabase.
3. O middleware de autorização valida a rota e o perfil permitido.
4. O controller chama o service.
5. O service usa o repository e o Prisma para consultar ou alterar dados.
6. A resposta volta ao cliente em JSON ou em conteúdo HTML estático.

### 8.5 Segurança em arquitetura

A plataforma aplica controles em vários níveis:
- autenticação externa via Supabase;
- autorização por rota;
- validação do perfil atual no banco;
- checagem de vínculo ativo;
- restrição de email e perfil;
- bloqueio de usuários inativos;
- controle de status e aprovação de nutricionistas.

---

## 9. Banco de dados e principais entidades

O modelo de dados é centralizado em Prisma e cobre os principais domínios do sistema.

### Entidades principais

- `User`: centraliza os usuários, perfil, e-mail, ativação e foto.
- `PatientProfile`: dados do paciente, objetivo, medidas e vínculo com nutricionista.
- `NutritionistApprovalRequest`: solicitações de aprovação de nutricionistas.
- `MealPlan`: plano alimentar associado a paciente e nutricionista.
- `MealPlanItem`: itens do plano.
- `Food`: catálogo de alimentos.
- `Appointment`: agendamentos e consultas.
- `Challenge`: desafios nutricionais.
- `ChallengeParticipant`: participação de pacientes em desafios.
- `ChallengeCheckIn`: registros diários de progresso.
- `ChatMessage`: mensagens de texto e áudio.

### Relações importantes

- um usuário pode ser paciente, nutricionista ou administrador;
- paciente pode ter apenas um nutricionista vinculado em funcionamento principal;
- nutricionista pode ter vários pacientes vinculados;
- um plano alimentar sempre relaciona paciente e nutricionista;
- um desafio sempre pertence a um nutricionista;
- cada check-in é associado a um participante específico do desafio;
- mensagens são armazenadas entre paciente e nutricionista.

---

## 10. Regras de negócio e segurança

O sistema aplica regras fortes para manter integridade e privacidade:

- login exige e-mail confirmado;
- nutricionistas exigem aprovação administrativa antes de acesso completo;
- pacientes só podem interagir com seu nutricionista vinculado;
- nutricionistas só operam em pacientes vinculados;
- consultas não podem se sobrepor;
- check-ins fora do período do desafio são rejeitados;
- mensagem de áudio precisa obedecer limites de tamanho e tipo;
- nomes, e-mails, telefones e metas são validados antes da gravação;
- rotas são bloqueadas por autorização explícita.

Essas regras são, em grande parte, implementadas em `services` e validadas pelos middlewares de autenticação/autorizaçao.

---

## 11. Conclusão

O NutriFlow é uma plataforma funcional, estruturada e orientada ao acompanhamento nutricional em ambiente digital. O produto combina autenticação robusta, separação clara de perfis, autorização granular, gestão de pacientes, planos alimentares, desafios, consultas e comunicação em uma mesma solução.

A arquitetura atual possibilita evolução, manutenção e expansão do sistema. O projeto está alinhado com o uso de tecnologias modernas, mas mantém uma estrutura simples e direta para um ambiente acadêmico e de apresentação.

Em termos de valor para o usuário, o NutriFlow representa uma transformação importante do atendimento nutricional: deixa de depender de registros dispersos e processos manuais para se tornar um ambiente digital organizado, seguro e centrado no acompanhamento contínuo da saúde.
