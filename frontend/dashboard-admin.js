const {
  createApiClient,
  createSessionManager,
  createToastController,
  escapeHtml,
  formatSidebarDate: formatCoreSidebarDate,
  getInitials,
} = window.NutriFlowCore;

const session = createSessionManager({
  redirectTo: 'index.html?auth=login',
});

const state = {
  currentUser: session.getUser(),
  summary: null,
  users: [],
  foods: [],
  isSavingFood: false,
  isLoadingUsers: false,
  isLoadingFoods: false,
};

const adminGlobalSearch = document.getElementById('adminGlobalSearch');
const adminUserSearch = document.getElementById('adminUserSearch');
const adminRoleFilter = document.getElementById('adminRoleFilter');
const adminUsersList = document.getElementById('adminUsersList');
const adminEmptyUsers = document.getElementById('adminEmptyUsers');
const adminDistributionList = document.getElementById('adminDistributionList');
const adminAttentionList = document.getElementById('adminAttentionList');
const foodForm = document.getElementById('foodForm');
const foodSearch = document.getElementById('foodSearch');
const foodsList = document.getElementById('foodsList');
const foodSubmitButton = document.getElementById('foodSubmitButton');
const adminToast = document.getElementById('adminToast');
const adminLogoutButton = document.getElementById('adminLogoutButton');
const adminStatusMessage = document.getElementById('adminStatusMessage');
const toastController = createToastController(adminToast, { duration: 2400 });
const apiRequest = createApiClient({
  getToken: session.getToken,
  onUnauthorized(message) {
    showPanelStatus('Acesso negado. Redirecionando para login...', 'error');
    showToast(message || 'Acesso negado. Faca login novamente.');
    window.setTimeout(clearSessionAndRedirect, 700);
  },
  invalidResponseMessage: 'Resposta invalida do servidor.',
  defaultErrorMessage: 'Nao foi possivel concluir a operacao.',
});

function clearSessionAndRedirect() {
  session.clear();
}

function ensureAdminAccess() {
  return session.ensureAuthenticated();
}

function showToast(message) {
  toastController.show(message);
}

function showPanelStatus(message, variant = 'info') {
  if (!adminStatusMessage || !message) {
    return;
  }

  const baseClass = 'rounded-[22px] px-5 py-4 text-sm font-semibold shadow-[0_16px_32px_rgba(28,38,24,.08)]';
  const variantClass = variant === 'error'
    ? 'border border-red-200 bg-red-50 text-red-700'
    : 'border border-nutriflow-100 bg-white/90 text-nutriflow-700';

  adminStatusMessage.className = `${baseClass} ${variantClass}`;
  adminStatusMessage.textContent = message;
}

function hidePanelStatus() {
  if (!adminStatusMessage) {
    return;
  }

  adminStatusMessage.classList.add('hidden');
  adminStatusMessage.textContent = '';
}

function setTextContent(target, value) {
  const element = typeof target === 'string' ? document.getElementById(target) : target;

  if (element) {
    element.textContent = value;
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value) {
  return `${Math.round(toNumber(value))}%`;
}

function formatDecimal(value) {
  return toNumber(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatCount(value, singular, plural) {
  const total = toNumber(value);
  return `${total} ${total === 1 ? singular : plural}`;
}

function readRequiredNumber(inputId, label) {
  const input = document.getElementById(inputId);
  const rawValue = String(input?.value || '').trim();

  if (!rawValue) {
    throw new Error(`Informe ${label}.`);
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Informe um valor valido para ${label}.`);
  }

  return Math.round(parsed);
}

function normalizeRole(profile) {
  const normalized = String(profile || '').trim();

  if (!normalized) {
    return '';
  }

  const canonical = normalized.toUpperCase();

  if (canonical === 'PATIENT' || canonical === 'NUTRITIONIST' || canonical === 'ADMIN') {
    return canonical;
  }

  const localized = normalized.toLowerCase();

  if (localized === 'administrador' || localized === 'administrator' || localized === 'admin') {
    return 'ADMIN';
  }

  if (localized === 'nutricionista' || localized === 'nutritionist') {
    return 'NUTRITIONIST';
  }

  if (localized === 'paciente' || localized === 'patient') {
    return 'PATIENT';
  }

  return canonical;
}

function getRoleBadgeClass(role) {
  if (role === 'PATIENT') {
    return 'admin-role-pill is-patient';
  }

  if (role === 'NUTRITIONIST') {
    return 'admin-role-pill is-nutritionist';
  }

  return 'admin-role-pill is-admin';
}

function formatSidebarDate() {
  return formatCoreSidebarDate({ stripPeriod: true });
}

function getGreetingLabel() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Bom dia';
  }

  if (hour < 18) {
    return 'Boa tarde';
  }

  return 'Boa noite';
}

function getFirstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Administrador';
}

function getUserContext(user) {
  if (user.role === 'PATIENT') {
    if (user.patientProfile?.objective) {
      return user.patientProfile.objective;
    }

    return 'Paciente sem objetivo registrado';
  }

  if (user.role === 'NUTRITIONIST') {
    if (user.nutritionistProfile?.clinic) {
      return user.nutritionistProfile.clinic;
    }

    if (user.nutritionistProfile?.crn) {
      return `CRN ${user.nutritionistProfile.crn}`;
    }

    return 'Profissional ativo na plataforma';
  }

  return 'Governanca e operacao da plataforma';
}

function getAdminMetrics() {
  const summary = state.summary || {};
  const totalUsers = toNumber(summary.totalUsers);
  const totalPatients = toNumber(summary.totalPatients);
  const totalNutritionists = toNumber(summary.totalNutritionists);
  const totalAdmins = toNumber(summary.totalAdmins);
  const activeUsers = toNumber(summary.activeUsers);
  const blockedUsers = toNumber(summary.blockedUsers);
  const totalFoods = toNumber(summary.totalFoods);
  const foodLogsToday = toNumber(summary.foodLogsToday);
  const activeMealPlans = toNumber(summary.activeMealPlans);
  const activationRate = totalUsers ? (activeUsers / totalUsers) * 100 : 0;
  const blockedRate = totalUsers ? (blockedUsers / totalUsers) * 100 : 0;
  const patientsPerNutritionist = totalNutritionists ? totalPatients / totalNutritionists : 0;
  const catalogDensity = clamp((totalFoods / 120) * 100, 0, 100);
  const adminCoverage = totalUsers ? (totalAdmins / totalUsers) * 100 : 0;
  const opsAlerts = blockedUsers + (totalFoods < 24 ? 1 : 0) + (foodLogsToday === 0 ? 1 : 0);
  const healthScore = Math.round((activationRate + (100 - blockedRate) + catalogDensity) / 3);

  return {
    totalUsers,
    totalPatients,
    totalNutritionists,
    totalAdmins,
    activeUsers,
    blockedUsers,
    totalFoods,
    foodLogsToday,
    activeMealPlans,
    activationRate,
    blockedRate,
    patientsPerNutritionist,
    catalogDensity,
    adminCoverage,
    opsAlerts,
    healthScore,
  };
}

function getRecommendation(metrics) {
  if (metrics.blockedUsers >= 5) {
    return {
      title: 'Priorize governanca de contas',
      body: `${metrics.blockedUsers} contas bloqueadas ja impactam a qualidade da base. Revise suporte, erros recorrentes e a politica de reativacao.`,
      pulse: 'Atencao',
    };
  }

  if (metrics.totalFoods < 24) {
    return {
      title: 'Expandir catalogo nutricional',
      body: 'A base de alimentos ainda esta rasa para um produto de acompanhamento continuo. Priorize cobertura de staples, frutas, proteinas e lanches frequentes.',
      pulse: 'Construindo base',
    };
  }

  if (metrics.foodLogsToday === 0 && metrics.totalPatients > 0) {
    return {
      title: 'Monitorar engajamento do dia',
      body: 'Nao houve registros alimentares hoje. Vale revisar notificacoes, funil de login e friccao nas rotinas do paciente.',
      pulse: 'Monitorar uso',
    };
  }

  if (metrics.patientsPerNutritionist > 18) {
    return {
      title: 'Balancear capacidade clinica',
      body: `A carga media esta em ${formatDecimal(metrics.patientsPerNutritionist)} pacientes por nutricionista. Considere redistribuicao ou crescimento da rede profissional.`,
      pulse: 'Capacidade em foco',
    };
  }

  return {
    title: 'Operacao com boa estabilidade',
    body: 'A plataforma apresenta boa distribuicao entre ativacao, catalogo e cobertura assistencial. O foco agora pode ser refino de experiencia e crescimento.',
    pulse: 'Estavel',
  };
}

function renderInsightRows(container, rows, emptyState) {
  if (!container) {
    return;
  }

  if (!rows.length) {
    container.innerHTML = `
      <article class="admin-insight-row">
        <div>
          <strong>${escapeHtml(emptyState.title)}</strong>
          <span>${escapeHtml(emptyState.description)}</span>
        </div>
        <b>OK</b>
      </article>
    `;
    return;
  }

  container.innerHTML = rows.map((row) => `
    <article class="admin-insight-row">
      <div>
        <strong>${escapeHtml(row.title)}</strong>
        <span>${escapeHtml(row.description)}</span>
      </div>
      <b>${escapeHtml(row.metric)}</b>
    </article>
  `).join('');
}

function setHeader(admin) {
  const firstName = getFirstName(admin.name);
  setTextContent('adminGreeting', `${getGreetingLabel()}, ${firstName}`);
  setTextContent('adminName', admin.name || 'Conta admin');
  setTextContent('adminEmail', admin.email || '--');
  setTextContent('adminAvatar', getInitials(admin.name));
}

function renderSummary() {
  const metrics = getAdminMetrics();
  const recommendation = getRecommendation(metrics);

  setTextContent('summaryTotalUsers', metrics.totalUsers);
  setTextContent('summaryTotalPatients', metrics.totalPatients);
  setTextContent('summaryTotalNutritionists', metrics.totalNutritionists);
  setTextContent('summaryTotalAdmins', metrics.totalAdmins);
  setTextContent('summaryActiveUsers', metrics.activeUsers);
  setTextContent('summaryBlockedUsers', metrics.blockedUsers);
  setTextContent('summaryTotalFoods', metrics.totalFoods);

  setTextContent('adminSidebarUsers', metrics.activeUsers);
  setTextContent('adminSidebarBlocked', metrics.blockedUsers);
  setTextContent('adminSidebarFoods', metrics.totalFoods);

  setTextContent('adminWorkspaceActivationValue', formatPercent(metrics.activationRate));
  setTextContent('adminWorkspaceActivationMeta', `${metrics.activeUsers} contas ativas de ${metrics.totalUsers} registradas hoje.`);
  setTextContent('adminWorkspaceUsersValue', formatCount(metrics.activeUsers, 'conta', 'contas'));
  setTextContent('adminWorkspaceUsersMeta', `${metrics.blockedUsers} bloqueadas e ${metrics.totalAdmins} administradores disponiveis para operacao.`);
  setTextContent('adminWorkspaceFoodsValue', formatCount(metrics.totalFoods, 'item', 'itens'));
  setTextContent('adminWorkspaceFoodsMeta', `${metrics.foodLogsToday} registros alimentares processados hoje e ${metrics.activeMealPlans} planos ativos.`);
  setTextContent('adminWorkspaceAlertsValue', formatCount(metrics.opsAlerts, 'sinal', 'sinais'));
  setTextContent('adminWorkspaceAlertsMeta', metrics.blockedUsers
    ? `${metrics.blockedUsers} contas exigem revisao imediata.`
    : 'Sem bloqueios criticos no momento.');

  setTextContent('adminOpsActivationRate', formatPercent(metrics.activationRate));
  setTextContent('adminOpsActivationMeta', `${metrics.activeUsers} ativos e ${metrics.blockedUsers} bloqueados.`);
  setTextContent('adminOpsCoverageValue', formatDecimal(metrics.patientsPerNutritionist));
  setTextContent('adminOpsCoverageMeta', 'Pacientes por nutricionista em media.');
  setTextContent('adminOpsFoodLogsValue', metrics.foodLogsToday);
  setTextContent('adminOpsFoodLogsMeta', metrics.foodLogsToday
    ? 'O dia tem movimento registrado pelos pacientes.'
    : 'Ainda sem atividade alimentar registrada hoje.');
  setTextContent('adminOpsPlansValue', metrics.activeMealPlans);
  setTextContent('adminOpsPlansMeta', metrics.activeMealPlans
    ? 'Planos em execucao na rede clinica.'
    : 'Nenhum plano ativo no momento.');

  setTextContent('adminMetricActivationRate', formatPercent(metrics.activationRate));
  setTextContent('adminMetricBlockedRate', formatPercent(metrics.blockedRate));
  setTextContent('adminMetricCareLoad', formatDecimal(metrics.patientsPerNutritionist));
  setTextContent('adminMetricCatalogDensity', formatPercent(metrics.catalogDensity));
  setTextContent('adminMetricAdminCoverage', formatPercent(metrics.adminCoverage));
  setTextContent('adminMetricFoodLogs', metrics.foodLogsToday);
  setTextContent('adminMetricAdmins', metrics.totalAdmins);
  setTextContent('adminMetricMealPlans', metrics.activeMealPlans);
  setTextContent('adminMetricCareLoadAside', formatDecimal(metrics.patientsPerNutritionist));
  setTextContent('adminMetricExecutivePulse', recommendation.pulse);
  setTextContent('adminRecommendationTitle', recommendation.title);
  setTextContent('adminRecommendationBody', recommendation.body);
}

function setSummaryLoading() {
  [
    'summaryTotalUsers',
    'summaryTotalPatients',
    'summaryTotalNutritionists',
    'summaryTotalAdmins',
    'summaryActiveUsers',
    'summaryBlockedUsers',
    'summaryTotalFoods',
  ].forEach((id) => setTextContent(id, '...'));
}

function renderDistribution() {
  const distribution = [
    {
      title: 'Pacientes',
      description: 'Usuarios finais com historico alimentar e metas.',
      metric: String(state.users.filter((user) => user.role === 'PATIENT').length),
    },
    {
      title: 'Nutricionistas',
      description: 'Profissionais responsaveis por planos e acompanhamentos.',
      metric: String(state.users.filter((user) => user.role === 'NUTRITIONIST').length),
    },
    {
      title: 'Administradores',
      description: 'Contas com permissao de governanca da plataforma.',
      metric: String(state.users.filter((user) => user.role === 'ADMIN').length),
    },
  ];

  renderInsightRows(adminDistributionList, distribution, {
    title: 'Sem usuarios na base',
    description: 'Assim que a plataforma receber cadastros, a distribuicao aparece aqui.',
  });
}

function renderAttention() {
  const blockedUsers = state.users.filter((user) => !user.isActive).slice(0, 3);
  const recentUsers = state.users.slice(0, 3);

  const rows = blockedUsers.length
    ? blockedUsers.map((user) => ({
        title: user.name,
        description: `${user.profile} bloqueado. Revise suporte e politica de acesso.`,
        metric: 'Bloq.',
      }))
    : recentUsers.map((user) => ({
        title: user.name,
        description: `${user.profile} criado em ${user.createdAt}. Conta ativa e sem bloqueios.`,
        metric: 'Novo',
      }));

  renderInsightRows(adminAttentionList, rows, {
    title: 'Base sem alertas',
    description: 'Nenhum usuario precisa de acao imediata neste momento.',
  });
}

function getFilteredUsers() {
  const search = String(adminUserSearch?.value || '').trim().toLowerCase();
  const role = String(adminRoleFilter?.value || '').trim();

  return state.users.filter((user) => {
    const matchesSearch = !search
      || user.name.toLowerCase().includes(search)
      || user.email.toLowerCase().includes(search);
    const matchesRole = !role || user.role === role;

    return matchesSearch && matchesRole;
  });
}

function setUsersLoading(isLoading) {
  state.isLoadingUsers = isLoading;

  if (!adminUsersList || !adminEmptyUsers) {
    return;
  }

  if (!isLoading) {
    return;
  }

  adminEmptyUsers.classList.add('hidden');
  adminUsersList.innerHTML = `
    <div class="px-6 py-10 text-center text-sm font-semibold text-nutriflow-600">
      Carregando usuarios reais do backend...
    </div>
  `;
}

function renderUsersError(message) {
  if (!adminUsersList || !adminEmptyUsers) {
    return;
  }

  adminEmptyUsers.classList.add('hidden');
  adminUsersList.innerHTML = `
    <div class="px-6 py-10 text-center text-sm font-semibold text-red-700">
      ${escapeHtml(message || 'Nao foi possivel carregar os usuarios.')}
    </div>
  `;
}

function renderUsers() {
  const users = getFilteredUsers();
  const totalActive = users.filter((user) => user.isActive).length;
  const totalBlocked = users.filter((user) => !user.isActive).length;

  setTextContent('adminFilteredUsersCount', users.length);
  setTextContent('adminFilteredActiveCount', totalActive);
  setTextContent('adminFilteredBlockedCount', totalBlocked);

  if (!adminUsersList || !adminEmptyUsers) {
    return;
  }

  adminUsersList.innerHTML = '';
  adminEmptyUsers.classList.toggle('hidden', users.length > 0);

  users.forEach((user) => {
    const context = getUserContext(user);
    const roleBadgeClass = getRoleBadgeClass(user.role);
    const initials = getInitials(user.name);

    const row = document.createElement('div');
    row.className = 'px-4 py-4';
    row.innerHTML = `
      <div class="hidden items-center gap-4 md:grid md:grid-cols-[1.25fr_.85fr_.55fr_.6fr_.8fr]">
        <div class="flex items-center gap-3">
          <div class="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef6e8] text-sm font-bold text-nutriflow-900">${escapeHtml(initials)}</div>
          <div class="min-w-0">
            <p class="truncate font-semibold text-nutriflow-950">${escapeHtml(user.name)}</p>
            <p class="truncate text-xs text-nutriflow-600">${escapeHtml(user.email)}</p>
          </div>
        </div>
        <div>
          <span class="${roleBadgeClass}">${escapeHtml(user.profile)}</span>
          <span class="admin-user-context">${escapeHtml(context)}</span>
        </div>
        <span><span class="${user.isActive ? 'status-pill is-active' : 'status-pill is-late'}">${user.isActive ? 'Ativo' : 'Bloqueado'}</span></span>
        <span class="text-sm text-nutriflow-700">${escapeHtml(user.createdAt)}</span>
        <div class="flex justify-end gap-2">
          <button class="rounded-full border border-nutriflow-200 px-3 py-2 text-xs font-semibold text-nutriflow-900" data-toggle-user="${escapeHtml(user.id)}" data-next-status="${user.isActive ? 'false' : 'true'}">${user.isActive ? 'Bloquear' : 'Reativar'}</button>
          <button class="rounded-full bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-[#a74242]" data-delete-user="${escapeHtml(user.id)}">Remover</button>
        </div>
      </div>
      <div class="space-y-4 md:hidden">
        <div class="flex items-center gap-3">
          <div class="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef6e8] text-sm font-bold text-nutriflow-900">${escapeHtml(initials)}</div>
          <div class="min-w-0">
            <p class="truncate font-semibold text-nutriflow-950">${escapeHtml(user.name)}</p>
            <p class="truncate text-xs text-nutriflow-600">${escapeHtml(user.email)}</p>
          </div>
        </div>
        <div class="space-y-2">
          <span class="${roleBadgeClass}">${escapeHtml(user.profile)}</span>
          <p class="text-sm text-nutriflow-700">${escapeHtml(context)}</p>
        </div>
        <div class="flex items-center justify-between text-sm text-nutriflow-700">
          <span>${escapeHtml(user.createdAt)}</span>
          <span class="${user.isActive ? 'status-pill is-active' : 'status-pill is-late'}">${user.isActive ? 'Ativo' : 'Bloqueado'}</span>
        </div>
        <div class="flex gap-2">
          <button class="flex-1 rounded-full border border-nutriflow-200 px-3 py-2 text-xs font-semibold text-nutriflow-900" data-toggle-user="${escapeHtml(user.id)}" data-next-status="${user.isActive ? 'false' : 'true'}">${user.isActive ? 'Bloquear' : 'Reativar'}</button>
          <button class="flex-1 rounded-full bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-[#a74242]" data-delete-user="${escapeHtml(user.id)}">Remover</button>
        </div>
      </div>
    `;

    adminUsersList.appendChild(row);
  });

  adminUsersList.querySelectorAll('[data-toggle-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;

      try {
        await apiRequest(`/api/admin/users/${button.dataset.toggleUser}/status`, {
          method: 'PATCH',
          body: JSON.stringify({
            isActive: button.dataset.nextStatus === 'true',
          }),
        });
        await Promise.all([refreshUsers(), refreshSummary()]);
        hidePanelStatus();
        showToast('Status do usuario atualizado.');
      } catch (error) {
        showPanelStatus(error.message, 'error');
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  adminUsersList.querySelectorAll('[data-delete-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = state.users.find((candidate) => candidate.id === button.dataset.deleteUser);
      const confirmed = window.confirm(
        `Remover ${user?.name || 'este usuario'}? Esta acao nao pode ser desfeita.`,
      );

      if (!confirmed) {
        return;
      }

      button.disabled = true;

      try {
        await apiRequest(`/api/admin/users/${button.dataset.deleteUser}`, {
          method: 'DELETE',
        });
        await Promise.all([refreshUsers(), refreshSummary()]);
        hidePanelStatus();
        showToast('Usuario removido com sucesso.');
      } catch (error) {
        showPanelStatus(error.message, 'error');
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  renderDistribution();
  renderAttention();
}

function getFilteredFoods() {
  const search = String(foodSearch?.value || '').trim().toLowerCase();
  return state.foods.filter((food) => !search || food.name.toLowerCase().includes(search));
}

function getFoodMacroShare(food) {
  const protein = toNumber(food.protein);
  const carbs = toNumber(food.carbs);
  const fat = toNumber(food.fat);
  const total = protein + carbs + fat || 1;

  return {
    protein,
    carbs,
    fat,
    proteinWidth: Math.round((protein / total) * 100),
    carbsWidth: Math.round((carbs / total) * 100),
    fatWidth: Math.round((fat / total) * 100),
  };
}

function setFoodsLoading(isLoading) {
  state.isLoadingFoods = isLoading;

  if (!foodsList) {
    return;
  }

  if (!isLoading) {
    return;
  }

  foodsList.innerHTML = `
    <div class="rounded-[22px] border border-dashed border-nutriflow-200 bg-white p-4 text-sm font-semibold text-nutriflow-600 md:col-span-2">
      Carregando alimentos reais do backend...
    </div>
  `;
}

function renderFoodsError(message) {
  if (!foodsList) {
    return;
  }

  foodsList.innerHTML = `
    <div class="rounded-[22px] border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700 md:col-span-2">
      ${escapeHtml(message || 'Nao foi possivel carregar os alimentos.')}
    </div>
  `;
}

function renderFoods() {
  const foods = getFilteredFoods();
  const allFoods = state.foods;
  const totalCalories = allFoods.reduce((sum, food) => sum + toNumber(food.calories), 0);
  const totalMacroDensity = allFoods.reduce((sum, food) => (
    sum + toNumber(food.protein) + toNumber(food.carbs) + toNumber(food.fat)
  ), 0);
  const averageCalories = allFoods.length ? Math.round(totalCalories / allFoods.length) : 0;
  const averageMacroDensity = allFoods.length ? Math.round(totalMacroDensity / allFoods.length) : 0;
  const readiness = clamp((allFoods.length / 80) * 100, 0, 100);

  setTextContent('adminFoodBaseReadiness', formatPercent(readiness));
  setTextContent('adminFoodBaseReadinessMeta', `${formatCount(allFoods.length, 'item', 'itens')} cadastrados no catalogo principal.`);
  setTextContent('adminFoodAverageCalories', `${averageCalories} kcal`);
  setTextContent('adminFoodAverageCaloriesMeta', allFoods.length
    ? 'Media geral por item cadastrado.'
    : 'Cadastre alimentos para calcular a referencia.');
  setTextContent('adminFoodMacroDensity', `${averageMacroDensity}g`);
  setTextContent('adminFoodMacroDensityMeta', allFoods.length
    ? 'Soma media de macros por alimento.'
    : 'Sem densidade macro enquanto o catalogo estiver vazio.');
  setTextContent('adminFilteredFoodsCount', foods.length);
  setTextContent('adminFilteredFoodsMeta', foods.length
    ? `${foods.filter((food) => toNumber(food.calories) >= averageCalories).length} itens acima da media calorica atual.`
    : 'Nenhum alimento corresponde a busca atual.');

  if (!foodsList) {
    return;
  }

  if (!foods.length) {
    const emptyMessage = allFoods.length
      ? 'Nenhum alimento encontrado para o filtro atual.'
      : 'Nenhum alimento cadastrado ainda. Use o formulario ao lado para criar o primeiro item da base nutricional.';

    foodsList.innerHTML = `<div class="rounded-[22px] border border-dashed border-nutriflow-200 bg-white p-4 text-sm text-nutriflow-600 md:col-span-2">${emptyMessage}</div>`;
    return;
  }

  foodsList.innerHTML = foods.map((food) => {
    const share = getFoodMacroShare(food);

    return `
      <article class="admin-food-card">
        <div class="admin-food-card-header">
          <div>
            <strong>${escapeHtml(food.name)}</strong>
            <span>Cadastrado em ${escapeHtml(food.createdAt || 'data nao informada')}.</span>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-2">
            <span class="admin-food-chip">${escapeHtml(String(food.calories))} kcal</span>
            <button class="rounded-full bg-[#fff1f1] px-3 py-2 text-xs font-semibold text-[#a74242]" type="button" data-delete-food="${escapeHtml(food.id)}">Remover</button>
          </div>
        </div>
        <div class="admin-food-meters">
          <div class="admin-food-meter">
            <div class="admin-food-meter-header">
              <span>Proteina</span>
              <strong>${escapeHtml(String(food.protein))}g</strong>
            </div>
            <div class="mini-progress"><span style="width:${share.proteinWidth}%"></span></div>
          </div>
          <div class="admin-food-meter">
            <div class="admin-food-meter-header">
              <span>Carboidrato</span>
              <strong>${escapeHtml(String(food.carbs))}g</strong>
            </div>
            <div class="mini-progress"><span style="width:${share.carbsWidth}%"></span></div>
          </div>
          <div class="admin-food-meter">
            <div class="admin-food-meter-header">
              <span>Gordura</span>
              <strong>${escapeHtml(String(food.fat))}g</strong>
            </div>
            <div class="mini-progress"><span style="width:${share.fatWidth}%"></span></div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  foodsList.querySelectorAll('[data-delete-food]').forEach((button) => {
    button.addEventListener('click', async () => {
      const food = state.foods.find((candidate) => candidate.id === button.dataset.deleteFood);
      const confirmed = window.confirm(
        `Remover ${food?.name || 'este alimento'} do catalogo? Esta acao nao pode ser desfeita.`,
      );

      if (!confirmed) {
        return;
      }

      button.disabled = true;

      try {
        await apiRequest(`/api/admin/foods/${button.dataset.deleteFood}`, {
          method: 'DELETE',
        });
        await Promise.all([refreshFoods(), refreshSummary()]);
        hidePanelStatus();
        showToast('Alimento removido com sucesso.');
      } catch (error) {
        showPanelStatus(error.message, 'error');
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function refreshSummary({ showLoading = false } = {}) {
  if (showLoading) {
    setSummaryLoading();
  }

  const payload = await apiRequest('/api/admin/summary');
  state.summary = payload.summary || {};

  if (payload.admin) {
    state.currentUser = payload.admin;
    session.persistUser(payload.admin);
    setHeader(payload.admin);
  }

  renderSummary();
}

async function refreshUsers({ showLoading = false } = {}) {
  if (showLoading) {
    setUsersLoading(true);
  }

  try {
    const payload = await apiRequest('/api/admin/users');
    state.users = Array.isArray(payload.users) ? payload.users.map((user) => ({
      ...user,
      role: normalizeRole(user.role || user.profile),
    })) : [];
    renderUsers();
  } catch (error) {
    renderUsersError(error.message);
    throw error;
  } finally {
    state.isLoadingUsers = false;
  }
}

async function refreshFoods({ showLoading = false } = {}) {
  if (showLoading) {
    setFoodsLoading(true);
  }

  try {
    const payload = await apiRequest('/api/admin/foods');
    state.foods = Array.isArray(payload.foods) ? payload.foods : [];
    renderFoods();
  } catch (error) {
    renderFoodsError(error.message);
    throw error;
  } finally {
    state.isLoadingFoods = false;
  }
}

async function handleFoodSubmit(event) {
  event.preventDefault();

  if (state.isSavingFood) {
    return;
  }

  const name = document.getElementById('foodName').value.trim();
  let calories;
  let protein;
  let carbs;
  let fat;

  if (!name) {
    showToast('Informe o nome do alimento.');
    return;
  }

  try {
    calories = readRequiredNumber('foodCalories', 'as calorias');
    protein = readRequiredNumber('foodProtein', 'a proteina');
    carbs = readRequiredNumber('foodCarbs', 'os carboidratos');
    fat = readRequiredNumber('foodFat', 'as gorduras');
  } catch (error) {
    showToast(error.message);
    return;
  }

  state.isSavingFood = true;

  if (foodSubmitButton) {
    foodSubmitButton.disabled = true;
    foodSubmitButton.textContent = 'Salvando...';
  }

  try {
    await apiRequest('/api/admin/foods', {
      method: 'POST',
      body: JSON.stringify({ name, calories, protein, carbs, fat }),
    });
    foodForm.reset();
    await Promise.all([refreshFoods(), refreshSummary()]);
    hidePanelStatus();
    showToast('Alimento cadastrado com sucesso.');
  } catch (error) {
    showPanelStatus(error.message, 'error');
    showToast(error.message);
  } finally {
    state.isSavingFood = false;

    if (foodSubmitButton) {
      foodSubmitButton.disabled = false;
      foodSubmitButton.textContent = 'Cadastrar alimento';
    }
  }
}

function syncUserSearch(source) {
  const value = source === 'global'
    ? String(adminGlobalSearch?.value || '')
    : String(adminUserSearch?.value || '');

  if (source !== 'global' && adminGlobalSearch) {
    adminGlobalSearch.value = value;
  }

  if (source !== 'local' && adminUserSearch) {
    adminUserSearch.value = value;
  }

  renderUsers();
}

function bindEvents() {
  adminGlobalSearch?.addEventListener('input', () => syncUserSearch('global'));
  adminUserSearch?.addEventListener('input', () => syncUserSearch('local'));
  adminRoleFilter?.addEventListener('change', renderUsers);
  foodSearch?.addEventListener('input', renderFoods);
  foodForm?.addEventListener('submit', handleFoodSubmit);
  adminLogoutButton?.addEventListener('click', clearSessionAndRedirect);
}

function initStaticUi() {
  document.querySelectorAll('[data-sidebar-date]').forEach((element) => {
    element.textContent = formatSidebarDate();
  });

  if (state.currentUser) {
    setHeader(state.currentUser);
  }

  window.NutriFlowUi?.setupSectionNavigation({
    linkSelector: '.sidebar-link, .mobile-nav-pill',
  });
}

async function init() {
  if (!ensureAdminAccess()) {
    return;
  }

  initStaticUi();
  bindEvents();
  showPanelStatus('Carregando dados reais do backend administrativo...');

  const results = await Promise.allSettled([
    refreshSummary({ showLoading: true }),
    refreshUsers({ showLoading: true }),
    refreshFoods({ showLoading: true }),
  ]);

  const rejected = results.find((result) => result.status === 'rejected');

  if (rejected) {
    const message = rejected.reason?.message || 'Nao foi possivel carregar o painel admin.';
    showPanelStatus(message, 'error');
    showToast(message);
    return;
  }

  hidePanelStatus();
}

void init();
