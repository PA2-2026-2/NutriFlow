function safeParse(jsonValue) {
  try {
    return jsonValue ? JSON.parse(jsonValue) : null;
  } catch (error) {
    return null;
  }
}

const state = {
  currentUser: safeParse(localStorage.getItem('nutriflow.user')),
  dashboard: null,
  isAddingMeal: false,
  isSavingWeeklyWeight: false,
  isSendingMessage: false,
  isLinkingNutritionist: false,
  lastChatSignature: '',
};

let patientChatSyncIntervalId = null;
let patientChatSyncInFlight = false;

const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const logoutButton = document.getElementById('logoutButton');
const addMealButton = document.getElementById('addMealButton');
const quickAddMealButton = document.getElementById('quickAddMealButton');
const toast = document.getElementById('patientToast');
const overviewRing = document.querySelector('.metric-ring');
const patientConnectionForm = document.getElementById('patientConnectionForm');
const patientNutritionistEmail = document.getElementById('patientNutritionistEmail');
const patientConnectionAge = document.getElementById('patientConnectionAge');
const patientConnectionObjective = document.getElementById('patientConnectionObjective');
const patientConnectionRestrictions = document.getElementById('patientConnectionRestrictions');
const patientConnectionSubmitButton = document.getElementById('patientConnectionSubmitButton');
const mealEntryModal = document.getElementById('mealEntryModal');
const mealEntryForm = document.getElementById('mealEntryForm');
const mealTypeInput = document.getElementById('mealTypeInput');
const mealLoggedAtInput = document.getElementById('mealLoggedAtInput');
const mealTitleInput = document.getElementById('mealTitleInput');
const mealDescriptionInput = document.getElementById('mealDescriptionInput');
const mealCaloriesInput = document.getElementById('mealCaloriesInput');
const mealProteinInput = document.getElementById('mealProteinInput');
const mealCarbsInput = document.getElementById('mealCarbsInput');
const mealFatsInput = document.getElementById('mealFatsInput');
const mealFiberInput = document.getElementById('mealFiberInput');
const mealWaterInput = document.getElementById('mealWaterInput');
const mealSubmitButton = document.getElementById('mealSubmitButton');
const mealFormError = document.getElementById('mealFormError');
const addWeeklyWeightButton = document.getElementById('addWeeklyWeightButton');
const weightEntryModal = document.getElementById('weightEntryModal');
const weightEntryForm = document.getElementById('weightEntryForm');
const weightRecordedAtInput = document.getElementById('weightRecordedAtInput');
const weightValueInput = document.getElementById('weightValueInput');
const weightNoteInput = document.getElementById('weightNoteInput');
const weightSubmitButton = document.getElementById('weightSubmitButton');
const weightFormError = document.getElementById('weightFormError');

const ALLOWED_MEAL_TYPES = new Set([
  'Cafe da manha',
  'Lanche da manha',
  'Almoco',
  'Lanche da tarde',
  'Jantar',
  'Ceia',
]);

const MEAL_TEMPLATE_PRESETS = {
  'lanche-rapido': {
    mealType: 'Lanche da tarde',
    title: 'Iogurte natural com fruta',
    description: 'Lanche rapido para manter energia e saciedade ate a proxima refeicao.',
    calories: 220,
    protein: 12,
    carbs: 28,
    fats: 6,
    fiber: 4,
    waterMl: 250,
  },
  'refeicao-completa': {
    mealType: 'Almoco',
    title: 'Prato completo com proteina, carbo e salada',
    description: 'Refeicao principal equilibrada para sustentar a rotina da tarde.',
    calories: 640,
    protein: 38,
    carbs: 72,
    fats: 18,
    fiber: 10,
    waterMl: 400,
  },
  'pos-treino': {
    mealType: 'Lanche da tarde',
    title: 'Shake pos-treino com banana',
    description: 'Reposicao rapida de energia e proteina apos treino.',
    calories: 340,
    protein: 30,
    carbs: 35,
    fats: 8,
    fiber: 3,
    waterMl: 350,
  },
};

const MEAL_NUMERIC_RULES = [
  { key: 'calories', label: 'Calorias', min: 0, max: 2500 },
  { key: 'protein', label: 'Proteina', min: 0, max: 250 },
  { key: 'carbs', label: 'Carboidrato', min: 0, max: 350 },
  { key: 'fats', label: 'Gordura', min: 0, max: 180 },
  { key: 'fiber', label: 'Fibra', min: 0, max: 80 },
  { key: 'waterMl', label: 'Agua (ml)', min: 0, max: 2000 },
];

const WEEKLY_WEIGHT_LIMITS = {
  min: 20,
  max: 350,
};

function getSessionToken() {
  return localStorage.getItem('nutriflow.token');
}

function persistCurrentUser(user) {
  if (!user) {
    return;
  }

  state.currentUser = user;
  localStorage.setItem('nutriflow.user', JSON.stringify(user));
}

function clearSessionAndRedirect() {
  stopPatientRealtimeChat();
  localStorage.removeItem('nutriflow.token');
  localStorage.removeItem('nutriflow.user');
  localStorage.removeItem('nutriflow.lastAuthAt');
  window.location.replace('index.html');
}

function isPatientProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase();
  return normalized === 'paciente' || normalized === 'patient';
}

function ensurePatientAccess() {
  const token = getSessionToken();

  if (!token) {
    clearSessionAndRedirect();
    return false;
  }

  return true;
}

function getInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getFirstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'Paciente';
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Bom dia';
  }

  if (hour < 18) {
    return 'Boa tarde';
  }

  return 'Boa noite';
}

function formatLongDate() {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());
}

function formatShortDate() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(new Date());
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function toDateTimeLocalValue(date) {
  const baseDate = date instanceof Date ? date : new Date(date || Date.now());
  const timezoneOffset = baseDate.getTimezoneOffset() * 60000;
  return new Date(baseDate.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function toDateValue(date) {
  const baseDate = date instanceof Date ? date : new Date(date || Date.now());
  const timezoneOffset = baseDate.getTimezoneOffset() * 60000;
  return new Date(baseDate.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function parseDateInputToIso(dateValue) {
  const normalized = String(dateValue || '').trim();

  if (!normalized) {
    return '';
  }

  const [year, month, day] = normalized.split('-').map((part) => Number(part));

  if (![year, month, day].every((part) => Number.isInteger(part))) {
    return '';
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
}

function parseWeightLabelToNumber(label) {
  const normalized = String(label || '').trim().replace(',', '.');
  const parsed = Number(normalized.replace(/[^0-9.+-]/g, ''));

  return Number.isFinite(parsed) ? Number(parsed.toFixed(1)) : 0;
}

function toRoundedNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function setMealFormError(message = '') {
  if (!mealFormError) {
    return;
  }

  if (!message) {
    mealFormError.textContent = '';
    mealFormError.classList.add('hidden');
    return;
  }

  mealFormError.textContent = message;
  mealFormError.classList.remove('hidden');
}

function resetMealEntryForm() {
  mealEntryForm?.reset();

  if (mealTypeInput) {
    mealTypeInput.value = 'Lanche da tarde';
  }

  if (mealLoggedAtInput) {
    mealLoggedAtInput.value = toDateTimeLocalValue(new Date());
  }

  [mealCaloriesInput, mealProteinInput, mealCarbsInput, mealFatsInput, mealFiberInput, mealWaterInput]
    .forEach((input) => {
      if (input) {
        input.value = '0';
      }
    });

  setMealFormError('');

  const list = document.getElementById('mealItemsList');
  if (list) list.innerHTML = ''; // Limpa a lista ao abrir o modal
}

function applyMealTemplate(templateKey) {
  const template = MEAL_TEMPLATE_PRESETS[templateKey];

  if (!template) {
    return;
  }

  if (mealTypeInput) {
    mealTypeInput.value = template.mealType;
  }

  if (mealTitleInput) {
    mealTitleInput.value = template.title;
  }

  if (mealDescriptionInput) {
    mealDescriptionInput.value = template.description;
  }

  if (mealCaloriesInput) {
    mealCaloriesInput.value = String(template.calories);
  }

  if (mealProteinInput) {
    mealProteinInput.value = String(template.protein);
  }

  if (mealCarbsInput) {
    mealCarbsInput.value = String(template.carbs);
  }

  if (mealFatsInput) {
    mealFatsInput.value = String(template.fats);
  }

  if (mealFiberInput) {
    mealFiberInput.value = String(template.fiber);
  }

  if (mealWaterInput) {
    mealWaterInput.value = String(template.waterMl);
  }

  if (mealLoggedAtInput && !mealLoggedAtInput.value) {
    mealLoggedAtInput.value = toDateTimeLocalValue(new Date());
  }

  setMealFormError('');
}

// --- LÓGICA DINÂMICA DE ALIMENTOS DO PACIENTE ---

// Simula a busca do alimento (o back-end precisa retornar state.dashboard.foods igual no nutri)
function getFoodByIdForPatient(foodId) {
  const foods = state.dashboard?.foods || [];
  return foods.find((food) => food.id === foodId) || null;
}

function buildFoodOptionsForPatient(selectedFoodId = '') {
  const foods = state.dashboard?.foods || [];
  if (!foods.length) return '<option value="">Base de alimentos vazia</option>';
  
  return '<option value="">Selecione um alimento</option>' + foods.map((food) => `
    <option value="${food.id}" ${food.id === selectedFoodId ? 'selected' : ''}>${escapeHtml(food.name)}</option>
  `).join('');
}

function getMealItemsPayload() {
  return Array.from(document.querySelectorAll('[data-meal-item-row]')).map((row) => {
    const foodId = row.querySelector('[data-meal-food]')?.value || '';
    const quantity = Number(row.querySelector('[data-meal-quantity]')?.value || 0);
    return { foodId, quantity };
  }).filter((item) => item.foodId && Number.isFinite(item.quantity) && item.quantity > 0);
}

function updateMealTotals() {
  const totals = getMealItemsPayload().reduce((acc, item) => {
    const food = getFoodByIdForPatient(item.foodId);
    if (!food || !Number.isFinite(item.quantity)) return acc;

    const factor = item.quantity / 100;
    acc.calories += (food.calories || 0) * factor;
    acc.protein += (food.protein || 0) * factor;
    acc.carbs += (food.carbs || 0) * factor;
    acc.fats += (food.fat || food.fats || 0) * factor;
    acc.fiber += (food.fiber || 0) * factor; // Assumindo que o banco tem fibra
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });

  mealCaloriesInput.value = Math.round(totals.calories);
  mealProteinInput.value = Math.round(totals.protein);
  mealCarbsInput.value = Math.round(totals.carbs);
  mealFatsInput.value = Math.round(totals.fats);
  mealFiberInput.value = Math.round(totals.fiber);
}

function addMealItemRow(item = {}) {
  const list = document.getElementById('mealItemsList');
  if (!list) return;

  const row = document.createElement('div');
  row.className = 'grid gap-2 rounded-lg border border-white bg-white p-2 shadow-sm grid-cols-[1fr_100px_auto]';
  row.dataset.mealItemRow = 'true';
  row.innerHTML = `
    <select class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-meal-food required>
      ${buildFoodOptionsForPatient(item.foodId || '')}
    </select>
    <div class="relative">
      <input class="w-full rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold pr-6" data-meal-quantity type="number" min="1" step="1" value="${item.quantity || 100}" required />
      <span class="absolute right-2 top-2 text-xs text-nutriflow-500 font-bold">g</span>
    </div>
    <button class="rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50" type="button" data-remove-meal-item>Excluir</button>
  `;

  row.querySelectorAll('select, input').forEach((field) => {
    field.addEventListener('input', updateMealTotals);
    field.addEventListener('change', updateMealTotals);
  });

  row.querySelector('[data-remove-meal-item]')?.addEventListener('click', () => {
    row.remove();
    updateMealTotals();
  });

  list.appendChild(row);
  updateMealTotals();
}

document.getElementById('btnAddMealItem')?.addEventListener('click', () => addMealItemRow());

document.getElementById('btnAutoFillMeal')?.addEventListener('click', () => {
  const selectedMealType = document.getElementById('mealTypeInput').value;
  const rawItems = state.dashboard?.plan?.rawItems || [];
  
  const planItemsForMeal = rawItems.filter(item => item.mealTime === selectedMealType);

  if (planItemsForMeal.length === 0) {
    showToast(`Nenhum alimento cadastrado no plano para: ${selectedMealType}`);
    return;
  }

  // Limpa a lista atual
  const list = document.getElementById('mealItemsList');
  if (list) list.innerHTML = '';

  planItemsForMeal.forEach(item => {
    addMealItemRow({ foodId: item.foodId, quantity: item.quantity });
  });
  
  showToast('Alimentos do plano adicionados!');
});

function openMealEntryModal(options = {}) {
  if (!mealEntryModal) {
    return;
  }

  if (isSetupRequired()) {
    showToast('Conecte sua conta a um nutricionista antes de registrar refeicoes.');
    return;
  }

  resetMealEntryForm();

  if (options.templateKey) {
    applyMealTemplate(options.templateKey);
  }

  mealEntryModal.classList.remove('hidden');
  mealEntryModal.classList.add('flex');
  document.body.classList.add('modal-open');

  window.requestAnimationFrame(() => {
    mealTitleInput?.focus();
  });
}

function closeMealEntryModal(options = {}) {
  if (!mealEntryModal) {
    return;
  }

  mealEntryModal.classList.add('hidden');
  mealEntryModal.classList.remove('flex');

  if (!document.querySelector('.nf-modal-overlay:not(.hidden)')) {
    document.body.classList.remove('modal-open');
  }

  setMealFormError('');

  if (options.resetForm) {
    resetMealEntryForm();
  }
}

function getMealPayloadFromForm() {
  const loggedAtRaw = String(mealLoggedAtInput?.value || '').trim();
  const loggedAtDate = loggedAtRaw ? new Date(loggedAtRaw) : null;
  const loggedAt = loggedAtDate && !Number.isNaN(loggedAtDate.getTime()) ? loggedAtDate.toISOString() : '';

  return {
    mealType: String(mealTypeInput?.value || '').trim(),
    title: String(mealTitleInput?.value || '').trim(),
    description: String(mealDescriptionInput?.value || '').trim(),
    loggedAt,
    items: getMealItemsPayload(), 
    calories: toRoundedNumber(mealCaloriesInput?.value, 0),
    protein: toRoundedNumber(mealProteinInput?.value, 0),
    carbs: toRoundedNumber(mealCarbsInput?.value, 0),
    fats: toRoundedNumber(mealFatsInput?.value, 0),
    fiber: toRoundedNumber(mealFiberInput?.value, 0),
    waterMl: toRoundedNumber(mealWaterInput?.value, 0),
  };
}

function validateMealPayload(payload) {
  if (!ALLOWED_MEAL_TYPES.has(payload.mealType)) {
    return 'Selecione um tipo de refeicao valido.';
  }

  if (!payload.title || payload.title.length < 3 || payload.title.length > 80) {
    return 'Informe um titulo com 3 a 80 caracteres.';
  }

  if (payload.description.length > 280) {
    return 'A descricao da refeicao deve ter ate 280 caracteres.';
  }

  if (!payload.loggedAt) {
    return 'Informe o horario em que a refeicao foi feita.';
  }

  const loggedAtDate = new Date(payload.loggedAt);
  if (Number.isNaN(loggedAtDate.getTime())) {
    return 'Horario invalido para o registro da refeicao.';
  }

  const now = Date.now();
  if (loggedAtDate.getTime() > now + (5 * 60 * 1000)) {
    return 'Nao e permitido registrar refeicoes no futuro.';
  }

  for (const rule of MEAL_NUMERIC_RULES) {
    const value = payload[rule.key];

    if (!Number.isInteger(value)) {
      return `${rule.label} deve ser um numero inteiro.`;
    }

    if (value < rule.min || value > rule.max) {
      return `${rule.label} deve ficar entre ${rule.min} e ${rule.max}.`;
    }
  }

  return '';
}

function setMealFormLoading(isLoading) {
  if (!mealEntryForm) {
    return;
  }

  mealEntryForm.querySelectorAll('input, select, textarea, button').forEach((element) => {
    element.disabled = isLoading;
  });

  if (mealSubmitButton) {
    mealSubmitButton.textContent = isLoading ? 'Salvando...' : 'Salvar refeicao';
  }
}

function setWeightFormError(message = '') {
  if (!weightFormError) {
    return;
  }

  if (!message) {
    weightFormError.textContent = '';
    weightFormError.classList.add('hidden');
    return;
  }

  weightFormError.textContent = message;
  weightFormError.classList.remove('hidden');
}

function resetWeightEntryForm() {
  weightEntryForm?.reset();

  if (weightRecordedAtInput) {
    weightRecordedAtInput.value = toDateValue(new Date());
  }

  if (weightValueInput) {
    const currentWeightLabel = state.dashboard?.weight?.currentLabel || '';
    const currentWeight = parseWeightLabelToNumber(currentWeightLabel);
    weightValueInput.value = currentWeight > 0 ? currentWeight.toFixed(1) : '';
  }

  setWeightFormError('');
}

function openWeightEntryModal() {
  if (!weightEntryModal) {
    return;
  }

  if (isSetupRequired()) {
    showToast('Conecte sua conta a um nutricionista antes de registrar peso.');
    return;
  }

  resetWeightEntryForm();

  weightEntryModal.classList.remove('hidden');
  weightEntryModal.classList.add('flex');
  document.body.classList.add('modal-open');

  window.requestAnimationFrame(() => {
    weightValueInput?.focus();
  });
}

function closeWeightEntryModal(options = {}) {
  if (!weightEntryModal) {
    return;
  }

  weightEntryModal.classList.add('hidden');
  weightEntryModal.classList.remove('flex');

  if (!document.querySelector('.nf-modal-overlay:not(.hidden)')) {
    document.body.classList.remove('modal-open');
  }

  setWeightFormError('');

  if (options.resetForm) {
    resetWeightEntryForm();
  }
}

function getWeeklyWeightPayloadFromForm() {
  const weight = Number(weightValueInput?.value);
  const recordedAt = parseDateInputToIso(weightRecordedAtInput?.value);

  return {
    weight: Number.isFinite(weight) ? Number(weight.toFixed(1)) : NaN,
    recordedAt,
    note: String(weightNoteInput?.value || '').trim(),
  };
}

function validateWeeklyWeightPayload(payload) {
  if (!Number.isFinite(payload.weight)) {
    return 'Informe um peso valido em kg.';
  }

  if (payload.weight < WEEKLY_WEIGHT_LIMITS.min || payload.weight > WEEKLY_WEIGHT_LIMITS.max) {
    return `O peso precisa ficar entre ${WEEKLY_WEIGHT_LIMITS.min}kg e ${WEEKLY_WEIGHT_LIMITS.max}kg.`;
  }

  if (!payload.recordedAt) {
    return 'Informe a data da pesagem semanal.';
  }

  const recordedDate = new Date(payload.recordedAt);
  if (Number.isNaN(recordedDate.getTime())) {
    return 'Data invalida para o registro de peso.';
  }

  const now = Date.now();
  if (recordedDate.getTime() > now + (5 * 60 * 1000)) {
    return 'Nao e permitido registrar peso em uma data futura.';
  }

  if (payload.note.length > 180) {
    return 'A observacao deve ter ate 180 caracteres.';
  }

  return '';
}

function setWeightFormLoading(isLoading) {
  if (!weightEntryForm) {
    return;
  }

  weightEntryForm.querySelectorAll('input, textarea, button').forEach((element) => {
    element.disabled = isLoading;
  });

  if (weightSubmitButton) {
    weightSubmitButton.textContent = isLoading ? 'Salvando...' : 'Salvar peso';
  }

  if (addWeeklyWeightButton) {
    addWeeklyWeightButton.disabled = isLoading || isSetupRequired();
    addWeeklyWeightButton.textContent = isLoading ? 'Salvando peso...' : 'Adicionar peso';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getChatSignature(chat) {
  const messages = Array.isArray(chat?.messages) ? chat.messages : [];
  const latestMessage = messages[messages.length - 1] || null;

  return JSON.stringify({
    count: messages.length,
    latestId: latestMessage?.id || '',
    latestRole: latestMessage?.senderRole || '',
    latestTime: latestMessage?.timeLabel || '',
    responseTimeLabel: chat?.responseTimeLabel || '',
  });
}

function showToast(message) {
  if (!toast || !message) {
    return;
  }

  toast.textContent = message;
  toast.classList.remove('hidden');
  toast.classList.add('is-visible');

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.classList.add('hidden');
  }, 2400);
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getSessionToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await window.NutriFlowApi.request(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({
    message: 'Resposta invalida do servidor.',
  }));

  if (response.status === 401 || response.status === 403) {
    showToast(data.message || 'Sua sessao expirou. Faca login novamente.');
    window.setTimeout(clearSessionAndRedirect, 800);
    throw new Error(data.message || 'Sessao invalida.');
  }

  if (!response.ok) {
    throw new Error(data.message || 'Nao foi possivel concluir a operacao.');
  }

  return data;
}

async function getPatientDashboard() {
  return apiRequest('/api/patient/dashboard');
}

async function getPatientChat() {
  return apiRequest('/api/patient/chat');
}

async function createMealEntry(payload = {}) {
  return apiRequest('/api/patient/meals', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function createWeeklyWeightEntry(payload = {}) {
  return apiRequest('/api/patient/weights', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function sendPatientMessage(payload) {
  return apiRequest('/api/patient/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function linkNutritionist(payload) {
  return apiRequest('/api/patient/link-nutritionist', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updatePatientProfile(payload) {
  return apiRequest('/api/patient/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

function applyDashboardState(payload) {
  state.dashboard = payload || null;
  state.lastChatSignature = getChatSignature(payload?.chat);

  if (!payload?.patient) {
    return;
  }

  persistCurrentUser({
    ...state.currentUser,
    ...payload.patient,
    nutritionist: payload.patient.nutritionist,
  });
}

function getPatientData() {
  return state.dashboard?.patient || state.currentUser || {
    name: '',
    email: '',
    profile: 'Paciente',
    nutritionist: {
      name: '',
      email: '',
    },
  };
}

function isSetupRequired() {
  return state.dashboard?.setupRequired === true;
}

function getNutritionistData() {
  return getPatientData().nutritionist || {
    name: '',
    email: '',
  };
}

function getDailyMealTarget() {
  const regularityGoal = state.dashboard?.goals?.items?.find((item) => item.label.toLowerCase().includes('regularidade'));
  const match = regularityGoal?.valueLabel?.match(/\/\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function setTextContent(selectorOrElement, value) {
  const element = typeof selectorOrElement === 'string'
    ? document.querySelector(selectorOrElement)
    : selectorOrElement;

  if (element) {
    element.textContent = value;
  }
}

function renderHeader() {
  const patient = getPatientData();
  const nutritionist = getNutritionistData();
  const patientName = patient.name || 'Conta do paciente';
  const patientInitials = getInitials(patient.name) || '--';
  const nutritionistName = nutritionist.name || 'Sem Nutricionista';

  document.querySelectorAll('[data-user-name]').forEach((element) => {
    element.textContent = patientName;
  });

  document.querySelectorAll('[data-user-initial]').forEach((element) => {
    element.textContent = patientInitials;
  });

  document.querySelectorAll('[data-linked-nutritionist-name]').forEach((element) => {
    element.textContent = nutritionistName;
  });

  setTextContent('[data-greeting]', `${getGreeting()}, ${getFirstName(patient.name)}`);

  if (chatInput) {
    chatInput.placeholder = `Escreva para ${nutritionist.name || 'sua nutricionista'}...`;
  }
}

function renderHighlights() {
  const patient = getPatientData();
  const nutritionist = patient.nutritionist;
  const clinical = state.dashboard?.clinical;

  setTextContent('#sidebarNutriName', nutritionist?.name || 'Sem vínculo');
  setTextContent('#sidebarObjective', patient.objective || 'A definir');
  setTextContent('#sidebarAppointment', clinical?.nextAppointment?.dateLabel || 'Sem agenda');
}

function setInteractionsEnabled(isEnabled) {
  [addMealButton, quickAddMealButton, addWeeklyWeightButton].forEach((button) => {
    if (button) {
      button.disabled = !isEnabled || state.isAddingMeal || state.isSavingWeeklyWeight;
    }
  });

  if (chatInput) {
    chatInput.disabled = !isEnabled || state.isSendingMessage;
  }

  const submitButton = chatForm?.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = !isEnabled || state.isSendingMessage;
  }
}

function renderConnectionPanel() { return; }

function renderSidebar() { return; }

function renderWeeklyBars(items, caloriesTarget) {
  const container = document.getElementById('weeklyCaloriesChart');

  if (!container) {
    return;
  }

  if (!items?.length) {
    container.innerHTML = '<p class="text-sm text-nutriflow-600">Comece a registrar refeicoes para acompanhar o comportamento da semana.</p>';
    return;
  }

  const svgWidth = 380;
  const svgHeight = 200;
  const marginLeft = 44;
  const marginRight = 16;
  const marginTop = 26;
  const marginBottom = 28;
  const chartWidth = svgWidth - marginLeft - marginRight;
  const chartHeight = svgHeight - marginTop - marginBottom;

  const target = Number(caloriesTarget) > 0 ? Number(caloriesTarget) : 0;
  const maxCalories = Math.max(...items.map((i) => i.calories), target, 1);
  const yMax = Math.ceil(maxCalories / 100) * 100;

  const barCount = items.length;
  const barGap = 10;
  const barWidth = Math.floor((chartWidth - barGap * (barCount - 1)) / barCount);

  function toY(value) {
    return marginTop + chartHeight - Math.round((value / yMax) * chartHeight);
  }

  const yTickCount = 4;
  const gridLines = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const value = Math.round((yMax / yTickCount) * i);
    const y = toY(value);
    const label = value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
    return { value, y, label };
  });

  const targetY = target > 0 ? toY(target) : null;

  const gridLinesHtml = gridLines.map(({ y, label }) => `
    <line x1="${marginLeft}" y1="${y}" x2="${svgWidth - marginRight}" y2="${y}" stroke="rgba(79,107,61,.1)" stroke-width="1"></line>
    <text x="${marginLeft - 6}" y="${y + 4}" text-anchor="end" font-size="9" fill="#7a8d70" font-weight="600">${escapeHtml(label)}</text>
  `).join('');

  const targetLineHtml = targetY !== null ? `
    <line x1="${marginLeft}" y1="${targetY}" x2="${svgWidth - marginRight}" y2="${targetY}" stroke="#4f6b3d" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.65"></line>
    <text x="${svgWidth - marginRight + 3}" y="${targetY + 4}" font-size="9" fill="#4f6b3d" font-weight="700">meta</text>
  ` : '';

  const barsHtml = items.map((item, index) => {
    const x = marginLeft + index * (barWidth + barGap);
    const isActive = item.calories > 0;
    const isOnTarget = item.percent >= 80;
    const gradientId = `wk-bar-${index}`;

    if (!isActive) {
      return `
        <rect x="${x}" y="${marginTop + chartHeight - 4}" width="${barWidth}" height="4" rx="2" fill="rgba(79,107,61,.15)"></rect>
        <text x="${x + barWidth / 2}" y="${svgHeight - marginBottom + 16}" text-anchor="middle" font-size="10" fill="#7a8d70" font-weight="700">${escapeHtml(item.label)}</text>
      `;
    }

    const barHeight = Math.max(Math.round((item.calories / yMax) * chartHeight), 4);
    const barY = marginTop + chartHeight - barHeight;
    const colorTop = isOnTarget ? '#9ccc7d' : '#c3e3a8';
    const colorBottom = isOnTarget ? '#5f8249' : '#92ca74';

    return `
      <rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="6" fill="url(#${gradientId})"></rect>
      <text x="${x + barWidth / 2}" y="${barY - 5}" text-anchor="middle" font-size="9" fill="#1c2618" font-weight="800">${item.calories}</text>
      <text x="${x + barWidth / 2}" y="${svgHeight - marginBottom + 16}" text-anchor="middle" font-size="10" fill="#5f8249" font-weight="700">${escapeHtml(item.label)}</text>
    `;
  }).join('');

  const defsHtml = `
    <defs>
      ${items.map((item, index) => {
        if (item.calories <= 0) return '';
        const isOnTarget = item.percent >= 80;
        const colorTop = isOnTarget ? '#9ccc7d' : '#c3e3a8';
        const colorBottom = isOnTarget ? '#5f8249' : '#92ca74';
        return `
          <linearGradient id="wk-bar-${index}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${colorTop}"></stop>
            <stop offset="100%" stop-color="${colorBottom}"></stop>
          </linearGradient>
        `;
      }).join('')}
    </defs>
  `;

  container.innerHTML = `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="weekly-consumption-chart w-full h-auto" role="img" aria-label="Gráfico de consumo calórico semanal">
      ${defsHtml}
      ${gridLinesHtml}
      ${targetLineHtml}
      ${barsHtml}
    </svg>
  `;
}

function getWeeklyHeadline(weeklyCalories) {
  const activeDays = weeklyCalories.filter((item) => item.calories > 0);

  if (!activeDays.length) {
    return {
      headline: 'Comece a registrar para acompanhar sua regularidade nutricional.',
      trend: '0%',
    };
  }

  const firstCalories = activeDays[0].calories;
  const lastCalories = activeDays[activeDays.length - 1].calories;
  const trendValue = firstCalories > 0 ? Math.round(((lastCalories - firstCalories) / firstCalories) * 100) : 0;
  const prefix = trendValue > 0 ? '+' : '';

  if (trendValue >= 8) {
    return {
      headline: 'Seu consumo esta mais proximo da meta nos dias mais recentes.',
      trend: `${prefix}${trendValue}%`,
    };
  }

  if (trendValue <= -8) {
    return {
      headline: 'Seu consumo caiu nos ultimos dias. Vale revisar horarios e lanches.',
      trend: `${trendValue}%`,
    };
  }

  return {
    headline: 'Seu consumo esta mais regular e previsivel ao longo da semana.',
    trend: `${prefix}${trendValue}%`,
  };
}

function renderOverview() {
  const overview = state.dashboard?.overview || {
    adherencePercent: 0,
    caloriesConsumed: 0,
    caloriesTarget: 0,
    fiber: 0,
    waterLiters: 0,
    macros: [],
    weeklyCalories: [],
  };
  const macroByLabel = Object.fromEntries((overview.macros || []).map((macro) => [macro.label, macro]));
  const mealCount = state.dashboard?.meals?.length || 0;
  const weeklyCopy = getWeeklyHeadline(overview.weeklyCalories || []);

  setTextContent(document.getElementById('overviewAdherenceValue'), `${overview.adherencePercent || 0}%`);
  setTextContent(
    document.getElementById('overviewAdherenceNote'),
    `${pluralize(mealCount, 'refeicao registrada', 'refeicoes registradas')} hoje e ${Number(overview.waterLiters || 0).toFixed(1)}L de agua.`,
  );
  setTextContent(document.getElementById('calorieConsumedValue'), formatNumber(overview.caloriesConsumed));
  setTextContent(document.getElementById('calorieTargetValue'), `de ${formatNumber(overview.caloriesTarget)} kcal`);
  setTextContent(document.getElementById('fiberValue'), `${overview.fiber || 0}g`);
  setTextContent(document.getElementById('waterValue'), `${Number(overview.waterLiters || 0).toFixed(1)}L`);

  const macroTargets = [
    ['Proteinas', 'proteinValue', 'proteinProgress', 'proteinNote'],
    ['Carboidratos', 'carbsValue', 'carbsProgress', 'carbsNote'],
    ['Gorduras', 'fatsValue', 'fatsProgress', 'fatsNote'],
  ];

  macroTargets.forEach(([label, valueId, progressId, noteId]) => {
    const macro = macroByLabel[label] || { value: 0, progress: 0, note: 'Sem meta definida' };
    setTextContent(document.getElementById(valueId), `${macro.value || 0}g`);

    const progressBar = document.getElementById(progressId);
    if (progressBar) {
      progressBar.style.width = `${macro.progress || 0}%`;
    }

    setTextContent(document.getElementById(noteId), macro.note || 'Sem meta definida');
  });

  if (overviewRing) {
    overviewRing.style.setProperty('--progress', `${Math.max(0, Math.min(100, overview.adherencePercent || 0))}%`);
  }

  setTextContent(document.getElementById('weeklyCaloriesHeadline'), weeklyCopy.headline);
  setTextContent(document.getElementById('weeklyTrendPercent'), weeklyCopy.trend);
  renderWeeklyBars(overview.weeklyCalories || [], overview.caloriesTarget || 0);
}

function renderGoals() {
  const container = document.getElementById('goalsList');
  const goals = state.dashboard?.goals?.items || [];

  if (!container) {
    return;
  }

  if (!goals.length) {
    container.innerHTML = '<div class="rounded-[24px] border border-nutriflow-100 bg-white p-4 text-sm text-nutriflow-600">Nenhuma meta disponivel no momento.</div>';
  } else {
    container.innerHTML = goals.map((goal) => `
      <article class="rounded-[24px] border border-nutriflow-100 bg-white p-4">
        <div class="flex items-center justify-between gap-4">
          <p class="text-sm font-semibold text-nutriflow-950">${escapeHtml(goal.label)}</p>
          <span class="text-xs font-semibold uppercase tracking-[0.14em] text-nutriflow-600">${escapeHtml(goal.valueLabel)}</span>
        </div>
        <div class="mini-progress mt-4"><span style="width:${goal.percent || 0}%"></span></div>
      </article>
    `).join('');
  }

  setTextContent(document.getElementById('goalFocusTitle'), state.dashboard?.goals?.focusTitle || 'Mantenha o plano do dia com consistencia.');
  setTextContent(document.getElementById('clinicalObservationNote'), state.dashboard?.goals?.observationNote || 'Sem observacoes clinicas registradas ate o momento.');
}

function renderMeals() {
  const container = document.getElementById('mealList');
  const meals = state.dashboard?.meals || [];

  if (!container) {
    return;
  }

  if (!meals.length) {
    container.innerHTML = `
      <article class="meal-item rounded-[24px] border border-dashed border-nutriflow-200 bg-white p-5 text-sm leading-7 text-nutriflow-600">
        Nenhuma refeicao registrada hoje. Use o botao "Nova refeicao" para registrar o proximo horario.
      </article>
    `;
    return;
  }

  container.innerHTML = meals.map((meal) => `
    <article class="meal-item rounded-[24px] border border-nutriflow-100 bg-white p-4">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div class="flex items-start gap-4">
          <span class="timeline-dot"></span>
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.16em] text-nutriflow-500">${escapeHtml(meal.timeLabel)} - ${escapeHtml(meal.mealType)}</p>
            <h3 class="mt-2 text-lg font-semibold tracking-[-0.03em] text-nutriflow-950">${escapeHtml(meal.title)}</h3>
            <p class="mt-2 text-sm text-nutriflow-600">${escapeHtml(meal.description)}</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-nutriflow-700">
          <span class="rounded-full bg-nutriflow-100 px-3 py-2">${meal.calories} kcal</span>
          <span class="rounded-full bg-[#edf7e7] px-3 py-2">${meal.protein}g proteina</span>
          <span class="rounded-full bg-[#f3f8fd] px-3 py-2">${meal.carbs}g carbo</span>
        </div>
      </div>
    </article>
  `).join('');
}

function getHistoryPillClass(label) {
  const normalizedLabel = String(label || '').toLowerCase();

  if (normalizedLabel === 'completo' || normalizedLabel === 'excelente') {
    return 'bg-[#eef6e8] text-nutriflow-700';
  }

  if (normalizedLabel === 'parcial' || normalizedLabel === 'boa' || normalizedLabel === 'moderada') {
    return 'bg-[#fdf6e7] text-[#916a12]';
  }

  return 'bg-[#f5f6f7] text-nutriflow-600';
}

function renderHistory() {
  const container = document.getElementById('historyList');
  const history = state.dashboard?.history || [];

  if (!container) {
    return;
  }

  if (!history.length) {
    container.innerHTML = `
      <div class="px-4 py-5 text-sm text-nutriflow-600">
        Ainda nao ha historico suficiente para comparar seus dias alimentares.
      </div>
    `;
    return;
  }

  container.innerHTML = history.map((item) => `
    <div class="history-row grid grid-cols-[1.2fr_.8fr_.7fr_.7fr] items-center gap-3 px-4 py-4">
      <span class="font-medium text-nutriflow-950">${escapeHtml(item.dateLabel)}</span>
      <span class="text-nutriflow-700">${escapeHtml(item.planLabel)}</span>
      <span class="text-nutriflow-700">${escapeHtml(item.caloriesLabel)}</span>
      <span><span class="rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${getHistoryPillClass(item.checkInLabel)}">${escapeHtml(item.checkInLabel)}</span></span>
    </div>
  `).join('');
}

function renderPlan() {
  const container = document.getElementById('planSections');
  const plan = state.dashboard?.plan;

  if (!container) {
    return;
  }

  if (!plan?.sections?.length) {
    container.innerHTML = '<div class="plan-row text-sm text-nutriflow-600">Nenhum plano alimentar ativo para exibir.</div>';
    return;
  }

  container.innerHTML = `
    <div class="rounded-[24px] border border-[#dbe9d0] bg-[#f6fbf1] p-4">
      <p class="text-xs font-semibold uppercase tracking-[0.16em] text-nutriflow-600">Plano atual</p>
      <p class="mt-2 text-lg font-semibold tracking-[-0.03em] text-nutriflow-950">${escapeHtml(plan.title)}</p>
    </div>
    ${plan.sections.map((section) => `
      <article class="plan-row">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-nutriflow-500">${escapeHtml(section.slotLabel)}</p>
        <h3 class="mt-3 text-lg font-semibold tracking-[-0.03em] text-nutriflow-950">${escapeHtml(section.title)}</h3>
        <p class="mt-2 text-sm leading-7 text-nutriflow-700">${escapeHtml(section.description)}</p>
      </article>
    `).join('')}
  `;
}

function renderBodyMeasurements() {
  const bodyMeasurements = state.dashboard?.bodyMeasurements || {
    latest: [],
    history: [],
  };
  const summaryContainer = document.getElementById('bodyMeasurementsSummary');
  const historyContainer = document.getElementById('bodyMeasurementsHistoryList');

  if (summaryContainer) {
    summaryContainer.innerHTML = bodyMeasurements.latest.length
      ? bodyMeasurements.latest.map((measurement) => `
          <article class="rounded-[24px] border border-nutriflow-200 bg-white p-4">
            <p class="text-xs font-bold uppercase tracking-[0.16em] text-nutriflow-500">${escapeHtml(measurement.label)}</p>
            <p class="mt-3 text-2xl font-bold tracking-[-0.04em] text-nutriflow-950">${escapeHtml(measurement.valueLabel)}</p>
            <p class="mt-2 text-xs font-medium text-nutriflow-600">Ultimo registro: ${escapeHtml(measurement.dateLabel)}</p>
          </article>
        `).join('')
      : '<div class="rounded-[24px] border border-dashed border-nutriflow-200 bg-white px-4 py-5 text-sm text-nutriflow-600 sm:col-span-2 xl:col-span-3">Sua nutricionista ainda nao registrou medidas corporais por avaliacao.</div>';
  }

  if (historyContainer) {
    historyContainer.innerHTML = bodyMeasurements.history.length
      ? bodyMeasurements.history.map((group) => `
          <div class="px-4 py-4">
            <p class="text-xs font-bold uppercase tracking-[0.14em] text-nutriflow-500">${escapeHtml(group.dateLabel)}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              ${group.items.map((measurement) => `
                <span class="rounded-full border border-nutriflow-100 bg-nutriflow-50 px-3 py-2 text-xs font-bold text-nutriflow-950">
                  ${escapeHtml(measurement.label)}: ${escapeHtml(measurement.valueLabel)}
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')
      : '<div class="px-4 py-4 text-sm text-nutriflow-600">Nenhum historico de medidas corporais disponivel ainda.</div>';
  }
}

function renderWeightChart(labels, values) {
  const svg = document.getElementById('weightChart');
  const labelsContainer = document.getElementById('weightChartLabels');

  if (!svg) return;

  if (!values?.length) {
    svg.innerHTML = '<text x="160" y="90" text-anchor="middle" fill="#7a8d70" font-size="13">Sem histórico de peso suficiente</text>';
    return;
  }

  const maxValue = Math.max(...values) + 1;
  const minValue = Math.min(...values) - 1;
  const chartWidth = 280;
  const chartHeight = 112;
  const startX = 20;
  const endX = 300;
  const baseY = 150;
  const stepX = values.length > 1 ? chartWidth / (values.length - 1) : 0;
  
  const points = values.map((value, index) => {
    const x = startX + (stepX * index);
    const progress = (value - minValue) / (maxValue - minValue || 1);
    const y = baseY - (progress * chartHeight);
    return { x, y, value };
  });

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${endX} ${baseY} L ${startX} ${baseY} Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="patientWeightGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#7fb561" stop-opacity="0.34"></stop>
        <stop offset="100%" stop-color="#7fb561" stop-opacity="0"></stop>
      </linearGradient>
    </defs>
    <g stroke="rgba(79,107,61,.12)" stroke-width="1">
      <line x1="12" y1="38" x2="308" y2="38"></line>
      <line x1="12" y1="74" x2="308" y2="74"></line>
      <line x1="12" y1="110" x2="308" y2="110"></line>
      <line x1="12" y1="146" x2="308" y2="146"></line>
    </g>
    <path d="${area}" fill="url(#patientWeightGradient)"></path>
    <path d="${line}" class="weight-chart-line" fill="none" stroke="#4f6b3d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
    ${points.map(p => `
      <circle cx="${p.x}" cy="${p.y}" r="5" fill="#4f6b3d"></circle>
      <text x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="11" fill="#1c2618" font-weight="800">${p.value}kg</text>
    `).join('')}
  `;

  if (labelsContainer) {
    labelsContainer.innerHTML = labels.map(label => `<span>${escapeHtml(label)}</span>`).join('');
  }
}

function renderWeight() {
  const weight = state.dashboard?.weight || {
    labels: [],
    values: [],
    variationLabel: '--',
    currentLabel: '--',
    targetLabel: '--',
    paceLabel: '--',
    initialLabel: '--',
    weeklyAverageLabel: '--',
    trendLabel: '--',
    history: [],
  };

  setTextContent(document.getElementById('weightVariationValue'), weight.variationLabel || '--');
  setTextContent(document.getElementById('currentWeightValue'), weight.currentLabel || '--');
  setTextContent(document.getElementById('targetWeightValue'), weight.targetLabel || '--');
  setTextContent(document.getElementById('paceValue'), weight.paceLabel || '--');
  setTextContent(document.getElementById('initialWeightValue'), weight.initialLabel || '--');
  setTextContent(document.getElementById('weeklyWeightAverageValue'), weight.weeklyAverageLabel || '--');
  setTextContent(document.getElementById('weightTrendValue'), weight.trendLabel || '--');
  renderWeightChart(weight.labels || [], weight.values || []);

  const historyList = document.getElementById('weightHistoryList');
  const history = weight.history || [];

  if (historyList) {
    historyList.innerHTML = history.length
      ? history.map((entry) => `
          <div class="grid grid-cols-[.9fr_.7fr_.7fr_1.4fr] gap-2 px-4 py-3">
            <span>${escapeHtml(entry.dateLabel)}</span>
            <span class="font-bold text-nutriflow-950">${escapeHtml(entry.weightLabel)}</span>
            <span>${escapeHtml(entry.variationLabel)}</span>
            <span class="text-nutriflow-600">${escapeHtml(entry.note || 'Sem observacao')}</span>
          </div>
        `).join('')
      : '<div class="px-4 py-4 text-sm text-nutriflow-600">Nenhum peso registrado ainda.</div>';
  }
}

function renderChat() {
  const chat = state.dashboard?.chat || {
    responseTimeLabel: 'Sem mensagens',
    quickReplies: [],
    messages: [],
  };
  const patient = getPatientData();
  const nutritionist = getNutritionistData();

  setTextContent(document.getElementById('chatResponseTime'), `Resposta media: ${chat.responseTimeLabel}`);

  if (chatMessages) {
    if (!chat.messages.length) {
      chatMessages.innerHTML = `
        <div class="rounded-[24px] border border-dashed border-nutriflow-200 bg-white p-5 text-sm leading-7 text-nutriflow-600">
          Nenhuma mensagem ainda. Use o chat para pedir ajustes no plano ou tirar duvidas.
        </div>
      `;
    } else {
      chatMessages.innerHTML = chat.messages.map((message) => {
        const isUserMessage = message.senderRole === 'PATIENT';

        return `
          <div class="chat-row${isUserMessage ? ' is-user' : ''}">
            ${isUserMessage ? '' : `<div class="chat-avatar">${escapeHtml(getInitials(nutritionist.name))}</div>`}
            <div class="chat-bubble${isUserMessage ? ' is-user' : ''}">
              <p class="${isUserMessage ? 'text-xs font-semibold uppercase tracking-[0.14em] text-white/60' : 'text-xs font-semibold uppercase tracking-[0.14em] text-nutriflow-500'}">
                ${escapeHtml(message.senderName || (isUserMessage ? patient.name : nutritionist.name))} - ${escapeHtml(message.timeLabel || 'agora')}
              </p>
              <p class="mt-2 text-sm leading-7">${escapeHtml(message.content)}</p>
            </div>
          </div>
        `;
      }).join('');

      window.requestAnimationFrame(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      });
    }
  }

  const quickReplies = document.getElementById('quickReplies');

  if (quickReplies) {
    quickReplies.innerHTML = (chat.quickReplies || []).map((reply) => `
      <button class="quick-reply" type="button" data-chat-reply="${escapeHtml(reply)}">${escapeHtml(reply)}</button>
    `).join('');

    quickReplies.querySelectorAll('[data-chat-reply]').forEach((button) => {
      button.addEventListener('click', () => {
        if (!chatInput) {
          return;
        }

        chatInput.value = button.dataset.chatReply || '';
        chatInput.focus();
      });
    });
  }
}

function renderClinical() {
  const clinical = state.dashboard?.clinical || {
    nextAppointment: null,
    checklist: [],
    insight: 'Sem insights disponiveis no momento.',
  };
  const checklist = clinical.checklist || [];
  const pendingItems = checklist.filter((item) => !item.done).length;

  if (clinical.nextAppointment) {
    setTextContent(document.getElementById('nextAppointmentTitle'), clinical.nextAppointment.dateLabel);
    setTextContent(document.getElementById('nextAppointmentDescription'), clinical.nextAppointment.description);
  } else {
    setTextContent(document.getElementById('nextAppointmentTitle'), 'Nenhuma consulta agendada');
    setTextContent(document.getElementById('nextAppointmentDescription'), 'Assim que sua nutricionista marcar um novo acompanhamento, ele vai aparecer aqui.');
  }

  const badgeText = pendingItems > 0
    ? `${pluralize(pendingItems, 'item pendente', 'itens pendentes')}`
    : 'Tudo em dia';
  setTextContent(document.getElementById('clinicalBadge'), badgeText);

  const checklistContainer = document.getElementById('checklistItems');
  if (checklistContainer) {
    if (!checklist.length) {
      checklistContainer.innerHTML = '<li class="text-sm text-nutriflow-600">Nenhum item de acompanhamento disponivel.</li>';
    } else {
      checklistContainer.innerHTML = checklist.map((item) => `
        <li class="flex items-start gap-3">
          ${item.isChallenge && !item.done ? `
            <button type="button" onclick="window.handleCompleteChallenge('${item.id}')" title="Marcar como concluído" class="check-dot mt-1 cursor-pointer hover:bg-nutriflow-300 transition-colors border-2"></button>
          ` : `
            <span class="check-dot${item.done ? ' is-done' : ''} mt-1"></span>
          `}
          <span class="leading-7 ${item.done ? 'text-nutriflow-400 line-through' : ''}">${escapeHtml(item.label)}</span>
        </li>
      `).join('');
    }
  }

  setTextContent(document.getElementById('weeklyInsightText'), clinical.insight || 'Sem insights disponiveis no momento.');
}

window.handleCompleteChallenge = async function(challengeId) {
  try {
    await apiRequest(`/api/patient/challenges/${challengeId}/complete`, { method: 'PATCH' });
    await refreshDashboard();
    showToast('Desafio concluído! Mandou bem!');
  } catch (error) {
    showToast(error.message || 'Erro ao concluir o desafio.');
  }
};

function renderDashboard() {
  renderHeader();
  renderHighlights();
  renderConnectionPanel();
  renderSidebar();
  renderOverview();
  renderGoals();
  renderMeals();
  renderHistory();
  renderPlan();
  renderBodyMeasurements();
  renderWeight();
  renderChat();
  renderClinical();
  renderChallenges()
}

async function refreshDashboard() {
  const payload = await getPatientDashboard();
  applyDashboardState(payload);
  renderDashboard();
  syncPatientRealtimeAvailability();
}

async function syncPatientRealtimeChat(options = {}) {
  if (patientChatSyncInFlight || !getSessionToken() || document.hidden || isSetupRequired()) {
    return;
  }

  patientChatSyncInFlight = true;

  try {
    const payload = await getPatientChat();
    const nextChat = payload?.chat || {
      responseTimeLabel: 'Sem historico',
      quickReplies: [],
      messages: [],
    };
    const nextSignature = getChatSignature(nextChat);

    if (options.forceRender || nextSignature !== state.lastChatSignature) {
      state.dashboard = {
        ...(state.dashboard || {}),
        setupRequired: payload?.setupRequired === true,
        chat: nextChat,
      };
      state.lastChatSignature = nextSignature;
      renderHighlights();
      renderChat();
    }
  } catch (error) {
    if (error.message !== 'Sessao invalida.') {
      // O polling deve ser silencioso em falhas transitórias.
    }
  } finally {
    patientChatSyncInFlight = false;
  }
}

function stopPatientRealtimeChat() {
  if (!patientChatSyncIntervalId) {
    return;
  }

  window.clearInterval(patientChatSyncIntervalId);
  patientChatSyncIntervalId = null;
}

function startPatientRealtimeChat() {
  if (patientChatSyncIntervalId || !getSessionToken() || isSetupRequired()) {
    return;
  }

  patientChatSyncIntervalId = window.setInterval(() => {
    void syncPatientRealtimeChat();
  }, 3500);
}

function syncPatientRealtimeAvailability() {
  if (!getSessionToken() || isSetupRequired()) {
    stopPatientRealtimeChat();
    return;
  }

  startPatientRealtimeChat();
}

function setMealButtonsLoading(isLoading) {
  const label = isLoading ? 'Registrando...' : 'Nova refeicao';
  const quickLabel = isLoading ? 'Registrando...' : 'Nova refeicao';

  [addMealButton, quickAddMealButton].forEach((button) => {
    if (button) {
      button.disabled = isLoading;
    }
  });

  if (addMealButton) {
    addMealButton.textContent = label;
  }

  if (quickAddMealButton) {
    quickAddMealButton.textContent = quickLabel;
  }

  setMealFormLoading(isLoading);
}

function handleAddMeal(options = {}) {
  if (isSetupRequired()) {
    showToast('Conecte sua conta a um nutricionista antes de registrar refeicoes.');
    return;
  }

  if (state.isAddingMeal || !mealEntryModal) {
    return;
  }

  openMealEntryModal(options);
}

async function handleMealFormSubmit(event) {
  event.preventDefault();

  if (isSetupRequired()) {
    showToast('Conecte sua conta a um nutricionista antes de registrar refeicoes.');
    closeMealEntryModal({ resetForm: true });
    return;
  }

  if (state.isAddingMeal) {
    return;
  }

  const payload = getMealPayloadFromForm();
  const validationMessage = validateMealPayload(payload);

  if (validationMessage) {
    setMealFormError(validationMessage);
    return;
  }

  state.isAddingMeal = true;
  setMealButtonsLoading(true);
  setMealFormError('');

  try {
    const result = await createMealEntry(payload);
    await refreshDashboard();
    closeMealEntryModal({ resetForm: true });
    showToast(result.message || 'Refeicao registrada com sucesso.');
  } catch (error) {
    setMealFormError(error.message || 'Nao foi possivel registrar a refeicao.');
  } finally {
    state.isAddingMeal = false;
    setMealButtonsLoading(false);
  }
}

function handleAddWeeklyWeight() {
  if (isSetupRequired()) {
    showToast('Conecte sua conta a um nutricionista antes de registrar peso.');
    return;
  }

  if (state.isSavingWeeklyWeight || !weightEntryModal) {
    return;
  }

  openWeightEntryModal();
}

async function handleWeightFormSubmit(event) {
  event.preventDefault();

  if (isSetupRequired()) {
    showToast('Conecte sua conta a um nutricionista antes de registrar peso.');
    closeWeightEntryModal({ resetForm: true });
    return;
  }

  if (state.isSavingWeeklyWeight) {
    return;
  }

  const payload = getWeeklyWeightPayloadFromForm();
  const validationMessage = validateWeeklyWeightPayload(payload);

  if (validationMessage) {
    setWeightFormError(validationMessage);
    return;
  }

  state.isSavingWeeklyWeight = true;
  setWeightFormLoading(true);
  setWeightFormError('');

  try {
    const result = await createWeeklyWeightEntry(payload);
    await refreshDashboard();
    closeWeightEntryModal({ resetForm: true });
    showToast(result.message || 'Peso semanal registrado com sucesso.');
  } catch (error) {
    setWeightFormError(error.message || 'Nao foi possivel salvar seu peso semanal.');
  } finally {
    state.isSavingWeeklyWeight = false;
    setWeightFormLoading(false);
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();

  if (isSetupRequired()) {
    showToast('Conecte sua conta a um nutricionista antes de usar o chat.');
    return;
  }

  if (!chatInput || state.isSendingMessage) {
    return;
  }

  const content = chatInput.value.trim();

  if (!content) {
    showToast('Digite uma mensagem para enviar.');
    return;
  }

  state.isSendingMessage = true;
  chatInput.disabled = true;

  const submitButton = chatForm?.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Enviando...';
  }

  try {
    const result = await sendPatientMessage({ content });
    chatInput.value = '';
    await refreshDashboard();
    showToast(result.message || 'Mensagem enviada para sua nutricionista.');
  } catch (error) {
    showToast(error.message || 'Nao foi possivel enviar sua mensagem.');
  } finally {
    state.isSendingMessage = false;
    chatInput.disabled = false;

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Enviar';
    }
  }
}

async function handleNutritionistLink(event) {
  event.preventDefault();

  if (state.isLinkingNutritionist) {
    return;
  }

  const nutritionistEmail = patientNutritionistEmail?.value.trim() || '';
  const age = patientConnectionAge?.value.trim() || '';
  const objective = patientConnectionObjective?.value.trim() || '';
  const restrictions = patientConnectionRestrictions?.value.trim() || '';

  if (!nutritionistEmail) {
    showToast('Informe o e-mail do nutricionista para concluir o vinculo.');
    return;
  }

  if (isSetupRequired() && (!age || !objective)) {
    showToast('Informe idade e objetivo para concluir a conexao inicial.');
    return;
  }

  state.isLinkingNutritionist = true;
  renderConnectionPanel();

  try {
    const result = await linkNutritionist({
      nutritionistEmail,
      age,
      objective,
      restrictions,
    });

    persistCurrentUser({
      ...state.currentUser,
      ...result.patient,
      nutritionist: result.patient?.nutritionist,
    });

    await refreshDashboard();
    showToast(result.message || 'Vinculo atualizado com sucesso.');
  } catch (error) {
    showToast(error.message || 'Nao foi possivel concluir o vinculo.');
  } finally {
    state.isLinkingNutritionist = false;
    renderConnectionPanel();
  }
}

function bindNavigationState() {
  document.querySelectorAll('.mobile-nav-pill').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-pill').forEach((item) => {
        item.classList.remove('is-active');
      });
      button.classList.add('is-active');
    });
  });
}

function bindMealModalEvents() {
  mealEntryForm?.addEventListener('submit', handleMealFormSubmit);

  mealEntryForm?.addEventListener('input', () => {
    if (!state.isAddingMeal) {
      setMealFormError('');
    }
  });

  document.querySelectorAll('[data-close-meal-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.isAddingMeal) {
        closeMealEntryModal({ resetForm: false });
      }
    });
  });

  document.querySelectorAll('[data-meal-template]').forEach((button) => {
    button.addEventListener('click', () => {
      applyMealTemplate(button.dataset.mealTemplate);
    });
  });

  mealEntryModal?.addEventListener('click', (event) => {
    if (event.target === mealEntryModal && !state.isAddingMeal) {
      closeMealEntryModal({ resetForm: false });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mealEntryModal && !mealEntryModal.classList.contains('hidden') && !state.isAddingMeal) {
      closeMealEntryModal({ resetForm: false });
    }
  });
}

function bindWeightModalEvents() {
  weightEntryForm?.addEventListener('submit', handleWeightFormSubmit);

  weightEntryForm?.addEventListener('input', () => {
    if (!state.isSavingWeeklyWeight) {
      setWeightFormError('');
    }
  });

  document.querySelectorAll('[data-close-weight-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.isSavingWeeklyWeight) {
        closeWeightEntryModal({ resetForm: false });
      }
    });
  });

  weightEntryModal?.addEventListener('click', (event) => {
    if (event.target === weightEntryModal && !state.isSavingWeeklyWeight) {
      closeWeightEntryModal({ resetForm: false });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && weightEntryModal && !weightEntryModal.classList.contains('hidden') && !state.isSavingWeeklyWeight) {
      closeWeightEntryModal({ resetForm: false });
    }
  });
}

function bindEvents() {
  logoutButton?.addEventListener('click', clearSessionAndRedirect);
  addMealButton?.addEventListener('click', () => handleAddMeal());
  quickAddMealButton?.addEventListener('click', () => handleAddMeal({ templateKey: 'lanche-rapido' }));
  addWeeklyWeightButton?.addEventListener('click', handleAddWeeklyWeight);
  chatForm?.addEventListener('submit', handleChatSubmit);
  patientConnectionForm?.addEventListener('submit', handleNutritionistLink);
  bindMealModalEvents();
  bindWeightModalEvents();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void syncPatientRealtimeChat({ forceRender: true });
    }
  });
  window.addEventListener('focus', () => {
    void syncPatientRealtimeChat({ forceRender: true });
  });
  window.addEventListener('beforeunload', stopPatientRealtimeChat);
  bindNavigationState();
}

async function init() {
  if (!ensurePatientAccess()) {
    return;
  }

  renderHeader();
  bindEvents();
  window.NutriFlowUi?.setupSectionNavigation({ linkSelector: '.sidebar-link, .mobile-nav-pill' });

  try {
    await refreshDashboard();
  } catch (error) {
    showToast(error.message || 'Nao foi possivel carregar o dashboard do paciente.');
  }
}

// --- FUNÇÕES DO CHAT FLUTUANTE ---
function toggleChat() {
  const chat = document.getElementById('floatingChat');
  if (chat.classList.contains('chat-hidden')) {
    chat.classList.remove('chat-hidden');
    chat.classList.add('chat-visible');
    // Rola para o final quando abre
    const msgs = document.getElementById('chatMessages');
    if(msgs) msgs.scrollTop = msgs.scrollHeight;
  } else {
    chat.classList.add('chat-hidden');
    chat.classList.remove('chat-visible');
  }
}

// --- FUNÇÕES DO PERFIL DO PACIENTE ---
function openPatientSettingsModal() {
  const patient = getPatientData();
  document.getElementById('profileNameInput').value = patient.name || '';
  document.getElementById('profileAgeInput').value = patient.age || '';
  document.getElementById('profileWeightInput').value = patient.weight || '';
  document.getElementById('profileHeightInput').value = patient.height || '';
  document.getElementById('profileObjectiveInput').value = patient.objective || '';
  document.getElementById('profileRestrictionsInput').value = patient.restrictions || '';

  const modal = document.getElementById('patientSettingsModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.classList.add('modal-open');
}

function closePatientSettingsModal() {
  const modal = document.getElementById('patientSettingsModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.classList.remove('modal-open');
}

async function handlePatientSettingsSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('profileSubmitBtn');
  btn.textContent = 'Salvando...';
  btn.disabled = true;

  const payload = {
    name: document.getElementById('profileNameInput').value,
    age: document.getElementById('profileAgeInput').value,
    weight: document.getElementById('profileWeightInput').value,
    height: document.getElementById('profileHeightInput').value,
    objective: document.getElementById('profileObjectiveInput').value,
    restrictions: document.getElementById('profileRestrictionsInput').value,
  };

  try {
    const result = await updatePatientProfile(payload);

    if (result.dashboard) {
      applyDashboardState(result.dashboard);
      renderDashboard();
    }

    showToast(result.message || 'Perfil atualizado com sucesso!');
    closePatientSettingsModal();
  } catch (error) {
    showToast(error.message || 'Nao foi possivel atualizar o perfil.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar Perfil';
  }
} 

function renderChallenges() {
  const container = document.getElementById('activeChallengesList');
  const challenges = state.dashboard?.clinical?.checklist?.filter(item => item.isChallenge) || [];

  if (!container) return;

  if (!challenges.length) {
    container.innerHTML = '<p class="text-xs text-nutriflow-500 italic">Nenhum desafio ativo no momento.</p>';
    return;
  }

  container.innerHTML = challenges.map(item => `
    <div class="flex items-center justify-between p-3 rounded-2xl bg-white border border-nutriflow-100 shadow-sm">
      <div class="flex items-center gap-3">
        <button type="button" 
                onclick="window.handleCompleteChallenge('${item.id}')" 
                class="w-6 h-6 rounded-full border-2 border-nutriflow-200 flex items-center justify-center transition-all ${item.done ? 'bg-nutriflow-400 border-nutriflow-400' : 'hover:border-nutriflow-400'}"
                ${item.done ? 'disabled' : ''}>
          ${item.done ? '<span class="text-white text-xs">✓</span>' : ''}
        </button>
        <span class="text-sm font-semibold ${item.done ? 'text-nutriflow-400 line-through' : 'text-nutriflow-950'}">${escapeHtml(item.label)}</span>
      </div>
      ${item.done ? '<span class="text-[10px] font-bold text-nutriflow-400 uppercase">Feito!</span>' : ''}
    </div>
  `).join('');
}

init();
