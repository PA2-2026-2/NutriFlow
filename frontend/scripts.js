const loginModal = document.getElementById('loginModal');
const openButtons = Array.from(document.querySelectorAll('[data-open-auth]'));
const authViewButtons = Array.from(document.querySelectorAll('[data-auth-view]'));
const authPanels = Array.from(document.querySelectorAll('[data-auth-panel]'));
const authSwitchButtons = Array.from(document.querySelectorAll('[data-switch-auth]'));
const closeLogin = document.getElementById('closeLogin');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginMessage = document.getElementById('loginMessage');
const registerMessage = document.getElementById('registerMessage');
const authHeading = document.getElementById('authHeading');
const authSubheading = document.getElementById('authSubheading');
const contactForm = document.getElementById('contactForm');
const contactMessage = document.getElementById('contactMessage');
const registerProfile = document.getElementById('registerProfile');
const patientConnectionFields = document.getElementById('patientConnectionFields');
const registerNutritionistEmail = document.getElementById('registerNutritionistEmail');
const registerAge = document.getElementById('registerAge');
const registerObjective = document.getElementById('registerObjective');
const registerRestrictions = document.getElementById('registerRestrictions');

function resetAuthMessages() {
  loginMessage?.classList.add('hidden');
  registerMessage?.classList.add('hidden');
}

function showMessage(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove('hidden');
  element.classList.toggle('bg-red-100', isError);
  element.classList.toggle('text-red-700', isError);
  element.classList.toggle('bg-nutriflow-100', !isError);
  element.classList.toggle('text-nutriflow-800', !isError);
}

function syncPatientRegistrationFields() {
  const isPatient = isPatientProfile(registerProfile?.value);
  const hasNutritionistEmail = Boolean(registerNutritionistEmail?.value.trim());

  patientConnectionFields?.classList.toggle('hidden', !isPatient);

  if (registerNutritionistEmail) {
    registerNutritionistEmail.required = false;
  }

  if (registerAge) {
    registerAge.required = isPatient && hasNutritionistEmail;
  }

  if (registerObjective) {
    registerObjective.required = isPatient && hasNutritionistEmail;
  }

  if (!isPatient && registerNutritionistEmail && registerAge && registerObjective && registerRestrictions) {
    registerNutritionistEmail.value = '';
    registerAge.value = '';
    registerObjective.value = '';
    registerRestrictions.value = '';
  }
}

function setAuthView(view) {
  const selectedView = view === 'register' ? 'register' : 'login';

  authViewButtons.forEach((button) => {
    const isActive = button.dataset.authView === selectedView;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  authPanels.forEach((panel) => {
    const isVisible = panel.dataset.authPanel === selectedView;
    panel.classList.toggle('hidden', !isVisible);
  });

  if (authHeading && authSubheading) {
    if (selectedView === 'register') {
      authHeading.textContent = 'Crie sua conta NutriFlow';
      authSubheading.textContent = 'Cadastre-se para iniciar seu acompanhamento nutricional.';
    } else {
      authHeading.textContent = 'Acesse sua area NutriFlow';
      authSubheading.textContent = 'Faca login para acompanhar metas, refeicoes e evolucao.';
    }
  }

  resetAuthMessages();
  syncPatientRegistrationFields();
}

function openModal(view = 'login') {
  if (!loginModal) {
    return;
  }

  setAuthView(view);
  loginModal.classList.remove('hidden');
  loginModal.classList.add('flex');
  document.body.classList.add('modal-open');
}

function closeModal() {
  if (!loginModal) {
    return;
  }

  loginModal.classList.add('hidden');
  loginModal.classList.remove('flex');
  document.body.classList.remove('modal-open');
}

async function sendAuthRequest(url, payload) {
  const response = await window.NutriFlowApi.request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({
    message: 'Resposta invalida do servidor.',
  }));

  if (!response.ok) {
    throw new Error(data.message || 'Erro na autenticacao.');
  }

  return data;
}

function saveSession(data) {
  if (!data?.token || !data?.user) {
    return;
  }

  localStorage.setItem('nutriflow.token', data.token);
  localStorage.setItem('nutriflow.user', JSON.stringify(data.user));
  localStorage.setItem('nutriflow.lastAuthAt', new Date().toISOString());
}

function redirectToDashboard() {
  window.location.assign('dashboard.html');
}

function isPatientProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase();
  return normalized === 'paciente' || normalized === 'patient';
}

function isNutritionistProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase();
  return normalized === 'nutricionista' || normalized === 'nutritionist';
}

function isAdminProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase();
  return normalized === 'administrador' || normalized === 'admin';
}

function getDashboardRoute(profile) {
  if (isPatientProfile(profile)) {
    return 'dashboard.html';
  }

  if (isNutritionistProfile(profile)) {
    return 'dashboard-nutricionista.html';
  }

  if (isAdminProfile(profile)) {
    return 'dashboard-admin.html';
  }

  return null;
}

function handlePostAuthNavigation(data) {
  const route = getDashboardRoute(data?.user?.profile);

  if (route) {
    setTimeout(() => {
      window.location.assign(route);
    }, 900);
    return;
  }

  setTimeout(closeModal, 900);
}

openButtons.forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    openModal(button.dataset.openAuth || 'login');
  });
});

authViewButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setAuthView(button.dataset.authView);
  });
});

authSwitchButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setAuthView(button.dataset.switchAuth);
  });
});

registerProfile?.addEventListener('change', syncPatientRegistrationFields);
registerNutritionistEmail?.addEventListener('input', syncPatientRegistrationFields);

closeLogin?.addEventListener('click', closeModal);

loginModal?.addEventListener('click', (event) => {
  if (event.target === loginModal) {
    closeModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && loginModal && !loginModal.classList.contains('hidden')) {
    closeModal();
  }
});

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) {
    showMessage(loginMessage, 'Preencha e-mail e senha para continuar.', true);
    return;
  }

  try {
    const data = await sendAuthRequest('/api/auth/login', { email, password });
    saveSession(data);
    showMessage(loginMessage, `${data.message} Bem-vindo, ${data.user.name}.`);
    loginForm.reset();
    handlePostAuthNavigation(data);
  } catch (error) {
    showMessage(loginMessage, error.message, true);
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const profile = document.getElementById('registerProfile').value;
  const password = document.getElementById('registerPassword').value.trim();
  const confirmPassword = document.getElementById('registerConfirm').value.trim();
  const acceptedTerms = document.getElementById('registerTerms').checked;
  const nutritionistEmail = registerNutritionistEmail?.value.trim() || '';
  const age = registerAge?.value.trim() || '';
  const objective = registerObjective?.value.trim() || '';
  const restrictions = registerRestrictions?.value.trim() || '';

  if (!name || !email || !profile || !password || !confirmPassword) {
    showMessage(registerMessage, 'Preencha todos os campos para concluir o cadastro.', true);
    return;
  }

  if (password.length < 8) {
    showMessage(registerMessage, 'Sua senha precisa ter no minimo 8 caracteres.', true);
    return;
  }

  if (password !== confirmPassword) {
    showMessage(registerMessage, 'As senhas nao conferem. Verifique e tente novamente.', true);
    return;
  }

  if (!acceptedTerms) {
    showMessage(registerMessage, 'Aceite os termos de uso para criar sua conta.', true);
    return;
  }

  if (isPatientProfile(profile) && nutritionistEmail && (!age || !objective)) {
    showMessage(registerMessage, 'Ao informar um nutricionista, preencha tambem idade e objetivo do paciente.', true);
    return;
  }

  try {
    const data = await sendAuthRequest('/api/auth/register', {
      name,
      email,
      profile,
      password,
      nutritionistEmail,
      age,
      objective,
      restrictions,
    });

    saveSession(data);
    const linkedNutritionistMessage = data.user?.nutritionist
      ? ` Vinculado a ${data.user.nutritionist.name}.`
      : isPatientProfile(profile)
        ? ' Voce pode concluir o vinculo depois, pelo dashboard do paciente ou do nutricionista.'
      : '';
    showMessage(registerMessage, `${data.message} Conta criada para ${data.user.name}.${linkedNutritionistMessage}`);
    registerForm.reset();
    syncPatientRegistrationFields();
    handlePostAuthNavigation(data);
  } catch (error) {
    showMessage(registerMessage, error.message, true);
  }
});

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  contactMessage.textContent = 'Mensagem enviada com sucesso. Agora voce pode integrar este formulario a sua API.';
  contactMessage.classList.remove('hidden');
  contactForm.reset();
});

setAuthView('login');

const requestedAuthView = new URLSearchParams(window.location.search).get('auth')
  || window.location.hash.replace('#', '');

if (requestedAuthView === 'login' || requestedAuthView === 'register') {
  openModal(requestedAuthView);
}

window.NutriFlowUi?.setupSectionNavigation({ linkSelector: '.landing-nav-link' });
