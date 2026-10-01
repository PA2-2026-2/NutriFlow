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

const apiRequest = createApiClient({
  baseUrl: '',
  getToken: () => session.getToken(),
});

const toast = createToastController({
  element: document.getElementById('adminToast'),
});

function showToast(message) {
  if (!message) {
    return;
  }

  toast?.show(message);
}


const state = {
  currentUser: session.getUser(),

  summary: null,

  users: [],

  foods: [],

  isSavingFood: false,

  isLoadingUsers: false,

  isLoadingFoods: false,

  isSavingUser: false,

  isSavingProfile: false,
};

const adminGreeting =
  document.getElementById('adminGreeting');

const adminName =
  document.getElementById('adminName');

const adminEmail =
  document.getElementById('adminEmail');

const adminAvatar =
  document.getElementById('adminAvatar');

const adminProfileButton =
  document.getElementById('adminProfileButton');

const adminLogoutButton =
  document.getElementById('adminLogoutButton');

const adminGlobalSearch =
  document.getElementById('adminGlobalSearch');


const adminProfileModal =
  document.getElementById('adminProfileModal');

const adminProfileForm =
  document.getElementById('adminProfileForm');

const adminProfileName =
  document.getElementById('adminProfileName');

const adminProfileEmail =
  document.getElementById('adminProfileEmail');

const adminProfilePhone =
  document.getElementById('adminProfilePhone');

const adminProfileClose =
  document.getElementById('adminProfileClose');

const adminProfileCancel =
  document.getElementById('adminProfileCancel');

const adminProfileSubmit =
  document.getElementById('adminProfileSubmit');

const adminProfileStatus =
  document.getElementById('adminProfileStatus');


const adminUserSearch =
  document.getElementById('adminUserSearch');

const adminRoleFilter =
  document.getElementById('adminRoleFilter');

const adminUsersList =
  document.getElementById('adminUsersList');

const adminEmptyUsers =
  document.getElementById('adminEmptyUsers');

const adminFilteredUsersCount =
  document.getElementById('adminFilteredUsersCount');

const adminFilteredActiveCount =
  document.getElementById('adminFilteredActiveCount');

const adminFilteredBlockedCount =
  document.getElementById('adminFilteredBlockedCount');

const adminEditUserModal =
  document.getElementById('adminEditUserModal');

const adminEditUserForm =
  document.getElementById('adminEditUserForm');

const adminEditUserId =
  document.getElementById('adminEditUserId');

const adminEditUserName =
  document.getElementById('adminEditUserName');

const adminEditUserEmail =
  document.getElementById('adminEditUserEmail');

const adminEditUserPhone =
  document.getElementById('adminEditUserPhone');

const adminEditUserClose =
  document.getElementById('adminEditUserClose');

const adminEditUserCancel =
  document.getElementById('adminEditUserCancel');

const adminEditUserSubmit =
  document.getElementById('adminEditUserSubmit');

const adminEditUserStatus =
  document.getElementById('adminEditUserStatus');



const foodForm =
  document.getElementById('foodForm');

const foodName =
  document.getElementById('foodName');

const foodCalories =
  document.getElementById('foodCalories');

const foodProtein =
  document.getElementById('foodProtein');

const foodCarbs =
  document.getElementById('foodCarbs');

const foodFat =
  document.getElementById('foodFat');

const foodSubmitButton =
  document.getElementById('foodSubmitButton');

const foodSearch =
  document.getElementById('foodSearch');

const foodsList =
  document.getElementById('foodsList');

const adminFilteredFoodsCount =
  document.getElementById('adminFilteredFoodsCount');

const adminFilteredFoodsMeta =
  document.getElementById('adminFilteredFoodsMeta');


const adminSidebarUsers =
  document.getElementById('adminSidebarUsers');

const adminSidebarBlocked =
  document.getElementById('adminSidebarBlocked');

const adminSidebarFoods =
  document.getElementById('adminSidebarFoods');



function formatNumber(value) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('pt-BR').format(number);
}


function formatDecimal(value, digits = 1) {
  const number = Number(value || 0);

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}


function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toUpperCase();
}


function roleLabel(role) {
  const normalized = normalizeRole(role);

  const labels = {
    PATIENT: 'Paciente',
    NUTRITIONIST: 'Nutricionista',
    ADMIN: 'Administrador',
  };

  return labels[normalized] || role || 'Usuario';
}


function isUserActive(user) {
  if (!user) {
    return false;
  }

  if (
    user.is_active === false ||
    user.active === false ||
    user.blocked === true ||
    user.is_blocked === true
  ) {
    return false;
  }

  if (
    String(user.status || '').toLowerCase() === 'blocked' ||
    String(user.status || '').toLowerCase() === 'bloqueado' ||
    String(user.status || '').toLowerCase() === 'inactive' ||
    String(user.status || '').toLowerCase() === 'inativo'
  ) {
    return false;
  }

  return true;
}


function formatDate(value) {
  if (!value) {
    return '--';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}


function formatSidebarDate(value = new Date()) {
  try {
    return formatCoreSidebarDate
      ? formatCoreSidebarDate(value)
      : new Intl.DateTimeFormat('pt-BR', {
          day: '2-digit',
          month: 'short',
        }).format(value);
  } catch {
    return '--';
  }
}

function setHeader(admin) {
  if (!admin) {
    return;
  }

  const name =
    admin.name ||
    admin.full_name ||
    'Administrador';

  const email =
    admin.email ||
    '--';

  if (adminGreeting) {
    const firstName =
      String(name).trim().split(/\s+/)[0] ||
      'Administrador';

    adminGreeting.textContent =
      `Olá, ${firstName}!`;
  }

  if (adminName) {
    adminName.textContent = name;
  }

  if (adminEmail) {
    adminEmail.textContent = email;
  }

  if (adminAvatar) {
    adminAvatar.textContent =
      getInitials
        ? getInitials(name)
        : String(name)
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join('')
            .toUpperCase();
  }
}


function openAdminProfileModal() {
  if (!adminProfileModal) {
    return;
  }

  const admin = state.currentUser || {};

  if (adminProfileName) {
    adminProfileName.value =
      admin.name ||
      admin.full_name ||
      '';
  }

  if (adminProfileEmail) {
    adminProfileEmail.value =
      admin.email ||
      '';
  }

  if (adminProfilePhone) {
    adminProfilePhone.value =
      admin.phone ||
      '';
  }

  if (adminProfileStatus) {
    adminProfileStatus.textContent = '';

    adminProfileStatus.classList.add(
      'hidden',
    );
  }

  adminProfileModal.classList.remove(
    'hidden',
  );

  adminProfileModal.classList.add(
    'flex',
  );

  window.setTimeout(() => {
    adminProfileName?.focus();
  }, 50);
}


function closeAdminProfileModal() {
  if (!adminProfileModal) {
    return;
  }

  adminProfileModal.classList.add(
    'hidden',
  );

  adminProfileModal.classList.remove(
    'flex',
  );

  if (adminProfileStatus) {
    adminProfileStatus.textContent = '';

    adminProfileStatus.classList.add(
      'hidden',
    );
  }
}


function showAdminProfileError(message) {
  if (!adminProfileStatus) {
    return;
  }

  adminProfileStatus.textContent =
    message ||
    'Não foi possível atualizar seu perfil.';

  adminProfileStatus.classList.remove(
    'hidden',
  );
}


async function handleAdminProfileSubmit(event) {
  event.preventDefault();

  if (state.isSavingProfile) {
    return;
  }

  const currentAdmin =
    state.currentUser || {};

  const name =
    String(
      adminProfileName?.value || '',
    ).trim();

  const email =
    String(
      adminProfileEmail?.value || '',
    ).trim();

  const phone =
    String(
      adminProfilePhone?.value || '',
    ).trim();


  if (!name) {
    showAdminProfileError(
      'Informe seu nome.',
    );

    adminProfileName?.focus();

    return;
  }


  if (!email) {
    showAdminProfileError(
      'Informe seu e-mail.',
    );

    adminProfileEmail?.focus();

    return;
  }


  if (!currentAdmin.id) {
    showAdminProfileError(
      'Não foi possível identificar a conta administrativa.',
    );

    return;
  }


  state.isSavingProfile = true;


  if (adminProfileSubmit) {
    adminProfileSubmit.disabled = true;

    adminProfileSubmit.textContent =
      'Salvando...';
  }


  if (adminProfileStatus) {
    adminProfileStatus.textContent = '';

    adminProfileStatus.classList.add(
      'hidden',
    );
  }


  try {
    const result = await apiRequest(
      `/api/admin/users/${encodeURIComponent(
        currentAdmin.id,
      )}`,
      {
        method: 'PUT',

        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
        }),
      },
    );


    const updatedAdmin = {
      ...currentAdmin,

      ...(result?.user || {}),

      id:
        result?.user?.id ||
        currentAdmin.id,

      name,

      email,

      phone:
        phone || null,

      role: 'ADMIN',

      profile: 'Administrador',
    };


    state.currentUser =
      updatedAdmin;


    session.persistUser(
      updatedAdmin,
    );


    setHeader(
      updatedAdmin,
    );


    closeAdminProfileModal();


    showToast(
      result?.message ||
        'Perfil atualizado com sucesso.',
    );

  } catch (error) {

    const message =
      error?.message ||
      'Não foi possível atualizar seu perfil.';

    showAdminProfileError(
      message,
    );

    showToast(
      message,
    );

  } finally {

    state.isSavingProfile = false;


    if (adminProfileSubmit) {
      adminProfileSubmit.disabled =
        false;

      adminProfileSubmit.textContent =
        'Salvar alterações';
    }
  }
}


function openEditUserModal(user) {
  if (!adminEditUserModal || !user) {
    return;
  }

  if (adminEditUserId) {
    adminEditUserId.value =
      user.id || '';
  }

  if (adminEditUserName) {
    adminEditUserName.value =
      user.name ||
      user.full_name ||
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
      '';
  }

  if (adminEditUserStatus) {
    adminEditUserStatus.textContent = '';

    adminEditUserStatus.classList.add(
      'hidden',
    );
  }

  adminEditUserModal.classList.remove(
    'hidden',
  );

  adminEditUserModal.classList.add(
    'flex',
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

  if (adminEditUserStatus) {
    adminEditUserStatus.textContent = '';

    adminEditUserStatus.classList.add(
      'hidden',
    );
  }
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


async function handleEditUserSubmit(event) {
  event.preventDefault();

  if (state.isSavingUser) {
    return;
  }

  const id =
    adminEditUserId?.value ||
    '';

  const name =
    String(
      adminEditUserName?.value || '',
    ).trim();

  const email =
    String(
      adminEditUserEmail?.value || '',
    ).trim();

  const phone =
    String(
      adminEditUserPhone?.value || '',
    ).trim();


  if (!id) {
    showEditUserError(
      'Usuário não identificado.',
    );

    return;
  }


  if (!name) {
    showEditUserError(
      'Informe o nome do usuário.',
    );

    adminEditUserName?.focus();

    return;
  }


  if (!email) {
    showEditUserError(
      'Informe o e-mail do usuário.',
    );

    adminEditUserEmail?.focus();

    return;
  }


  state.isSavingUser = true;


  if (adminEditUserSubmit) {
    adminEditUserSubmit.disabled = true;

    adminEditUserSubmit.textContent =
      'Salvando...';
  }


  try {
    const result = await apiRequest(
      `/api/admin/users/${encodeURIComponent(
        id,
      )}`,
      {
        method: 'PUT',

        body: JSON.stringify({
          name,
          email,
          phone: phone || null,
        }),
      },
    );


    const index =
      state.users.findIndex(
        (user) =>
          String(user.id) ===
          String(id),
      );


    const updatedUser = {
      ...(index >= 0
        ? state.users[index]
        : {}),

      ...(result?.user || {}),

      id,

      name,

      email,

      phone:
        phone || null,
    };


    if (index >= 0) {
      state.users[index] =
        updatedUser;
    }


    renderUsers();


    closeEditUserModal();


    await refreshSummary();


    showToast(
      result?.message ||
        'Usuário atualizado com sucesso.',
    );

  } catch (error) {

    const message =
      error?.message ||
      'Não foi possível atualizar o usuário.';

    showEditUserError(
      message,
    );

    showToast(
      message,
    );

  } finally {

    state.isSavingUser = false;


    if (adminEditUserSubmit) {
      adminEditUserSubmit.disabled =
        false;

      adminEditUserSubmit.textContent =
        'Salvar alterações';
    }
  }
}


function getFilteredUsers() {
  const search =
    String(
      adminUserSearch?.value || '',
    )
      .trim()
      .toLowerCase();

  const role =
    normalizeRole(
      adminRoleFilter?.value || '',
    );


  return state.users.filter(
    (user) => {

      const userName =
        String(
          user.name ||
          user.full_name ||
          '',
        ).toLowerCase();

      const userEmail =
        String(
          user.email ||
          '',
        ).toLowerCase();

      const userRole =
        normalizeRole(
          user.role ||
          user.profile ||
          '',
        );


      const matchesSearch =
        !search ||
        userName.includes(search) ||
        userEmail.includes(search);


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


function renderUsers() {
  if (!adminUsersList) {
    return;
  }

  const users =
    getFilteredUsers();


  adminUsersList.innerHTML = '';


  if (adminEmptyUsers) {
    adminEmptyUsers.classList.toggle(
      'hidden',
      users.length > 0,
    );
  }


  const activeCount =
    users.filter(
      isUserActive,
    ).length;

  const blockedCount =
    users.length -
    activeCount;


  if (adminFilteredUsersCount) {
    adminFilteredUsersCount.textContent =
      formatNumber(users.length);
  }

  if (adminFilteredActiveCount) {
    adminFilteredActiveCount.textContent =
      formatNumber(activeCount);
  }

  if (adminFilteredBlockedCount) {
    adminFilteredBlockedCount.textContent =
      formatNumber(blockedCount);
  }


  users.forEach((user) => {

    const active =
      isUserActive(user);

    const role =
      roleLabel(
        user.role ||
        user.profile,
      );

    const name =
      user.name ||
      user.full_name ||
      'Usuário';

    const email =
      user.email ||
      '--';

    const initials =
      getInitials
        ? getInitials(name)
        : name
            .split(/\s+/)
            .slice(0, 2)
            .map(
              (part) =>
                part[0],
            )
            .join('')
            .toUpperCase();


    const row =
      document.createElement(
        'div',
      );

    row.className =
      'grid gap-4 px-4 py-4 md:grid-cols-[1.25fr_.85fr_.55fr_.6fr_.8fr] md:items-center';


    row.innerHTML = `
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-nutriflow-100 text-xs font-bold text-nutriflow-800">
          ${escapeHtml(initials)}
        </div>

        <div class="min-w-0">
          <p class="truncate text-sm font-bold text-nutriflow-950">
            ${escapeHtml(name)}
          </p>

          <p class="truncate text-xs text-nutriflow-600">
            ${escapeHtml(email)}
          </p>
        </div>
      </div>

      <div>
        <span class="inline-flex rounded-full bg-nutriflow-50 px-3 py-1 text-xs font-bold text-nutriflow-700">
          ${escapeHtml(role)}
        </span>
      </div>

      <div>
        <span class="inline-flex rounded-full ${
          active
            ? 'bg-green-50 text-green-700'
            : 'bg-red-50 text-red-700'
        } px-3 py-1 text-xs font-bold">
          ${active ? 'Ativo' : 'Bloqueado'}
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

      <div class="flex justify-start gap-2 md:justify-end">

        <button
          type="button"
          class="admin-edit-user-btn rounded-xl border border-nutriflow-200 bg-white px-3 py-2 text-xs font-bold text-nutriflow-800 transition hover:bg-nutriflow-50"
          data-user-id="${escapeHtml(
            String(user.id || ''),
          )}"
        >
          Editar
        </button>

      </div>
    `;


    const editButton =
      row.querySelector(
        '.admin-edit-user-btn',
      );


    editButton?.addEventListener(
      'click',
      () => {
        openEditUserModal(user);
      },
    );


    adminUsersList.appendChild(
      row,
    );
  });
}


async function loadUsers() {
  if (state.isLoadingUsers) {
    return;
  }

  state.isLoadingUsers = true;


  try {
    const result =
      await apiRequest(
        '/api/admin/users',
      );


    const users =
      Array.isArray(result)
        ? result
        : Array.isArray(
            result?.users,
          )
          ? result.users
          : Array.isArray(
              result?.data,
            )
            ? result.data
            : [];


    state.users = users;

    renderUsers();

  } catch (error) {

    state.users = [];

    renderUsers();

    showToast(
      error?.message ||
        'Não foi possível carregar os usuários.',
    );

  } finally {

    state.isLoadingUsers = false;
  }
}


function getFilteredFoods() {
  const search =
    String(
      foodSearch?.value || '',
    )
      .trim()
      .toLowerCase();


  return state.foods.filter(
    (food) => {

      const name =
        String(
          food.name ||
          '',
        ).toLowerCase();

      return (
        !search ||
        name.includes(search)
      );
    },
  );
}

function renderFoods() {
  if (!foodsList) {
    return;
  }

  const foods =
    getFilteredFoods();


  foodsList.innerHTML = '';


  if (adminFilteredFoodsCount) {
    adminFilteredFoodsCount.textContent =
      formatNumber(
        foods.length,
      );
  }


  if (adminFilteredFoodsMeta) {
    adminFilteredFoodsMeta.textContent =
      foodSearch?.value
        ? 'Resultados filtrados.'
        : 'Catalogo completo.';
  }


  foods.forEach((food) => {

    const item =
      document.createElement(
        'article',
      );

    item.className =
      'rounded-2xl border border-nutriflow-100 bg-white p-4';


    const calories =
      Number(
        food.calories ||
        food.calorias ||
        0,
      );

    const protein =
      Number(
        food.protein ||
        food.proteina ||
        0,
      );

    const carbs =
      Number(
        food.carbs ||
        food.carbohydrates ||
        food.carboidratos ||
        0,
      );

    const fat =
      Number(
        food.fat ||
        food.gordura ||
        0,
      );


    item.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="truncate text-sm font-bold text-nutriflow-950">
            ${escapeHtml(
              food.name ||
              'Alimento',
            )}
          </h3>

          <p class="mt-1 text-xs text-nutriflow-600">
            ${formatNumber(calories)} kcal
          </p>
        </div>

        <span class="shrink-0 rounded-full bg-nutriflow-50 px-2.5 py-1 text-[10px] font-bold uppercase text-nutriflow-700">
          Base
        </span>
      </div>

      <div class="mt-4 grid grid-cols-3 gap-2">
        <div class="rounded-xl bg-nutriflow-50 p-2">
          <span class="block text-[10px] uppercase text-nutriflow-500">
            Prot.
          </span>

          <strong class="text-xs text-nutriflow-900">
            ${formatDecimal(protein, 1)}g
          </strong>
        </div>

        <div class="rounded-xl bg-nutriflow-50 p-2">
          <span class="block text-[10px] uppercase text-nutriflow-500">
            Carb.
          </span>

          <strong class="text-xs text-nutriflow-900">
            ${formatDecimal(carbs, 1)}g
          </strong>
        </div>

        <div class="rounded-xl bg-nutriflow-50 p-2">
          <span class="block text-[10px] uppercase text-nutriflow-500">
            Gord.
          </span>

          <strong class="text-xs text-nutriflow-900">
            ${formatDecimal(fat, 1)}g
          </strong>
        </div>
      </div>
    `;


    foodsList.appendChild(
      item,
    );
  });
}

async function loadFoods() {
  if (state.isLoadingFoods) {
    return;
  }

  state.isLoadingFoods = true;


  try {
    const result =
      await apiRequest(
        '/api/admin/foods',
      );


    const foods =
      Array.isArray(result)
        ? result
        : Array.isArray(
            result?.foods,
          )
          ? result.foods
          : Array.isArray(
              result?.data,
            )
            ? result.data
            : [];


    state.foods = foods;

    renderFoods();

  } catch (error) {

    state.foods = [];

    renderFoods();

    showToast(
      error?.message ||
        'Não foi possível carregar os alimentos.',
    );

  } finally {

    state.isLoadingFoods = false;
  }
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
    );

    foodName?.focus();

    return;
  }


  state.isSavingFood = true;


  if (foodSubmitButton) {
    foodSubmitButton.disabled = true;

    foodSubmitButton.textContent =
      'Cadastrando...';
  }


  try {
    const result =
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


    const createdFood =
      result?.food ||
      result?.data ||
      result;


    if (
      createdFood &&
      typeof createdFood === 'object'
    ) {
      state.foods.unshift(
        createdFood,
      );
    }


    foodForm?.reset();

    renderFoods();


    showToast(
      result?.message ||
        'Alimento cadastrado com sucesso.',
    );


    await refreshSummary();

  } catch (error) {

    showToast(
      error?.message ||
        'Não foi possível cadastrar o alimento.',
    );

  } finally {

    state.isSavingFood = false;


    if (foodSubmitButton) {
      foodSubmitButton.disabled =
        false;

      foodSubmitButton.textContent =
        'Cadastrar alimento';
    }
  }
}

function updateSummaryUI(summary) {
  if (!summary) {
    return;
  }


  const values = {
    summaryTotalUsers:
      summary.total_users ??
      summary.totalUsers ??
      0,

    summaryTotalPatients:
      summary.total_patients ??
      summary.totalPatients ??
      0,

    summaryTotalNutritionists:
      summary.total_nutritionists ??
      summary.totalNutritionists ??
      0,

    summaryTotalAdmins:
      summary.total_admins ??
      summary.totalAdmins ??
      0,

    summaryActiveUsers:
      summary.active_users ??
      summary.activeUsers ??
      0,

    summaryBlockedUsers:
      summary.blocked_users ??
      summary.blockedUsers ??
      0,

    summaryTotalFoods:
      summary.total_foods ??
      summary.totalFoods ??
      0,
  };


  Object.entries(values).forEach(
    ([id, value]) => {

      const element =
        document.getElementById(id);

      if (element) {
        element.textContent =
          formatNumber(value);
      }
    },
  );


  if (adminSidebarUsers) {
    adminSidebarUsers.textContent =
      formatNumber(
        values.summaryActiveUsers,
      );
  }


  if (adminSidebarBlocked) {
    adminSidebarBlocked.textContent =
      formatNumber(
        values.summaryBlockedUsers,
      );
  }


  if (adminSidebarFoods) {
    adminSidebarFoods.textContent =
      formatNumber(
        values.summaryTotalFoods,
      );
  }
}


async function refreshSummary() {
  try {
    const result =
      await apiRequest(
        '/api/admin/summary',
      );


    const summary =
      result?.summary ||
      result?.data ||
      result ||
      {};


    state.summary =
      summary;


    updateSummaryUI(
      summary,
    );


    if (result?.admin) {
      state.currentUser =
        result.admin;

      session.persistUser(
        result.admin,
      );

      setHeader(
        result.admin,
      );
    }


    updateOperationalMetrics(
      summary,
    );

  } catch (error) {

    showToast(
      error?.message ||
        'Não foi possível carregar o resumo administrativo.',
    );
  }
}


function updateOperationalMetrics(summary) {
  const totalUsers =
    Number(
      summary.total_users ??
      summary.totalUsers ??
      0,
    );

  const activeUsers =
    Number(
      summary.active_users ??
      summary.activeUsers ??
      0,
    );

  const blockedUsers =
    Number(
      summary.blocked_users ??
      summary.blockedUsers ??
      0,
    );

  const patients =
    Number(
      summary.total_patients ??
      summary.totalPatients ??
      0,
    );

  const nutritionists =
    Number(
      summary.total_nutritionists ??
      summary.totalNutritionists ??
      0,
    );

  const admins =
    Number(
      summary.total_admins ??
      summary.totalAdmins ??
      0,
    );

  const foods =
    Number(
      summary.total_foods ??
      summary.totalFoods ??
      0,
    );

  const foodLogs =
    Number(
      summary.food_logs_today ??
      summary.foodLogsToday ??
      summary.daily_food_logs ??
      0,
    );

  const mealPlans =
    Number(
      summary.active_meal_plans ??
      summary.activeMealPlans ??
      summary.meal_plans ??
      0,
    );


  const activationRate =
    totalUsers > 0
      ? (activeUsers / totalUsers) * 100
      : 0;


  const blockedRate =
    totalUsers > 0
      ? (blockedUsers / totalUsers) * 100
      : 0;


  const careLoad =
    nutritionists > 0
      ? patients / nutritionists
      : 0;


  const setText = (
    id,
    value,
  ) => {

    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        value;
    }
  };


  setText(
    'adminWorkspaceActivationValue',
    `${formatDecimal(
      activationRate,
      0,
    )}%`,
  );

  setText(
    'adminWorkspaceUsersValue',
    `${formatNumber(
      activeUsers,
    )} contas`,
  );

  setText(
    'adminWorkspaceFoodsValue',
    `${formatNumber(
      foods,
    )} itens`,
  );

  setText(
    'adminWorkspaceAlertsValue',
    `${formatNumber(
      blockedUsers,
    )} pendencias`,
  );


  setText(
    'adminOpsActivationRate',
    `${formatDecimal(
      activationRate,
      0,
    )}%`,
  );

  setText(
    'adminOpsCoverageValue',
    formatDecimal(
      careLoad,
      1,
    ),
  );

  setText(
    'adminOpsFoodLogsValue',
    formatNumber(
      foodLogs,
    ),
  );

  setText(
    'adminOpsPlansValue',
    formatNumber(
      mealPlans,
    ),
  );


  setText(
    'adminMetricActivationRate',
    `${formatDecimal(
      activationRate,
      0,
    )}%`,
  );

  setText(
    'adminMetricBlockedRate',
    `${formatDecimal(
      blockedRate,
      0,
    )}%`,
  );

  setText(
    'adminMetricCareLoad',
    formatDecimal(
      careLoad,
      1,
    ),
  );

  setText(
    'adminMetricCatalogDensity',
    totalUsers > 0
      ? `${formatDecimal(
          (foods / totalUsers) * 100,
          0,
        )}%`
      : '0%',
  );

  setText(
    'adminMetricAdminCoverage',
    totalUsers > 0
      ? `${formatDecimal(
          (admins / totalUsers) * 100,
          0,
        )}%`
      : '0%',
  );

  setText(
    'adminMetricFoodLogs',
    formatNumber(
      foodLogs,
    ),
  );

  setText(
    'adminMetricAdmins',
    formatNumber(
      admins,
    ),
  );

  setText(
    'adminMetricMealPlans',
    formatNumber(
      mealPlans,
    ),
  );

  setText(
    'adminMetricCareLoadAside',
    formatDecimal(
      careLoad,
      1,
    ),
  );


  setText(
    'adminWorkspaceActivationMeta',
    `${formatNumber(
      activeUsers,
    )} de ${formatNumber(
      totalUsers,
    )} contas ativas.`,
  );

  setText(
    'adminWorkspaceUsersMeta',
    `${formatNumber(
      activeUsers,
    )} usuarios liberados para uso.`,
  );

  setText(
    'adminWorkspaceFoodsMeta',
    `${formatNumber(
      foods,
    )} alimentos cadastrados.`,
  );

  setText(
    'adminWorkspaceAlertsMeta',
    `${formatNumber(
      blockedUsers,
    )} contas bloqueadas.`,
  );


  setText(
    'adminOpsActivationMeta',
    'Percentual de contas ativas.',
  );

  setText(
    'adminOpsCoverageMeta',
    'Pacientes por nutricionista.',
  );

  setText(
    'adminOpsFoodLogsMeta',
    'Movimento alimentar do dia.',
  );

  setText(
    'adminOpsPlansMeta',
    'Acompanhamentos em execucao.',
  );


  setText(
    'adminMetricExecutivePulse',
    blockedUsers > 0
      ? 'Atencao'
      : 'Estavel',
  );


  setText(
    'adminRecommendationTitle',
    blockedUsers > 0
      ? 'Revise as contas bloqueadas'
      : 'Operacao sem bloqueios criticos',
  );


  setText(
    'adminRecommendationBody',
    blockedUsers > 0
      ? `${formatNumber(
          blockedUsers,
        )} contas estao bloqueadas atualmente.`
      : 'A base atual nao apresenta contas bloqueadas.',
  );
}


function renderDistribution() {
  const container =
    document.getElementById(
      'adminDistributionList',
    );

  if (!container) {
    return;
  }


  const patients =
    state.users.filter(
      (user) =>
        normalizeRole(
          user.role ||
          user.profile,
        ) === 'PATIENT',
    ).length;


  const nutritionists =
    state.users.filter(
      (user) =>
        normalizeRole(
          user.role ||
          user.profile,
        ) === 'NUTRITIONIST',
    ).length;


  const admins =
    state.users.filter(
      (user) =>
        normalizeRole(
          user.role ||
          user.profile,
        ) === 'ADMIN',
    ).length;


  const total =
    patients +
    nutritionists +
    admins;


  const items = [
    {
      label: 'Pacientes',
      value: patients,
    },
    {
      label: 'Nutricionistas',
      value: nutritionists,
    },
    {
      label: 'Administradores',
      value: admins,
    },
  ];


  container.innerHTML =
    items
      .map(
        (item) => {

          const percentage =
            total > 0
              ? (item.value / total) * 100
              : 0;

          return `
            <div class="rounded-2xl border border-nutriflow-100 bg-white p-3">

              <div class="flex items-center justify-between gap-3">

                <span class="text-sm font-semibold text-nutriflow-900">
                  ${escapeHtml(
                    item.label,
                  )}
                </span>

                <strong class="text-sm text-nutriflow-950">
                  ${formatNumber(
                    item.value,
                  )}
                </strong>

              </div>

              <div class="mt-2 h-2 overflow-hidden rounded-full bg-nutriflow-100">

                <div
                  class="h-full rounded-full bg-nutriflow-500"
                  style="width:${Math.min(
                    percentage,
                    100,
                  )}%"
                ></div>

              </div>

            </div>
          `;
        },
      )
      .join('');
}


function renderAttention() {
  const container =
    document.getElementById(
      'adminAttentionList',
    );

  if (!container) {
    return;
  }


  const blocked =
    state.users.filter(
      (user) =>
        !isUserActive(user),
    );


  if (!blocked.length) {

    container.innerHTML = `
      <div class="rounded-2xl border border-green-100 bg-green-50 p-4">
        <p class="text-sm font-bold text-green-800">
          Nenhuma conta bloqueada
        </p>

        <p class="mt-1 text-xs leading-5 text-green-700">
          A base nao possui contas bloqueadas no momento.
        </p>
      </div>
    `;

    return;
  }


  container.innerHTML =
    blocked
      .slice(0, 5)
      .map(
        (user) => {

          const name =
            user.name ||
            user.full_name ||
            'Usuário';


          return `
            <div class="rounded-2xl border border-red-100 bg-red-50 p-4">

              <div class="flex items-center justify-between gap-3">

                <p class="truncate text-sm font-bold text-red-900">
                  ${escapeHtml(
                    name,
                  )}
                </p>

                <span class="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-red-700">
                  Bloqueado
                </span>

              </div>

              <p class="mt-1 truncate text-xs text-red-700">
                ${escapeHtml(
                  user.email ||
                  '--',
                )}
              </p>

            </div>
          `;
        },
      )
      .join('');
}

function syncUserSearch(source) {
  if (source === 'global') {

    if (
      adminUserSearch &&
      adminGlobalSearch
    ) {
      adminUserSearch.value =
        adminGlobalSearch.value;
    }

  } else if (source === 'local') {

    if (
      adminGlobalSearch &&
      adminUserSearch
    ) {
      adminGlobalSearch.value =
        adminUserSearch.value;
    }
  }


  renderUsers();
}

function clearSessionAndRedirect() {
  try {
    session.clear();
  } catch {
    try {
      session.logout?.();
    } catch {
      // ignore
    }
  }


  window.location.href =
    'index.html?auth=login';
}


function initSidebarDate() {
  const elements =
    document.querySelectorAll(
      '[data-sidebar-date]',
    );


  const formatted =
    formatSidebarDate(
      new Date(),
    );


  elements.forEach(
    (element) => {
      element.textContent =
        formatted;
    },
  );
}

function bindEvents() {

  // ----------------------------------------------------------
  // Global search
  // ----------------------------------------------------------

  adminGlobalSearch?.addEventListener(
    'input',
    () => syncUserSearch('global'),
  );


  // ----------------------------------------------------------
  // User search
  // ----------------------------------------------------------

  adminUserSearch?.addEventListener(
    'input',
    () => syncUserSearch('local'),
  );


  // ----------------------------------------------------------
  // Role filter
  // ----------------------------------------------------------

  adminRoleFilter?.addEventListener(
    'change',
    renderUsers,
  );


  // ----------------------------------------------------------
  // Food search
  // ----------------------------------------------------------

  foodSearch?.addEventListener(
    'input',
    renderFoods,
  );


  // ----------------------------------------------------------
  // Food form
  // ----------------------------------------------------------

  foodForm?.addEventListener(
    'submit',
    handleFoodSubmit,
  );


  // ----------------------------------------------------------
  // Logout
  // ----------------------------------------------------------

  adminLogoutButton?.addEventListener(
    'click',
    clearSessionAndRedirect,
  );


  // ==========================================================
  // PROFILE
  // ==========================================================

  adminProfileButton?.addEventListener(
    'click',
    openAdminProfileModal,
  );


  adminProfileForm?.addEventListener(
    'submit',
    handleAdminProfileSubmit,
  );


  adminProfileClose?.addEventListener(
    'click',
    closeAdminProfileModal,
  );


  adminProfileCancel?.addEventListener(
    'click',
    closeAdminProfileModal,
  );


  // Clique fora do modal de perfil

  adminProfileModal?.addEventListener(
    'click',
    (event) => {

      if (
        event.target ===
        adminProfileModal
      ) {
        closeAdminProfileModal();
      }

    },
  );


  // ==========================================================
  // EDIT USER
  // ==========================================================

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


  // Clique fora do modal de usuário

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


  // ==========================================================
  // ESC — FECHAR MODAIS
  // ==========================================================

  document.addEventListener(
    'keydown',
    (event) => {

      if (
        event.key !== 'Escape'
      ) {
        return;
      }


      // Editar usuário

      if (
        adminEditUserModal &&
        !adminEditUserModal.classList.contains(
          'hidden',
        )
      ) {
        closeEditUserModal();

        return;
      }


      // Meu Perfil

      if (
        adminProfileModal &&
        !adminProfileModal.classList.contains(
          'hidden',
        )
      ) {
        closeAdminProfileModal();
      }

    },
  );
}


async function initAdminDashboard() {

  initSidebarDate();

  bindEvents();


  // Header inicial

  if (state.currentUser) {
    setHeader(
      state.currentUser,
    );
  }


  // Carregamento inicial

  await Promise.allSettled([
    refreshSummary(),
    loadUsers(),
    loadFoods(),
  ]);


  // Atualizações derivadas

  renderUsers();

  renderFoods();

  renderDistribution();

  renderAttention();
}

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    initAdminDashboard,
  );

} else {

  initAdminDashboard();

}