(() => {
  'use strict';

  /* =========================================================
     CORE
  ========================================================== */

  const {
    createApiClient,
    createSessionManager,
    createToastController,
    escapeHtml,
    formatSidebarDate: formatCoreSidebarDate,
    getInitials,
  } = window.NutriFlowCore || {};

  if (!createApiClient || !createSessionManager) {
    console.error(
      '[NutriFlow Admin] dashboard-core.js não foi carregado corretamente.',
    );
    return;
  }

  /* =========================================================
     SESSION
  ========================================================== */

  const session = createSessionManager({
    redirectTo: 'index.html?auth=login',
  });

  /* =========================================================
     API
  ========================================================== */

  const api = createApiClient({
    getToken: () => session.getToken(),
  });

  /* =========================================================
     TOAST
  ========================================================== */

  const toast =
    typeof createToastController === 'function'
      ? createToastController({
          element: document.getElementById('adminToast'),
        })
      : null;

  function showToast(message, type = 'success') {
    if (toast && typeof toast.show === 'function') {
      toast.show(message, type);
      return;
    }

    const element = document.getElementById('adminToast');

    if (!element) {
      console.log(`[NutriFlow Admin] ${message}`);
      return;
    }

    element.textContent = message;
    element.classList.remove('hidden');

    window.clearTimeout(showToast.timeout);

    showToast.timeout = window.setTimeout(() => {
      element.classList.add('hidden');
    }, 3500);
  }

  /* =========================================================
     DOM HELPERS
  ========================================================== */

  const $ = (id) => document.getElementById(id);

  const adminGreeting = $('adminGreeting');
  const adminName = $('adminName');
  const adminEmail = $('adminEmail');
  const adminAvatar = $('adminAvatar');

  const adminGlobalSearch = $('adminGlobalSearch');
  const adminUserSearch = $('adminUserSearch');
  const adminRoleFilter = $('adminRoleFilter');

  const adminUsersList = $('adminUsersList');
  const adminEmptyUsers = $('adminEmptyUsers');

  const foodSearch = $('foodSearch');
  const foodsList = $('foodsList');

  const foodForm = $('foodForm');
  const foodName = $('foodName');
  const foodCalories = $('foodCalories');
  const foodProtein = $('foodProtein');
  const foodCarbs = $('foodCarbs');
  const foodFat = $('foodFat');
  const foodSubmitButton = $('foodSubmitButton');

  const adminLogoutButton = $('adminLogoutButton');
  const adminStatusMessage = $('adminStatusMessage');

  /* =========================================================
     PROFILE MODAL
  ========================================================== */

  const adminProfileButton = $('adminProfileButton');
  const adminProfileModal = $('adminProfileModal');
  const adminProfileForm = $('adminProfileForm');

  const adminProfileName = $('adminProfileName');
  const adminProfileEmail = $('adminProfileEmail');
  const adminProfilePhone = $('adminProfilePhone');

  const adminProfileStatus = $('adminProfileStatus');

  const adminProfileClose = $('adminProfileClose');
  const adminProfileCancel = $('adminProfileCancel');
  const adminProfileSubmit = $('adminProfileSubmit');

  /* =========================================================
     EDIT USER MODAL
  ========================================================== */

  const adminEditUserModal = $('adminEditUserModal');
  const adminEditUserForm = $('adminEditUserForm');

  const adminEditUserId = $('adminEditUserId');
  const adminEditUserName = $('adminEditUserName');
  const adminEditUserEmail = $('adminEditUserEmail');
  const adminEditUserPhone = $('adminEditUserPhone');

  const adminEditUserStatus = $('adminEditUserStatus');

  const adminEditUserClose = $('adminEditUserClose');
  const adminEditUserCancel = $('adminEditUserCancel');
  const adminEditUserSubmit = $('adminEditUserSubmit');

  /* =========================================================
     STATE
  ========================================================== */

const state = {
  currentUser: session.getUser(),

  summary: null,

  users: [],
  foods: [],

  isLoadingUsers: false,
  isLoadingFoods: false,

  isSavingFood: false,
  isSavingUser: false,
  isSavingProfile: false,
  isUpdatingUserStatus: false,
};

  /* =========================================================
     API REQUEST
  ========================================================== */

  async function apiRequest(url, options = {}) {
    const token = session.getToken();

    const headers = {
      ...(options.headers || {}),
    };

    if (!headers['Content-Type'] && options.body) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        `Erro na requisição (${response.status}).`;

      const error = new Error(message);

      error.status = response.status;
      error.payload = payload;

      throw error;
    }

    return payload;
  }

  /* =========================================================
     FORMATTERS
  ========================================================== */

  function formatNumber(value) {
    const number = Number(value || 0);

    return new Intl.NumberFormat('pt-BR').format(number);
  }

  function formatDecimal(value, digits = 1) {
    const number = Number(value || 0);

    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function formatDate(value) {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return date.toLocaleDateString('pt-BR');
  }

  function formatPercent(value) {
    return `${formatDecimal(value, 1)}%`;
  }

  function normalizeRole(role) {
    return String(role || '').trim().toUpperCase();
  }

  function roleLabel(role) {
    switch (normalizeRole(role)) {
      case 'PATIENT':
        return 'Paciente';

      case 'NUTRITIONIST':
        return 'Nutricionista';

      case 'ADMIN':
        return 'Administrador';

      default:
        return role || 'Usuário';
    }
  }

  /* =========================================================
     USER STATUS
  ========================================================== */

  function isUserActive(user) {
    if (!user) {
      return false;
    }

    if (
      user.active === false ||
      user.is_active === false ||
      user.isActive === false ||
      user.blocked === true ||
      user.is_blocked === true ||
      user.isBlocked === true
    ) {
      return false;
    }

    const status = String(
      user.status ||
      user.account_status ||
      user.accountStatus ||
      '',
    )
      .trim()
      .toLowerCase();

    if (
      status === 'blocked' ||
      status === 'bloqueado' ||
      status === 'inactive' ||
      status === 'inativo' ||
      status === 'disabled' ||
      status === 'desativado'
    ) {
      return false;
    }

    return true;
  }

  function getUserId(user) {
    return (
      user?.id ||
      user?.user_id ||
      user?.userId ||
      user?.uuid ||
      ''
    );
  }

  function getUserStatusLabel(user) {
    return isUserActive(user)
      ? 'Ativo'
      : 'Bloqueado';
  }

  /* =========================================================
     HEADER
  ========================================================== */

  function setHeader(user) {
    const current = user || {};

    const name =
      current.name ||
      current.full_name ||
      current.nome ||
      'Conta admin';

    const email =
      current.email ||
      current.mail ||
      '--';

    if (adminGreeting) {
      adminGreeting.textContent =
        `Olá, ${name.split(' ')[0]}`;
    }

    if (adminName) {
      adminName.textContent = name;
    }

    if (adminEmail) {
      adminEmail.textContent = email;
    }

    if (adminAvatar) {
      if (typeof getInitials === 'function') {
        adminAvatar.textContent = getInitials(name);
      } else {
        adminAvatar.textContent = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase();
      }
    }
  }

  /* =========================================================
     STATUS MESSAGE
  ========================================================== */

  function showStatus(message, type = 'info') {
    if (!adminStatusMessage) {
      return;
    }

    adminStatusMessage.textContent = message || '';

    adminStatusMessage.classList.remove(
      'hidden',
      'border-red-200',
      'bg-red-50',
      'text-red-700',
      'border-nutriflow-100',
      'bg-white/90',
      'text-nutriflow-700',
      'border-emerald-200',
      'bg-emerald-50',
      'text-emerald-700',
    );

    if (type === 'error') {
      adminStatusMessage.classList.add(
        'border-red-200',
        'bg-red-50',
        'text-red-700',
      );
    } else if (type === 'success') {
      adminStatusMessage.classList.add(
        'border-emerald-200',
        'bg-emerald-50',
        'text-emerald-700',
      );
    } else {
      adminStatusMessage.classList.add(
        'border-nutriflow-100',
        'bg-white/90',
        'text-nutriflow-700',
      );
    }
  }

  /* =========================================================
     PROFILE
  ========================================================== */

  function clearProfileStatus() {
    if (!adminProfileStatus) {
      return;
    }

    adminProfileStatus.textContent = '';
    adminProfileStatus.classList.add('hidden');
  }

  function showProfileError(message) {
    if (!adminProfileStatus) {
      return;
    }

    adminProfileStatus.textContent =
      message ||
      'Não foi possível atualizar seu perfil.';

    adminProfileStatus.classList.remove('hidden');
  }

  function openProfileModal() {
    if (!adminProfileModal) {
      return;
    }

    const user = state.currentUser || {};

    if (adminProfileName) {
      adminProfileName.value =
        user.name ||
        user.full_name ||
        user.nome ||
        '';
    }

    if (adminProfileEmail) {
      adminProfileEmail.value =
        user.email ||
        '';
    }

    if (adminProfilePhone) {
      adminProfilePhone.value =
        user.phone ||
        user.telefone ||
        '';
    }

    clearProfileStatus();

    adminProfileModal.classList.remove('hidden');
    adminProfileModal.classList.add('flex');

    document.body.classList.add('overflow-hidden');

    window.setTimeout(() => {
      adminProfileName?.focus();
    }, 50);
  }

  function closeProfileModal() {
    if (!adminProfileModal) {
      return;
    }

    adminProfileModal.classList.add('hidden');
    adminProfileModal.classList.remove('flex');

    document.body.classList.remove('overflow-hidden');

    clearProfileStatus();
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();

    if (state.isSavingProfile) {
      return;
    }

    const currentUser = state.currentUser || {};
    const userId = getUserId(currentUser);

    const name = String(
      adminProfileName?.value || '',
    ).trim();

    const email = String(
      adminProfileEmail?.value || '',
    ).trim();

    const phone = String(
      adminProfilePhone?.value || '',
    ).trim();

    clearProfileStatus();

    if (!name) {
      showProfileError('Informe seu nome completo.');
      adminProfileName?.focus();
      return;
    }

    if (!email) {
      showProfileError('Informe seu e-mail.');
      adminProfileEmail?.focus();
      return;
    }

    if (!userId) {
      showProfileError(
        'Não foi possível identificar a conta administrativa.',
      );
      return;
    }

    state.isSavingProfile = true;

    if (adminProfileSubmit) {
      adminProfileSubmit.disabled = true;
      adminProfileSubmit.textContent = 'Salvando...';
    }

    try {
      const payload = await apiRequest(
        `/api/admin/users/${encodeURIComponent(userId)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name,
            email,
            phone: phone || null,
          }),
        },
      );

      const returnedUser =
        payload?.user ||
        payload?.data ||
        null;

      const updatedUser = {
        ...currentUser,
        ...(returnedUser || {}),
        name,
        email,
        phone: phone || null,
      };

      state.currentUser = updatedUser;

      session.persistUser(updatedUser);

      setHeader(updatedUser);

      const index = state.users.findIndex(
        (user) =>
          String(getUserId(user)) ===
          String(userId),
      );

      if (index >= 0) {
        state.users[index] = {
          ...state.users[index],
          ...updatedUser,
        };

        renderUsers();
      }

      closeProfileModal();

      showToast(
        payload?.message ||
          'Perfil atualizado com sucesso.',
        'success',
      );

      showStatus(
        'Seus dados administrativos foram atualizados com sucesso.',
        'success',
      );

      await refreshSummary();

    } catch (error) {
      console.error(
        '[NutriFlow Admin] Erro ao atualizar perfil:',
        error,
      );

      showProfileError(
        error?.message ||
          'Não foi possível atualizar seu perfil.',
      );

      showToast(
        error?.message ||
          'Não foi possível atualizar seu perfil.',
        'error',
      );

    } finally {
      state.isSavingProfile = false;

      if (adminProfileSubmit) {
        adminProfileSubmit.disabled = false;
        adminProfileSubmit.textContent =
          'Salvar alterações';
      }
    }
  }

  /* =========================================================
     SUMMARY
  ========================================================== */

  async function refreshSummary() {
    try {
      const payload =
        await apiRequest('/api/admin/summary');

      state.summary =
        payload?.summary ||
        payload?.data ||
        payload ||
        {};

      if (payload?.admin) {
        state.currentUser =
          payload.admin;

        session.persistUser(
          payload.admin,
        );

        setHeader(payload.admin);
      }

      renderSummary(
        state.summary,
      );

    } catch (error) {
      console.error(
        '[NutriFlow Admin] Erro ao carregar resumo:',
        error,
      );

      showStatus(
        error?.message ||
          'Não foi possível carregar o resumo administrativo.',
        'error',
      );
    }
  }

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = value;
    }
  }

  function renderSummary(summary = {}) {
    const foodCatalogAvailable =
      summary.food_catalog_available !== false;
    const foodLogsAvailable =
      summary.food_logs_available !== false;
    const mealPlansAvailable =
      summary.meal_plans_available !== false;
    const totalUsers = Number(
      summary.total_users ??
      summary.totalUsers ??
      state.users.length ??
      0,
    );

    const totalPatients = Number(
      summary.total_patients ??
      summary.totalPatients ??
      state.users.filter(
        (user) =>
          normalizeRole(user.role) ===
          'PATIENT',
      ).length,
    );

    const totalNutritionists = Number(
      summary.total_nutritionists ??
      summary.totalNutritionists ??
      state.users.filter(
        (user) =>
          normalizeRole(user.role) ===
          'NUTRITIONIST',
      ).length,
    );

    const totalAdmins = Number(
      summary.total_admins ??
      summary.totalAdmins ??
      state.users.filter(
        (user) =>
          normalizeRole(user.role) ===
          'ADMIN',
      ).length,
    );

    const activeUsers = Number(
      summary.active_users ??
      summary.activeUsers ??
      state.users.filter(
        isUserActive,
      ).length,
    );

    const blockedUsers = Number(
      summary.blocked_users ??
      summary.blockedUsers ??
      state.users.filter(
        (user) => !isUserActive(user),
      ).length,
    );

    const totalFoods = foodCatalogAvailable
      ? Number(
          summary.total_foods ??
          summary.totalFoods ??
          state.foods.length ??
          0,
        )
      : null;

    setText(
      'summaryTotalUsers',
      formatNumber(totalUsers),
    );

    setText(
      'summaryTotalPatients',
      formatNumber(totalPatients),
    );

    setText(
      'summaryTotalNutritionists',
      formatNumber(totalNutritionists),
    );

    setText(
      'summaryTotalAdmins',
      formatNumber(totalAdmins),
    );

    setText(
      'summaryActiveUsers',
      formatNumber(activeUsers),
    );

    setText(
      'summaryBlockedUsers',
      formatNumber(blockedUsers),
    );

    setText(
      'summaryTotalFoods',
      totalFoods === null ? 'N/D' : formatNumber(totalFoods),
    );

    setText(
      'adminSidebarUsers',
      formatNumber(activeUsers),
    );

    setText(
      'adminSidebarBlocked',
      formatNumber(blockedUsers),
    );

    setText(
      'adminSidebarFoods',
      totalFoods === null ? 'N/D' : formatNumber(totalFoods),
    );

    const activationRate =
      totalUsers > 0
        ? (activeUsers / totalUsers) * 100
        : 0;

    const coverage =
      totalNutritionists > 0
        ? totalPatients / totalNutritionists
        : 0;

    setText(
      'adminWorkspaceActivationValue',
      formatPercent(activationRate),
    );

    setText(
      'adminWorkspaceActivationMeta',
      `${formatNumber(activeUsers)} de ${formatNumber(totalUsers)} contas ativas.`,
    );

    setText(
      'adminWorkspaceUsersValue',
      `${formatNumber(activeUsers)} contas`,
    );

    setText(
      'adminWorkspaceUsersMeta',
      `${formatPercent(activationRate)} da base está ativa.`,
    );

    setText(
      'adminWorkspaceFoodsValue',
      totalFoods === null ? 'N/D' : `${formatNumber(totalFoods)} itens`,
    );

    setText(
      'adminWorkspaceFoodsMeta',
      foodCatalogAvailable
        ? 'Itens disponíveis na base nutricional.'
        : 'O catálogo ainda não está conectado ao banco de dados.',
    );

    setText(
      'adminWorkspaceAlertsValue',
      `${formatNumber(blockedUsers)} pendências`,
    );

    setText(
      'adminWorkspaceAlertsMeta',
      blockedUsers > 0
        ? 'Existem contas bloqueadas para revisão.'
        : 'Nenhuma conta bloqueada identificada.',
    );

    setText(
      'adminOpsActivationRate',
      formatPercent(activationRate),
    );

    setText(
      'adminOpsActivationMeta',
      `${formatNumber(activeUsers)} contas ativas.`,
    );

    setText(
      'adminOpsCoverageValue',
      formatDecimal(coverage),
    );

    setText(
      'adminOpsCoverageMeta',
      'Pacientes por nutricionista.',
    );

    const foodLogsToday = foodLogsAvailable
      ? Number(summary.food_logs_today ?? summary.foodLogsToday ?? 0)
      : null;

    const mealPlans = mealPlansAvailable
      ? Number(summary.active_meal_plans ?? summary.activeMealPlans ?? 0)
      : null;

    setText(
      'adminOpsFoodLogsValue',
      foodLogsToday === null ? 'N/D' : formatNumber(foodLogsToday),
    );

    setText(
      'adminOpsFoodLogsMeta',
      foodLogsAvailable
        ? 'Movimento alimentar do dia.'
        : 'Registros alimentares ainda não estão disponíveis.',
    );

    setText(
      'adminOpsPlansValue',
      mealPlans === null ? 'N/D' : formatNumber(mealPlans),
    );

    setText(
      'adminOpsPlansMeta',
      mealPlansAvailable
        ? 'Planos ativos atualmente.'
        : 'Planos nutricionais ainda não estão disponíveis.',
    );

    setText(
      'adminMetricActivationRate',
      formatPercent(activationRate),
    );

    const blockedRate =
      totalUsers > 0
        ? (blockedUsers / totalUsers) * 100
        : 0;

    setText(
      'adminMetricBlockedRate',
      formatPercent(blockedRate),
    );

    setText(
      'adminMetricCareLoad',
      formatDecimal(coverage),
    );

    const catalogDensity = Math.min(
      (totalFoods / 1000) * 100,
      100,
    );

    setText(
      'adminMetricCatalogDensity',
      totalFoods === null ? 'N/D' : formatPercent(catalogDensity),
    );

    const adminCoverage =
      totalUsers > 0
        ? (totalAdmins / totalUsers) * 100
        : 0;

    setText(
      'adminMetricAdminCoverage',
      formatPercent(adminCoverage),
    );

    setText(
      'adminMetricFoodLogs',
      foodLogsToday === null ? 'N/D' : formatNumber(foodLogsToday),
    );

    setText(
      'adminMetricAdmins',
      formatNumber(totalAdmins),
    );

    setText(
      'adminMetricMealPlans',
      mealPlans === null ? 'N/D' : formatNumber(mealPlans),
    );

    setText(
      'adminMetricCareLoadAside',
      formatDecimal(coverage),
    );

    setText(
      'adminFoodBaseReadiness',
      totalFoods === null ? 'N/D' : formatPercent(catalogDensity),
    );

    const averageCalories = foodCatalogAvailable
      ? Number(
          summary.average_food_calories ??
          summary.averageFoodCalories ??
          calculateAverageCalories(),
        )
      : null;

    setText(
      'adminFoodAverageCalories',
      averageCalories === null ? 'N/D' : `${formatNumber(averageCalories)} kcal`,
    );

    setText(
      'adminFoodAverageCaloriesMeta',
      foodCatalogAvailable
        ? 'Média calórica dos itens cadastrados.'
        : 'O catálogo ainda não está conectado ao banco de dados.',
    );

    const macroDensity =
      calculateMacroDensity();

    setText(
      'adminFoodMacroDensity',
      foodCatalogAvailable ? `${formatDecimal(macroDensity)}g` : 'N/D',
    );

    setText(
      'adminFoodMacroDensityMeta',
      foodCatalogAvailable
        ? 'Proteína + carboidrato + gordura por item.'
        : 'O catálogo ainda não está conectado ao banco de dados.',
    );

    renderDistribution({
      totalUsers,
      totalPatients,
      totalNutritionists,
      totalAdmins,
    });

    renderAttention({
      totalUsers,
      activeUsers,
      blockedUsers,
      totalFoods,
      activationRate,
    });

    renderRecommendation({
      totalUsers,
      activeUsers,
      blockedUsers,
      totalFoods,
      totalPatients,
      totalNutritionists,
      totalAdmins,
      activationRate,
      blockedRate,
      coverage,
    });
  }

  /* =========================================================
     USERS
  ========================================================== */

  async function loadUsers() {
    if (state.isLoadingUsers) {
      return;
    }

    state.isLoadingUsers = true;

    try {
      const payload =
        await apiRequest('/api/admin/users');

      state.users =
        payload?.users ||
        payload?.data ||
        (Array.isArray(payload)
          ? payload
          : []);

      renderUsers();

    } catch (error) {
      console.error(
        '[NutriFlow Admin] Erro ao carregar usuários:',
        error,
      );

      state.users = [];

      renderUsers();

      showStatus(
        error?.message ||
          'Não foi possível carregar os usuários.',
        'error',
      );

    } finally {
      state.isLoadingUsers = false;
    }
  }

  function getUserSearchTerm() {
    const globalTerm =
      String(
        adminGlobalSearch?.value || '',
      ).trim();

    const localTerm =
      String(
        adminUserSearch?.value || '',
      ).trim();

    return (
      localTerm ||
      globalTerm ||
      ''
    ).toLowerCase();
  }

  function getFilteredUsers() {
    const searchTerm =
      getUserSearchTerm();

    const role =
      String(
        adminRoleFilter?.value || '',
      ).toUpperCase();

    return state.users.filter(
      (user) => {
        const userRole =
          normalizeRole(user.role);

        const searchableText = [
          user.name,
          user.full_name,
          user.nome,
          user.email,
          user.phone,
          user.telefone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const matchesSearch =
          !searchTerm ||
          searchableText.includes(
            searchTerm,
          );

        const matchesRole =
          !role ||
          userRole === role;

        return (
          matchesSearch &&
          matchesRole
        );
      },
    );
  }

  function syncUserSearch(source) {
    if (
      source === 'global' &&
      adminUserSearch
    ) {
      adminUserSearch.value =
        adminGlobalSearch?.value || '';
    }

    if (
      source === 'local' &&
      adminGlobalSearch
    ) {
      adminGlobalSearch.value =
        adminUserSearch?.value || '';
    }

    renderUsers();
  }

  function renderUsers() {
    if (!adminUsersList) {
      return;
    }

    const filteredUsers =
      getFilteredUsers();

    const activeCount =
      filteredUsers.filter(
        isUserActive,
      ).length;

    const blockedCount =
      filteredUsers.length -
      activeCount;

    setText(
      'adminFilteredUsersCount',
      formatNumber(
        filteredUsers.length,
      ),
    );

    setText(
      'adminFilteredActiveCount',
      formatNumber(activeCount),
    );

    setText(
      'adminFilteredBlockedCount',
      formatNumber(blockedCount),
    );

    adminUsersList.innerHTML = '';

    if (adminEmptyUsers) {
      adminEmptyUsers.classList.toggle(
        'hidden',
        filteredUsers.length > 0,
      );
    }

    filteredUsers.forEach(
      (user) => {
        adminUsersList.appendChild(
          createUserRow(user),
        );
      },
    );
  }

  /* =========================================================
     CREATE USER ROW
  ========================================================== */

async function toggleUserStatus(user) {
  if (state.isUpdatingUserStatus) {
    return;
  }

  const id = getUserId(user);

  if (!id) {
    showToast(
      'Não foi possível identificar o usuário.',
      'error',
    );
    return;
  }

  const active = isUserActive(user);

  const action = active ? 'bloquear' : 'reativar';

  const confirmed = window.confirm(
    active
      ? 'Deseja realmente bloquear este usuário?'
      : 'Deseja realmente reativar este usuário?',
  );

  if (!confirmed) {
    return;
  }

  state.isUpdatingUserStatus = true;

  try {
    /*
     * Endpoint esperado:
     * PATCH /api/admin/users/:id/status
     *
     * Envia:
     * {
     *   is_active: true/false
     * }
     */

    const payload = await apiRequest(
      `/api/admin/users/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          is_active: !active,
        }),
      },
    );

    const returnedUser =
      payload?.user ||
      payload?.data ||
      null;

    const index = state.users.findIndex(
      (item) =>
        String(getUserId(item)) === String(id),
    );

    if (index >= 0) {
      state.users[index] = {
        ...state.users[index],
        ...(returnedUser || {}),
        is_active: !active,
        active: !active,
        status: !active
          ? 'ACTIVE'
          : 'BLOCKED',
      };
    }

    renderUsers();

    await refreshSummary();

    showToast(
      payload?.message ||
        (
          active
            ? 'Usuário bloqueado com sucesso.'
            : 'Usuário reativado com sucesso.'
        ),
      'success',
    );

  } catch (error) {
    console.error(
      '[NutriFlow Admin] Erro ao alterar status do usuário:',
      error,
    );

    showToast(
      error?.message ||
        `Não foi possível ${action} o usuário.`,
      'error',
    );

  } finally {
    state.isUpdatingUserStatus = false;
  }
}
  
  function createUserRow(user) {
    const row =
      document.createElement('div');

    row.className =
      'grid gap-4 px-4 py-4 md:grid-cols-[1.25fr_.85fr_.55fr_.6fr_.95fr] md:items-center';

    const id = getUserId(user);

    const name =
      user.name ||
      user.full_name ||
      user.nome ||
      'Usuário sem nome';

    const email =
      user.email ||
      'Sem e-mail';

    const phone =
      user.phone ||
      user.telefone ||
      '';

    const role =
      normalizeRole(user.role);

    const active =
      isUserActive(user);

    const avatar =
      typeof getInitials === 'function'
        ? getInitials(name)
        : name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(
              (part) => part[0],
            )
            .join('')
            .toUpperCase();

    const statusLabel =
      getUserStatusLabel(user);

    const statusClass =
      active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-red-50 text-red-700 border-red-200';

    const actionClass =
      active
        ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
        : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50';

    const actionLabel =
      active
        ? 'Bloquear'
        : 'Reativar';

    row.innerHTML = `
      <div class="min-w-0">
        <div class="flex items-center gap-3">
          <div
            class="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-nutriflow-100 text-xs font-extrabold text-nutriflow-700"
          >
            ${escapeHtml(avatar)}
          </div>

          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-nutriflow-950">
              ${escapeHtml(name)}
            </p>

            <p class="truncate text-xs text-nutriflow-600">
              ${escapeHtml(email)}
            </p>

            ${
              phone
                ? `
                  <p class="truncate text-[11px] text-nutriflow-500">
                    ${escapeHtml(phone)}
                  </p>
                `
                : ''
            }
          </div>
        </div>
      </div>

      <div>
        <span
          class="inline-flex rounded-full border border-nutriflow-100 bg-nutriflow-50 px-3 py-1 text-xs font-bold text-nutriflow-700"
        >
          ${escapeHtml(
            roleLabel(role),
          )}
        </span>
      </div>

      <div>
        <span
          class="inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClass}"
        >
          ${statusLabel}
        </span>
      </div>

      <div class="text-sm text-nutriflow-600">
        ${escapeHtml(
          formatDate(
            user.created_at ||
            user.createdAt,
          ),
        )}
      </div>

      <div class="flex flex-wrap justify-start gap-2 md:justify-end">
  <button
    type="button"
    data-action="edit-user"
    data-user-id="${escapeHtml(String(id))}"
    class="rounded-xl border border-nutriflow-200 bg-white px-3 py-2 text-xs font-bold text-nutriflow-800 transition hover:bg-nutriflow-50"
  >
    Editar
  </button>

  <button
    type="button"
    data-action="toggle-user-status"
    data-user-id="${escapeHtml(String(id))}"
    class="rounded-xl border px-3 py-2 text-xs font-bold transition ${
      active
        ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    }"
  >
    ${active ? 'Bloquear' : 'Reativar'}
  </button>
</div>
    `;

    const editButton =
      row.querySelector(
        '[data-action="edit-user"]',
      );

    editButton?.addEventListener(
      'click',
      () => openEditUserModal(user),
    );

    const statusButton =
      row.querySelector(
        '[data-action="toggle-user-status"]',
      );

    statusButton?.addEventListener(
      'click',
      () => handleUserStatusToggle(
        user,
        statusButton,
      ),
    );

    return row;
  }

  /* =========================================================
     BLOCK / REACTIVATE USER
  ========================================================== */

  async function updateUserStatus(user, shouldActivate) {
    const id = getUserId(user);

    if (!id) {
      throw new Error(
        'Não foi possível identificar o usuário.',
      );
    }

    /*
     * Primeiro tenta o endpoint específico de status.
     * Caso o backend atual ainda não possua esse endpoint,
     * utiliza o endpoint PUT já existente no painel.
     */

    try {
      return await apiRequest(
        `/api/admin/users/${encodeURIComponent(id)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            isActive: shouldActivate,
          }),
        },
      );
    } catch (error) {
      /*
       * Só fazemos fallback para endpoints inexistentes
       * ou métodos não suportados.
       *
       * Erros de validação/autorização não são mascarados.
       */

      if (
        error?.status !== 404 &&
        error?.status !== 405
      ) {
        throw error;
      }
    }

    const currentName =
      user.name ||
      user.full_name ||
      user.nome ||
      '';

    const currentEmail =
      user.email ||
      '';

    const currentPhone =
      user.phone ||
      user.telefone ||
      '';

    return await apiRequest(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          name: currentName,
          email: currentEmail,
          phone: currentPhone || null,
          active: shouldActivate,
        }),
      },
    );
  }

  async function handleUserStatusToggle(
    user,
    button,
  ) {
    if (state.isUpdatingUserStatus) {
      return;
    }

    const id = getUserId(user);

    if (!id) {
      showToast(
        'Não foi possível identificar o usuário.',
        'error',
      );
      return;
    }

    const currentlyActive =
      isUserActive(user);

    const shouldActivate =
      !currentlyActive;

    const action =
      shouldActivate
        ? 'reativar'
        : 'bloquear';

    const confirmation =
      shouldActivate
        ? `Deseja reativar a conta de "${user.name || user.full_name || user.email || 'este usuário'}"?`
        : `Deseja bloquear a conta de "${user.name || user.full_name || user.email || 'este usuário'}"?`;

    if (!window.confirm(confirmation)) {
      return;
    }

    /*
     * Evita que o admin bloqueie a própria conta
     * acidentalmente.
     */

    const currentAdminId =
      getUserId(state.currentUser);

    if (
      String(currentAdminId) ===
        String(id) &&
      !shouldActivate
    ) {
      showToast(
        'A conta administrativa atualmente logada não pode ser bloqueada por este painel.',
        'error',
      );

      return;
    }

    state.isUpdatingUserStatus =
      true;

    if (button) {
      button.disabled = true;
      button.textContent =
        shouldActivate
          ? 'Reativando...'
          : 'Bloqueando...';

      button.classList.add(
        'cursor-not-allowed',
        'opacity-60',
      );
    }

    try {
      const payload =
        await updateUserStatus(
          user,
          shouldActivate,
        );

      /*
       * Atualiza imediatamente o objeto
       * local para que a interface reflita
       * o novo status mesmo antes do refresh.
       */

      const index =
        state.users.findIndex(
          (item) =>
            String(
              getUserId(item),
            ) === String(id),
        );

      const returnedUser =
        payload?.user ||
        payload?.data ||
        null;

      const localStatus = {
        active: shouldActivate,
        is_active: shouldActivate,
        blocked: !shouldActivate,
        is_blocked: !shouldActivate,
      };

      if (index >= 0) {
        state.users[index] = {
          ...state.users[index],
          ...(returnedUser || {}),
          ...localStatus,
        };
      }

      /*
       * Se for o usuário logado e a ação for reativação,
       * mantém a sessão sincronizada.
       */

      if (
        String(
          getUserId(state.currentUser),
        ) === String(id)
      ) {
        state.currentUser = {
          ...state.currentUser,
          ...(returnedUser || {}),
          ...localStatus,
        };

        session.persistUser(
          state.currentUser,
        );

        setHeader(
          state.currentUser,
        );
      }

      renderUsers();

      /*
       * Atualiza os indicadores do dashboard.
       */

      await refreshSummary();

      const successMessage =
        payload?.message ||
        (
          shouldActivate
            ? 'Usuário reativado com sucesso.'
            : 'Usuário bloqueado com sucesso.'
        );

      showToast(
        successMessage,
        'success',
      );

      showStatus(
        successMessage,
        'success',
      );

    } catch (error) {
      console.error(
        `[NutriFlow Admin] Erro ao ${action} usuário:`,
        error,
      );

      showToast(
        error?.message ||
          `Não foi possível ${action} o usuário.`,
        'error',
      );

      showStatus(
        error?.message ||
          `Não foi possível ${action} o usuário.`,
        'error',
      );

    } finally {
      state.isUpdatingUserStatus =
        false;

      /*
       * Como a linha pode ter sido
       * recriada pelo renderUsers(),
       * só restauramos o botão se ele
       * ainda estiver no DOM.
       */

      if (
        button &&
        document.body.contains(button)
      ) {
        button.disabled = false;
        button.textContent =
          isUserActive(user)
            ? 'Bloquear'
            : 'Reativar';

        button.classList.remove(
          'cursor-not-allowed',
          'opacity-60',
        );
      }
    }
  }

  /* =========================================================
     EDIT USER
  ========================================================== */

  function clearEditUserStatus() {
    if (!adminEditUserStatus) {
      return;
    }

    adminEditUserStatus.textContent = '';
    adminEditUserStatus.classList.add(
      'hidden',
    );
  }

  function showEditUserError(message) {
    if (!adminEditUserStatus) {
      return;
    }

    adminEditUserStatus.textContent =
      message ||
      'Não foi possível atualizar o usuário.';

    adminEditUserStatus.classList.remove(
      'hidden',
    );
  }

  function openEditUserModal(user) {
    if (!adminEditUserModal) {
      return;
    }

    const id = getUserId(user);

    if (adminEditUserId) {
      adminEditUserId.value = id;
    }

    if (adminEditUserName) {
      adminEditUserName.value =
        user.name ||
        user.full_name ||
        user.nome ||
        '';
    }

    if (adminEditUserEmail) {
      adminEditUserEmail.value =
        user.email ||
        '';
    }

    if (adminEditUserPhone) {
      adminEditUserPhone.value =
        user.phone ||
        user.telefone ||
        '';
    }

    clearEditUserStatus();

    adminEditUserModal.classList.remove(
      'hidden',
    );

    adminEditUserModal.classList.add(
      'flex',
    );

    document.body.classList.add(
      'overflow-hidden',
    );

    window.setTimeout(() => {
      adminEditUserName?.focus();
    }, 50);
  }

  function closeEditUserModal() {
    if (!adminEditUserModal) {
      return;
    }

    adminEditUserModal.classList.add(
      'hidden',
    );

    adminEditUserModal.classList.remove(
      'flex',
    );

    document.body.classList.remove(
      'overflow-hidden',
    );

    clearEditUserStatus();
  }

  async function handleEditUserSubmit(
    event,
  ) {
    event.preventDefault();

    if (state.isSavingUser) {
      return;
    }

    const id =
      adminEditUserId?.value ||
      '';

    const name =
      String(
        adminEditUserName?.value ||
          '',
      ).trim();

    const email =
      String(
        adminEditUserEmail?.value ||
          '',
      ).trim();

    const phone =
      String(
        adminEditUserPhone?.value ||
          '',
      ).trim();

    clearEditUserStatus();

    if (!id) {
      showEditUserError(
        'Não foi possível identificar o usuário.',
      );
      return;
    }

    if (!name) {
      showEditUserError(
        'Informe o nome do usuário.',
      );
      return;
    }

    if (!email) {
      showEditUserError(
        'Informe o e-mail do usuário.',
      );
      return;
    }

    state.isSavingUser = true;

    if (adminEditUserSubmit) {
      adminEditUserSubmit.disabled = true;
      adminEditUserSubmit.textContent =
        'Salvando...';
    }

    try {
      const payload =
        await apiRequest(
          `/api/admin/users/${encodeURIComponent(id)}`,
          {
            method: 'PUT',
            body: JSON.stringify({
              name,
              email,
              phone: phone || null,
            }),
          },
        );

      const returnedUser =
        payload?.user ||
        payload?.data ||
        {};

      const index =
        state.users.findIndex(
          (user) =>
            String(
              getUserId(user),
            ) === String(id),
        );

      if (index >= 0) {
        state.users[index] = {
          ...state.users[index],
          ...returnedUser,
          name,
          email,
          phone: phone || null,
        };
      }

      const currentAdminId =
        getUserId(
          state.currentUser,
        );

      if (
        String(currentAdminId) ===
        String(id)
      ) {
        state.currentUser = {
          ...state.currentUser,
          ...returnedUser,
          name,
          email,
          phone: phone || null,
        };

        session.persistUser(
          state.currentUser,
        );

        setHeader(
          state.currentUser,
        );
      }

      closeEditUserModal();

      renderUsers();

      await refreshSummary();

      showToast(
        payload?.message ||
          'Usuário atualizado com sucesso.',
        'success',
      );

    } catch (error) {
      console.error(
        '[NutriFlow Admin] Erro ao editar usuário:',
        error,
      );

      showEditUserError(
        error?.message ||
          'Não foi possível atualizar o usuário.',
      );

      showToast(
        error?.message ||
          'Não foi possível atualizar o usuário.',
        'error',
      );

    } finally {
      state.isSavingUser = false;

      if (adminEditUserSubmit) {
        adminEditUserSubmit.disabled = false;

        adminEditUserSubmit.textContent =
          'Salvar alterações';
      }
    }
  }

  /* =========================================================
     FOODS
  ========================================================== */

  async function loadFoods() {
    if (state.isLoadingFoods) {
      return;
    }

    state.isLoadingFoods = true;

    try {
      const payload =
        await apiRequest(
          '/api/admin/foods',
        );

      state.foods =
        payload?.foods ||
        payload?.data ||
        (
          Array.isArray(payload)
            ? payload
            : []
        );

      renderFoods();
      renderFoodMetrics();

    } catch (error) {
      console.error(
        '[NutriFlow Admin] Erro ao carregar alimentos:',
        error,
      );

      state.foods = [];

      renderFoods();
      renderFoodMetrics();

      showStatus(
        error?.message ||
          'Não foi possível carregar os alimentos.',
        'error',
      );

    } finally {
      state.isLoadingFoods = false;
    }
  }

  function getFilteredFoods() {
    const term =
      String(
        foodSearch?.value || '',
      )
        .trim()
        .toLowerCase();

    if (!term) {
      return state.foods;
    }

    return state.foods.filter(
      (food) =>
        String(
          food.name ||
          food.nome ||
          '',
        )
          .toLowerCase()
          .includes(term),
    );
  }

  function renderFoods() {
    if (!foodsList) {
      return;
    }

    const foods =
      getFilteredFoods();

    foodsList.innerHTML = '';

    const catalogAvailable =
      state.summary?.food_catalog_available !== false;

    setText(
      'adminFilteredFoodsCount',
      catalogAvailable ? formatNumber(foods.length) : 'N/D',
    );

    setText(
      'adminFilteredFoodsMeta',
      !catalogAvailable
        ? 'O catálogo de alimentos ainda não está conectado ao banco de dados.'
        : foodSearch?.value
          ? `Resultados para "${foodSearch.value}".`
          : 'Refine por nome para revisar o catálogo.',
    );

    if (!catalogAvailable) {
      const message = document.createElement('p');
      message.className = 'p-4 text-sm text-nutriflow-600';
      message.textContent = 'Não há uma fonte de dados de alimentos configurada.';
      foodsList.appendChild(message);
      return;
    }

    foods.forEach(
      (food) => {
        foodsList.appendChild(
          createFoodCard(food),
        );
      },
    );
  }

  function createFoodCard(food) {
    const element =
      document.createElement(
        'article',
      );

    const name =
      food.name ||
      food.nome ||
      'Alimento';

    const calories =
      Number(
        food.calories ??
        food.calorias ??
        0,
      );

    const protein =
      Number(
        food.protein ??
        food.proteina ??
        0,
      );

    const carbs =
      Number(
        food.carbs ??
        food.carbohydrates ??
        food.carboidratos ??
        0,
      );

    const fat =
      Number(
        food.fat ??
        food.gordura ??
        0,
      );

    element.className =
      'rounded-[22px] border border-nutriflow-100 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(28,38,24,.06)]';

    element.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="truncate text-sm font-bold text-nutriflow-950">
            ${escapeHtml(name)}
          </h3>

          <p class="mt-1 text-xs text-nutriflow-500">
            ${formatNumber(calories)} kcal
          </p>
        </div>

        <span
          class="shrink-0 rounded-full bg-nutriflow-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-nutriflow-600"
        >
          Base
        </span>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div class="rounded-xl bg-nutriflow-50 p-2">
          <span class="block text-[10px] font-bold uppercase text-nutriflow-500">
            Prot.
          </span>

          <strong class="mt-1 block text-sm text-nutriflow-900">
            ${formatDecimal(protein)}g
          </strong>
        </div>

        <div class="rounded-xl bg-nutriflow-50 p-2">
          <span class="block text-[10px] font-bold uppercase text-nutriflow-500">
            Carb.
          </span>

          <strong class="mt-1 block text-sm text-nutriflow-900">
            ${formatDecimal(carbs)}g
          </strong>
        </div>

        <div class="rounded-xl bg-nutriflow-50 p-2">
          <span class="block text-[10px] font-bold uppercase text-nutriflow-500">
            Gord.
          </span>

          <strong class="mt-1 block text-sm text-nutriflow-900">
            ${formatDecimal(fat)}g
          </strong>
        </div>
      </div>
    `;

    return element;
  }

  async function handleFoodSubmit(event) {
    event.preventDefault();

    if (state.isSavingFood) {
      return;
    }

    const name =
      String(
        foodName?.value || '',
      ).trim();

    const calories =
      Number(
        foodCalories?.value || 0,
      );

    const protein =
      Number(
        foodProtein?.value || 0,
      );

    const carbs =
      Number(
        foodCarbs?.value || 0,
      );

    const fat =
      Number(
        foodFat?.value || 0,
      );

    if (!name) {
      showToast(
        'Informe o nome do alimento.',
        'error',
      );
      return;
    }

    state.isSavingFood = true;

    if (foodSubmitButton) {
      foodSubmitButton.disabled = true;
      foodSubmitButton.textContent =
        'Cadastrando...';
    }

    try {
      const payload =
        await apiRequest(
          '/api/admin/foods',
          {
            method: 'POST',
            body: JSON.stringify({
              name,
              calories,
              protein,
              carbs,
              fat,
            }),
          },
        );

      const newFood =
        payload?.food ||
        payload?.data ||
        null;

      if (newFood) {
        state.foods.unshift(
          newFood,
        );
      }

      foodForm?.reset();

      renderFoods();
      renderFoodMetrics();

      await refreshSummary();

      showToast(
        payload?.message ||
          'Alimento cadastrado com sucesso.',
        'success',
      );

    } catch (error) {
      console.error(
        '[NutriFlow Admin] Erro ao cadastrar alimento:',
        error,
      );

      showToast(
        error?.message ||
          'Não foi possível cadastrar o alimento.',
        'error',
      );

    } finally {
      state.isSavingFood = false;

      if (foodSubmitButton) {
        foodSubmitButton.disabled = false;
        foodSubmitButton.textContent =
          'Cadastrar alimento';
      }
    }
  }

  function calculateAverageCalories() {
    if (!state.foods.length) {
      return 0;
    }

    const total =
      state.foods.reduce(
        (sum, food) =>
          sum +
          Number(
            food.calories ??
            food.calorias ??
            0,
          ),
        0,
      );

    return (
      total /
      state.foods.length
    );
  }

  function calculateMacroDensity() {
    if (!state.foods.length) {
      return 0;
    }

    const total =
      state.foods.reduce(
        (sum, food) =>
          sum +
          Number(
            food.protein ??
            food.proteina ??
            0,
          ) +
          Number(
            food.carbs ??
            food.carbohydrates ??
            food.carboidratos ??
            0,
          ) +
          Number(
            food.fat ??
            food.gordura ??
            0,
          ),
        0,
      );

    return (
      total /
      state.foods.length
    );
  }

  function renderFoodMetrics() {
    if (state.summary?.food_catalog_available === false) {
      setText('adminFoodBaseReadiness', 'N/D');
      setText('adminFoodBaseReadinessMeta', 'O catálogo ainda não está conectado ao banco de dados.');
      setText('adminFoodAverageCalories', 'N/D');
      setText('adminFoodAverageCaloriesMeta', 'O catálogo ainda não está conectado ao banco de dados.');
      setText('adminFoodMacroDensity', 'N/D');
      setText('adminFoodMacroDensityMeta', 'O catálogo ainda não está conectado ao banco de dados.');
      return;
    }

    const averageCalories =
      calculateAverageCalories();

    const macroDensity =
      calculateMacroDensity();

    const readiness =
      Math.min(
        (state.foods.length / 1000) *
          100,
        100,
      );

    setText(
      'adminFoodBaseReadiness',
      formatPercent(
        readiness,
      ),
    );

    setText(
      'adminFoodBaseReadinessMeta',
      `${formatNumber(state.foods.length)} itens cadastrados.`,
    );

    setText(
      'adminFoodAverageCalories',
      `${formatNumber(averageCalories)} kcal`,
    );

    setText(
      'adminFoodAverageCaloriesMeta',
      'Média calórica dos itens cadastrados.',
    );

    setText(
      'adminFoodMacroDensity',
      `${formatDecimal(macroDensity)}g`,
    );

    setText(
      'adminFoodMacroDensityMeta',
      'Proteína + carboidrato + gordura por item.',
    );
  }

  /* =========================================================
     DISTRIBUTION
  ========================================================== */

  function renderDistribution(data) {
    const container =
      $('adminDistributionList');

    if (!container) {
      return;
    }

    const {
      totalUsers,
      totalPatients,
      totalNutritionists,
      totalAdmins,
    } = data;

    const roles = [
      {
        label: 'Pacientes',
        value: totalPatients,
        color: 'bg-nutriflow-500',
      },
      {
        label: 'Nutricionistas',
        value: totalNutritionists,
        color: 'bg-nutriflow-700',
      },
      {
        label: 'Administradores',
        value: totalAdmins,
        color: 'bg-nutriflow-900',
      },
    ];

    container.innerHTML = '';

    roles.forEach(
      (item) => {
        const percentage =
          totalUsers > 0
            ? (
                item.value /
                totalUsers
              ) * 100
            : 0;

        const element =
          document.createElement(
            'div',
          );

        element.innerHTML = `
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <span
                class="h-2.5 w-2.5 rounded-full ${item.color}"
              ></span>

              <span class="text-sm font-semibold text-nutriflow-800">
                ${escapeHtml(item.label)}
              </span>
            </div>

            <strong class="text-sm text-nutriflow-950">
              ${formatNumber(item.value)}
            </strong>
          </div>

          <div class="mt-2 h-2 overflow-hidden rounded-full bg-nutriflow-100">
            <div
              class="${item.color} h-full rounded-full"
              style="width:${Math.min(
                percentage,
                100,
              )}%"
            ></div>
          </div>

          <p class="mt-1 text-[11px] text-nutriflow-500">
            ${formatPercent(
              percentage,
            )} da base
          </p>
        `;

        container.appendChild(
          element,
        );
      },
    );
  }

  /* =========================================================
     ATTENTION
  ========================================================== */

  function renderAttention(data) {
    const container =
      $('adminAttentionList');

    if (!container) {
      return;
    }

    const {
      blockedUsers,
      activationRate,
      totalFoods,
    } = data;

    const alerts = [];

    if (blockedUsers > 0) {
      alerts.push({
        title:
          `${formatNumber(blockedUsers)} contas bloqueadas`,
        body:
          'Existem contas fora de operação que podem exigir revisão.',
      });
    }

    if (totalUsers > 0 && activationRate < 70) {
      alerts.push({
        title:
          'Ativação abaixo de 70%',
        body:
          'A taxa de contas ativas merece acompanhamento.',
      });
    }

    if (totalFoods !== null && totalFoods < 100) {
      alerts.push({
        title:
          'Catálogo ainda enxuto',
        body:
          'A base nutricional possui menos de 100 itens.',
      });
    }

    if (!alerts.length) {
      alerts.push({
        title:
          'Operação sem alertas críticos',
        body:
          'Nenhum sinal operacional relevante foi identificado pelos indicadores disponíveis.',
      });
    }

    container.innerHTML = '';

    alerts.forEach(
      (alert) => {
        const element =
          document.createElement(
            'div',
          );

        element.className =
          'rounded-2xl border border-nutriflow-100 bg-nutriflow-50 p-4';

        element.innerHTML = `
          <p class="text-sm font-bold text-nutriflow-950">
            ${escapeHtml(
              alert.title,
            )}
          </p>

          <p class="mt-1 text-xs leading-5 text-nutriflow-600">
            ${escapeHtml(
              alert.body,
            )}
          </p>
        `;

        container.appendChild(
          element,
        );
      },
    );
  }

  /* =========================================================
     RECOMMENDATION
  ========================================================== */

  function renderRecommendation(data) {
    const {
      blockedUsers,
      activationRate,
      totalFoods,
      coverage,
    } = data;

    let title =
      'Acompanhe a operação';

    let body =
      'Os indicadores atuais devem ser observados continuamente para identificar mudanças na saúde da plataforma.';

    if (blockedUsers > 0) {
      title =
        'Revisar contas bloqueadas';

      body =
        `Existem ${formatNumber(blockedUsers)} contas bloqueadas. O painel pode ser usado para revisar esses registros e manter a base organizada.`;
    } else if (
      totalUsers > 0 && activationRate < 70
    ) {
      title =
        'Acompanhar ativação';

      body =
        `A taxa atual de ativação é ${formatPercent(activationRate)}. Vale acompanhar a evolução das contas ativas ao longo do tempo.`;
    } else if (
      totalFoods !== null && totalFoods < 100
    ) {
      title =
        'Expandir a base nutricional';

      body =
        `O catálogo possui ${formatNumber(totalFoods)} itens. A expansão da base pode ampliar a cobertura dos fluxos nutricionais.`;
    } else {
      title =
        totalFoods === null
          ? 'Resumo de usuários atualizado'
          : 'Operação dentro dos indicadores atuais';

      body =
        totalFoods === null
          ? `A base possui ${formatNumber(data.totalUsers)} usuários e ${formatNumber(data.totalPatients)} pacientes. Os indicadores de alimentos, registros e planos não estão conectados ao banco de dados.`
          : `A base possui ${formatNumber(totalFoods)} alimentos e uma carga média de ${formatDecimal(coverage)} pacientes por nutricionista. Continue acompanhando a evolução dos indicadores.`;
    }

    setText(
      'adminRecommendationTitle',
      title,
    );

    setText(
      'adminRecommendationBody',
      body,
    );

    setText(
      'adminMetricExecutivePulse',
      blockedUsers > 0
        ? 'Atenção'
        : 'Estável',
    );
  }

  /* =========================================================
     LOGOUT
  ========================================================== */

  function clearSessionAndRedirect() {
    try {
      session.clear();
    } catch (error) {
      console.warn(
        '[NutriFlow Admin] Não foi possível limpar a sessão pelo manager:',
        error,
      );

      localStorage.removeItem(
        'nutriflow_user',
      );

      localStorage.removeItem(
        'nutriflow_token',
      );

      sessionStorage.removeItem(
        'nutriflow_user',
      );

      sessionStorage.removeItem(
        'nutriflow_token',
      );
    }

    window.location.href =
      'index.html?auth=login';
  }

  /* =========================================================
     SIDEBAR DATE
  ========================================================== */

  function renderSidebarDate() {
    const element =
      document.querySelector(
        '[data-sidebar-date]',
      );

    if (!element) {
      return;
    }

    if (
      typeof formatCoreSidebarDate ===
      'function'
    ) {
      element.textContent =
        formatCoreSidebarDate(
          new Date(),
        );

      return;
    }

    element.textContent =
      new Date().toLocaleDateString(
        'pt-BR',
        {
          day: '2-digit',
          month: 'short',
        },
      );
  }

  /* =========================================================
     NAVIGATION
  ========================================================== */

  function bindNavigation() {
    const links =
      document.querySelectorAll(
        '.sidebar-link, .mobile-nav-pill',
      );

    links.forEach(
      (link) => {
        link.addEventListener(
          'click',
          () => {
            document
              .querySelectorAll(
                '.sidebar-link.is-active, .mobile-nav-pill.is-active',
              )
              .forEach(
                (item) => {
                  item.classList.remove(
                    'is-active',
                  );
                },
              );

            link.classList.add(
              'is-active',
            );
          },
        );
      },
    );
  }

  /* =========================================================
     EVENTS
  ========================================================== */

  function bindEvents() {
    /*
     * Busca global
     */

    adminGlobalSearch?.addEventListener(
      'input',
      () =>
        syncUserSearch(
          'global',
        ),
    );

    /*
     * Busca local
     */

    adminUserSearch?.addEventListener(
      'input',
      () =>
        syncUserSearch(
          'local',
        ),
    );

    /*
     * Filtro de papel
     */

    adminRoleFilter?.addEventListener(
      'change',
      renderUsers,
    );

    /*
     * Busca de alimentos
     */

    foodSearch?.addEventListener(
      'input',
      renderFoods,
    );

    /*
     * Formulário de alimento
     */

    foodForm?.addEventListener(
      'submit',
      handleFoodSubmit,
    );

    /*
     * Logout
     */

    adminLogoutButton?.addEventListener(
      'click',
      clearSessionAndRedirect,
    );

    /* =======================================================
       MEU PERFIL
    ======================================================== */

    adminProfileButton?.addEventListener(
      'click',
      openProfileModal,
    );

    adminProfileForm?.addEventListener(
      'submit',
      handleProfileSubmit,
    );

    adminProfileClose?.addEventListener(
      'click',
      closeProfileModal,
    );

    adminProfileCancel?.addEventListener(
      'click',
      closeProfileModal,
    );

    adminProfileModal?.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          adminProfileModal
        ) {
          closeProfileModal();
        }
      },
    );

    /* =======================================================
       EDITAR USUÁRIO
    ======================================================== */

    adminEditUserForm?.addEventListener(
      'submit',
      handleEditUserSubmit,
    );

    adminEditUserClose?.addEventListener(
      'click',
      closeEditUserModal,
    );

    adminEditUserCancel?.addEventListener(
      'click',
      closeEditUserModal,
    );

    adminEditUserModal?.addEventListener(
      'click',
      (event) => {
        if (
          event.target ===
          adminEditUserModal
        ) {
          closeEditUserModal();
        }
      },
    );

    /* =======================================================
       ESC
    ======================================================== */

    document.addEventListener(
      'keydown',
      (event) => {
        if (
          event.key !==
          'Escape'
        ) {
          return;
        }

        if (
          adminProfileModal &&
          !adminProfileModal.classList.contains(
            'hidden',
          )
        ) {
          closeProfileModal();
          return;
        }

        if (
          adminEditUserModal &&
          !adminEditUserModal.classList.contains(
            'hidden',
          )
        ) {
          closeEditUserModal();
        }
      },
    );
  }

  /* =========================================================
     INITIAL LOAD
  ========================================================== */

  async function initialize() {
    const currentUser =
      state.currentUser;

    /*
     * Proteção básica da página.
     */

    if (!currentUser) {
      window.location.href =
        'index.html?auth=login';

      return;
    }

    setHeader(
      currentUser,
    );

    renderSidebarDate();

    bindEvents();

    bindNavigation();

    /*
     * Carrega os dados independentemente.
     */

    await Promise.allSettled([
      refreshSummary(),
      loadUsers(),
      loadFoods(),
    ]);

    /*
     * Recalcula os indicadores derivados.
     */

    renderUsers();
    renderFoods();
    renderFoodMetrics();
  }

  /* =========================================================
     START
  ========================================================== */

  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {
        once: true,
      },
    );
  } else {
    initialize();
  }

})();