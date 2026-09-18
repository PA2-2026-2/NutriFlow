const {
  createApiClient,
  createSessionManager,
  createToastController,
  escapeHtml,
  formatSidebarDate: formatCoreSidebarDate,
  getInitials,
} = window.NutriFlowCore;

const session = createSessionManager({ redirectTo: 'index.html' });

const apiRequest = createApiClient({
  getToken: session.getToken,
  onUnauthorized(message) {
    showToast(message || 'Sua sessão expirou.');
    window.setTimeout(session.clear, 800);
  }
});

const state = {
  currentUser: session.getUser(),
  patients: [],
  selectedPatientId: null,
  activeFilterId: null, // Novo: Guarda se estamos filtrando a tela por um paciente
  activeChallengeId: null, // Para adicionar pacientes a desafios
  mealPlans: [], assessments: [], appointments: [], challenges: [], messages: [], foods: [], reminders: [],
  chatPatientId: null,
  activeConversation: null,
  lastConversationSignature: '',
  isSendingChatMessage: false,
  isLoadingConversation: false,
};

const APPOINTMENT_STATUS_LABELS = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  remarcada: 'Remarcada',
  faltou: 'Faltou',
};

const toast = document.getElementById('nutritionistToast');
const toastController = createToastController(toast, { duration: 3000 });
const chatModal = document.getElementById('floatingChat');
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSubmitButton = document.getElementById('chatSubmitBtn');
const chatPatientSelect = document.getElementById('chatPatientSelect');
let nutritionistChatSyncIntervalId = null;
let nutritionistChatSyncInFlight = false;

if (chatInput) {
  chatInput.maxLength = 500;
}

function showToast(message) { toastController.show(message); }
function ensureNutritionistAccess() { return session.ensureAuthenticated(); }

function getChatConversationMetaElement() {
  let element = document.getElementById('chatConversationMeta');

  if (element) {
    return element;
  }

  const headerGroup = document.querySelector('#floatingChat h3')?.parentElement;

  if (!headerGroup) {
    return null;
  }

  element = document.createElement('p');
  element.id = 'chatConversationMeta';
  element.className = 'mt-1 text-[11px] text-white/65';
  headerGroup.appendChild(element);
  return element;
}

function clearActiveConversation() {
  state.activeConversation = null;
  state.lastConversationSignature = '';
}

function ensureValidPatientSelections() {
  const patientIds = new Set(state.patients.map((patient) => patient.id));

  if (!state.patients.length) {
    state.selectedPatientId = null;
    state.activeFilterId = null;
    state.chatPatientId = null;
    clearActiveConversation();
    return;
  }

  if (!patientIds.has(state.selectedPatientId)) {
    state.selectedPatientId = state.patients[0].id;
  }

  if (state.activeFilterId && !patientIds.has(state.activeFilterId)) {
    state.activeFilterId = null;
  }

  if (!patientIds.has(state.chatPatientId)) {
    state.chatPatientId = state.selectedPatientId;
    clearActiveConversation();
  }

  if (state.activeConversation && state.activeConversation.patient?.id !== state.chatPatientId) {
    clearActiveConversation();
  }
}

function getChatPatient() {
  return state.patients.find((patient) => patient.id === state.chatPatientId) || null;
}

function buildConversationSignature(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const latestMessage = messages[messages.length - 1] || null;

  return JSON.stringify({
    patientId: conversation?.patient?.id || '',
    count: messages.length,
    latestId: latestMessage?.id || '',
    latestRole: latestMessage?.senderRole || '',
    latestTime: latestMessage?.timeLabel || '',
    pendingMessages: conversation?.patient?.pendingMessages || 0,
  });
}

function updateChatPatientSummary(conversation) {
  const patient = state.patients.find((item) => item.id === conversation?.patient?.id);

  if (!patient || !conversation?.patient) {
    return;
  }

  patient.pendingMessages = conversation.patient.pendingMessages || 0;
  patient.lastMessageTime = conversation.patient.latestMessageTime || '';
}

async function fetchConversation(patientId) {
  return apiRequest(`/api/nutritionist/conversation?patientId=${encodeURIComponent(patientId)}`);
}

async function sendNutritionistChatMessage(payload) {
  return apiRequest('/api/nutritionist/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// BUSCANDO DADOS 
async function fetchDatabaseData() {
  try {
    const data = await apiRequest('/api/nutritionist/dashboard');
    state.patients = data.patients || [];
    state.mealPlans = data.mealPlans || [];
    state.assessments = data.assessments || [];
    state.appointments = data.appointments || [];
    state.reminders = data.reminders || [];
    state.challenges = data.challenges || [];
    state.messages = data.messages || [];
    state.foods = data.foods || [];

    ensureValidPatientSelections();
    renderAll();
    await syncNutritionistRealtimeChat({ forceRender: true, allowHidden: true, silent: true });
  } catch (error) { showToast('Erro ao conectar ao banco de dados.'); }
}

function renderAll() {
  renderHeader();
  renderPatientsList();
  renderSelectedPatient();
  renderGeneralLists();
  populatePatientSelects();
  renderChatPanel();
}

function renderHeader() {
  const currentUser = state.currentUser || session.getUser() || { name: 'Nutricionista' };
  document.querySelectorAll('[data-nutritionist-name]').forEach(el => el.textContent = currentUser.name);
  document.querySelectorAll('[data-nutritionist-initial]').forEach(el => el.textContent = getInitials(currentUser.name));
  document.querySelector('[data-sidebar-date]').textContent = formatCoreSidebarDate();
  document.querySelector('[data-header-greeting]').textContent = `Olá, ${currentUser.name}`;
}

function renderPatientsList() {
  const list = document.getElementById('patientsList');
  if (!list) return;
  list.innerHTML = '';
  
  if (state.patients.length === 0) {
    document.getElementById('emptyPatientsState').classList.remove('hidden');
    return;
  } else { document.getElementById('emptyPatientsState').classList.add('hidden'); }

  state.patients.forEach((patient) => {
    const patientName = patient.name || 'Paciente';
    const isSelected = patient.id === state.selectedPatientId;
    const isFiltered = patient.id === state.activeFilterId;
    const pendingMessages = Number(patient.pendingMessages || 0);
    const pendingBadge = pendingMessages > 0
      ? `<span class="inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-700">${pendingMessages} nova${pendingMessages === 1 ? '' : 's'}</span>`
      : '';
    const lastMessageTime = patient.lastMessageTime
      ? `<span class="text-[11px] font-semibold text-nutriflow-500">Chat ${escapeHtml(patient.lastMessageTime)}</span>`
      : '';
    
    const row = document.createElement('div');
    row.className = `p-4 flex items-center justify-between hover:bg-nutriflow-50 cursor-pointer transition ${isSelected ? 'bg-nutriflow-50 border-l-4 border-nutriflow-500' : ''} ${isFiltered ? 'ring-2 ring-nutriflow-200' : ''}`;
    
    row.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-xl bg-nutriflow-100 text-sm font-bold text-nutriflow-900">${getInitials(patientName)}</div>
        <div>
          <p class="font-bold text-nutriflow-950 text-sm">${escapeHtml(patientName)}</p>
          <div class="mt-1 flex flex-wrap gap-2">${pendingBadge}${lastMessageTime}</div>
          <p class="text-xs text-nutriflow-600">${patient.objective || 'Em avaliação'}</p>
        </div>
      </div>
      <button class="text-xs bg-nutriflow-950 text-white px-3 py-1 rounded-lg font-bold" onclick="window.openPatientProfile('${patient.id}')">Perfil</button>
    `;
    
    row.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        state.selectedPatientId = patient.id;
        state.activeFilterId = patient.id; // Ativa o filtro para este paciente!
        state.chatPatientId = patient.id;
        clearActiveConversation();
        renderAll(); // Re-renderiza a tela para aplicar o filtro
        void syncNutritionistRealtimeChat({ forceRender: true, allowHidden: true, silent: true });
      }
    });
    list.appendChild(row);
  });
}

function renderSelectedPatient() {
  const patient = state.patients.find(p => p.id === state.selectedPatientId);

  if (!patient) {
    document.getElementById('selectedPatientName').textContent = 'Nenhum selecionado';
    document.getElementById('selectedPatientWeight').textContent = '--';
    document.getElementById('selectedPatientHeight').textContent = '--';
    document.getElementById('selectedPatientBodyFat').textContent = '--';
    document.getElementById('selectedPatientViewButton').onclick = null;
    document.getElementById('btnClearSelection')?.classList.add('hidden');
    return;
  }
  
  document.getElementById('selectedPatientName').textContent = patient.name;
  document.getElementById('selectedPatientWeight').textContent = patient.weight ? `${patient.weight}kg` : '--';
  document.getElementById('selectedPatientHeight').textContent = patient.height ? `${patient.height}m` : '--';
  document.getElementById('selectedPatientBodyFat').textContent = patient.bodyFat ? `${patient.bodyFat}%` : '--';
  document.getElementById('selectedPatientViewButton').onclick = () => window.openPatientProfile(patient.id);

  const clearBtn = document.getElementById('btnClearSelection');
  if (clearBtn) {
    if (state.activeFilterId) {
      clearBtn.classList.remove('hidden');
      clearBtn.onclick = () => { state.activeFilterId = null; renderAll(); };
    } else {
      clearBtn.classList.add('hidden');
    }
  }
}

function renderPatientProfileModal(patient) {
  if (!patient) return;
  document.getElementById('patientProfileName').textContent = patient.name;
  document.getElementById('patientProfileMeta').textContent = `${patient.age || '--'} anos • ${patient.objective || 'Em avaliação'} • ${patient.restrictions || 'Sem restrições'}`;
  
  const patientPlans = state.mealPlans.filter(p => p.patientId === patient.id);
  document.getElementById('patientProfilePlanTitle').textContent = patientPlans[0]?.title || 'Sem plano ativo';

  const historyContainer = document.getElementById('patientProfileWeightHistory');
  const patientAssessments = state.assessments.filter(a => a.patientId === patient.id);
  const patientWeights = patient.weightEntries || [];
  if (historyContainer) {
    historyContainer.innerHTML = patientWeights.length
      ? patientWeights.slice(-5).reverse().map(entry => `<span class="bg-white border px-3 py-1 rounded-lg text-sm font-bold text-nutriflow-950">${entry.weight}kg <small class="text-nutriflow-500">${entry.date}</small></span>`).join('')
      : patientAssessments.length
        ? patientAssessments.slice(0, 3).map(a => `<span class="bg-white border px-3 py-1 rounded-lg text-sm font-bold text-nutriflow-950">${a.weight}kg</span>`).join('')
      : '<span class="text-xs text-nutriflow-500 font-bold">Sem registros</span>';
  }

  const bodyMeasurements = patient.bodyMeasurements || { latest: [], history: [] };
  const measurementsContainer = document.getElementById('patientProfileBodyMeasurements');
  if (measurementsContainer) {
    measurementsContainer.innerHTML = bodyMeasurements.latest?.length
      ? bodyMeasurements.latest.map((measurement) => `
          <div class="rounded-xl border border-nutriflow-100 bg-nutriflow-50 px-3 py-3">
            <p class="text-[11px] font-bold uppercase tracking-[0.12em] text-nutriflow-500">${escapeHtml(measurement.label)}</p>
            <p class="mt-2 text-base font-bold text-nutriflow-950">${escapeHtml(measurement.valueLabel)}</p>
            <p class="text-[11px] text-nutriflow-500">${escapeHtml(measurement.dateLabel)}</p>
          </div>
        `).join('')
      : '<p class="text-xs text-nutriflow-500">Nenhuma medida corporal registrada ainda.</p>';
  }

  const measurementsHistoryContainer = document.getElementById('patientProfileBodyMeasurementHistory');
  if (measurementsHistoryContainer) {
    measurementsHistoryContainer.innerHTML = bodyMeasurements.history?.length
      ? bodyMeasurements.history.map((group) => `
          <div class="rounded-xl border border-nutriflow-100 bg-nutriflow-50 px-3 py-3">
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-nutriflow-500">${escapeHtml(group.dateLabel)}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              ${group.items.map((measurement) => `
                <span class="rounded-full border border-white bg-white px-3 py-1 text-xs font-bold text-nutriflow-950">
                  ${escapeHtml(measurement.label)}: ${escapeHtml(measurement.valueLabel)}
                </span>
              `).join('')}
            </div>
          </div>
        `).join('')
      : '<p class="text-xs text-nutriflow-500">Sem historico de medidas complementares por enquanto.</p>';
  }

  const mealsList = document.getElementById('patientProfileMealsList');
  if (mealsList) {
    if (patient.mealEntries && patient.mealEntries.length > 0) {
      mealsList.innerHTML = patient.mealEntries.map(meal => `
        <div class="border-b pb-2 mb-2">
          <p class="text-xs font-bold text-nutriflow-500 uppercase">${meal.mealType} - ${new Date(meal.loggedAt).toLocaleDateString()}</p>
          <p class="text-sm font-bold text-nutriflow-950">${meal.title}</p>
          <p class="text-xs text-nutriflow-600">${meal.calories} kcal • ${meal.protein}g Prot • ${meal.carbs}g Carb</p>
        </div>
      `).join('');
    } else {
      mealsList.innerHTML = '<p class="text-xs text-nutriflow-500">O paciente ainda não registrou refeições no painel dele.</p>';
    }
  }
}

// RENDERIZAÇÃO DAS LISTAS COM FILTRO E BOTÕES DE AÇÃO
const MEAL_PLAN_MEAL_TIMES = [
  'Cafe da manha',
  'Lanche da manha',
  'Almoco',
  'Lanche da tarde',
  'Jantar',
  'Ceia',
];

function getFoodById(foodId) {
  return state.foods.find((food) => food.id === foodId) || null;
}

function buildFoodOptions(selectedFoodId = '') {
  if (!state.foods.length) {
    return '<option value="">Base de alimentos vazia</option>';
  }

  return '<option value="">Selecione um alimento</option>' + state.foods.map((food) => `
    <option value="${food.id}" ${food.id === selectedFoodId ? 'selected' : ''}>${escapeHtml(food.name)}</option>
  `).join('');
}

function buildMealTimeOptions(selectedMealTime = 'Almoco') {
  return MEAL_PLAN_MEAL_TIMES.map((mealTime) => `
    <option value="${mealTime}" ${mealTime === selectedMealTime ? 'selected' : ''}>${mealTime}</option>
  `).join('');
}

function toDateInputValue(date = new Date()) {
  const baseDate = date instanceof Date ? date : new Date(date || Date.now());
  const timezoneOffset = baseDate.getTimezoneOffset() * 60000;
  return new Date(baseDate.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function getSelectedPatient() {
  return state.patients.find((patient) => patient.id === state.selectedPatientId) || state.patients[0] || null;
}

function getAssessmentMeasurementsPayload(options = {}) {
  const allowIncomplete = options.allowIncomplete === true;

  return Array.from(document.querySelectorAll('[data-assessment-measurement-row]')).map((row) => {
    const label = row.querySelector('[data-assessment-measurement-label]')?.value || '';
    const value = row.querySelector('[data-assessment-measurement-value]')?.value || '';
    const unit = row.querySelector('[data-assessment-measurement-unit]')?.value || '';

    return {
      label: label.trim(),
      value: value.trim(),
      unit: unit.trim(),
    };
  }).filter((measurement) => (
    allowIncomplete
      ? (measurement.label || measurement.value || measurement.unit)
      : (measurement.label && measurement.value)
  ));
}

function addAssessmentMeasurementRow(measurement = {}) {
  const list = document.getElementById('assessmentMeasurementsList');

  if (!list) {
    return;
  }

  const row = document.createElement('div');
  row.className = 'grid gap-2 rounded-lg border border-white bg-white p-2 shadow-sm md:grid-cols-[1.2fr_140px_110px_auto]';
  row.dataset.assessmentMeasurementRow = 'true';
  row.innerHTML = `
    <input class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-assessment-measurement-label type="text" maxlength="40" placeholder="Ex: Cintura" value="${escapeHtml(measurement.label || '')}" />
    <input class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-assessment-measurement-value type="number" min="0.1" max="500" step="0.1" placeholder="82.5" value="${escapeHtml(String(measurement.value || ''))}" />
    <input class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-assessment-measurement-unit type="text" maxlength="12" placeholder="cm" value="${escapeHtml(measurement.unit || 'cm')}" />
    <button class="rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-500" type="button" data-remove-assessment-measurement>Remover</button>
  `;

  row.querySelector('[data-remove-assessment-measurement]')?.addEventListener('click', () => {
    row.remove();
  });

  list.appendChild(row);
}

function resetAssessmentForm() {
  document.getElementById('assessmentForm')?.reset();

  const patient = getSelectedPatient();
  const patientSelect = document.getElementById('assessmentPatient');
  const dateInput = document.getElementById('assessmentDate');
  const weightInput = document.getElementById('assessmentWeight');
  const heightInput = document.getElementById('assessmentHeight');
  const bodyFatInput = document.getElementById('assessmentBodyFat');
  const measurementsList = document.getElementById('assessmentMeasurementsList');

  if (patientSelect && patient?.id) {
    patientSelect.value = patient.id;
  }

  if (dateInput) {
    dateInput.value = toDateInputValue(new Date());
  }

  if (weightInput) {
    weightInput.value = patient?.weight || '';
  }

  if (heightInput) {
    heightInput.value = patient?.height || '';
  }

  if (bodyFatInput) {
    bodyFatInput.value = patient?.bodyFat || '';
  }

  if (measurementsList) {
    measurementsList.innerHTML = '';
  }
}

function getMealPlanItemsPayload(options = {}) {
  const allowIncomplete = options.allowIncomplete === true;

  return Array.from(document.querySelectorAll('[data-meal-plan-item-row]')).map((row) => {
    const foodId = row.querySelector('[data-plan-food]')?.value || '';
    const quantity = Number(row.querySelector('[data-plan-quantity]')?.value || 0);
    const mealTime = row.querySelector('[data-plan-meal-time]')?.value || 'Refeicao';

    return { foodId, quantity, mealTime };
  }).filter((item) => allowIncomplete || (item.foodId && Number.isFinite(item.quantity) && item.quantity > 0));
}

function updateMealPlanTotals() {
  const totals = getMealPlanItemsPayload({ allowIncomplete: true }).reduce((accumulator, item) => {
    const food = getFoodById(item.foodId);

    if (!food || !Number.isFinite(item.quantity)) {
      return accumulator;
    }

    const factor = item.quantity / 100;
    accumulator.calories += Math.round(food.calories * factor);
    accumulator.protein += Math.round(food.protein * factor);
    accumulator.carbs += Math.round(food.carbs * factor);
    accumulator.fats += Math.round(food.fat * factor);
    return accumulator;
  }, {
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
  });

  document.getElementById('mealPlanCalories').value = totals.calories;
  document.getElementById('mealPlanProtein').value = totals.protein;
  document.getElementById('mealPlanCarbs').value = totals.carbs;
  document.getElementById('mealPlanFats').value = totals.fats;
}

function addMealPlanItemRow(item = {}) {
  const list = document.getElementById('mealPlanItemsList');

  if (!list) return;

  const row = document.createElement('div');
  row.className = 'grid gap-2 rounded-lg border border-white bg-white p-2 shadow-sm md:grid-cols-[1.1fr_120px_1fr_auto]';
  row.dataset.mealPlanItemRow = 'true';
  row.innerHTML = `
    <select class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-plan-food required>
      ${buildFoodOptions(item.foodId || '')}
    </select>
    <input class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-plan-quantity type="number" min="1" max="2000" step="1" value="${item.quantity || 100}" required />
    <select class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-plan-meal-time required>
      ${buildMealTimeOptions(item.mealTime || 'Almoco')}
    </select>
    <button class="rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-500" type="button" data-remove-plan-item>Remover</button>
  `;

  row.querySelectorAll('select, input').forEach((field) => {
    field.addEventListener('input', updateMealPlanTotals);
    field.addEventListener('change', updateMealPlanTotals);
  });
  row.querySelector('[data-remove-plan-item]')?.addEventListener('click', () => {
    row.remove();

    if (!document.querySelectorAll('[data-meal-plan-item-row]').length) {
      addMealPlanItemRow();
      return;
    }

    updateMealPlanTotals();
  });

  list.appendChild(row);
  updateMealPlanTotals();
}

function resetMealPlanBuilder(plan = null) {
  const list = document.getElementById('mealPlanItemsList');
  if (!list) return;

  list.innerHTML = '';
  const items = plan?.items?.length ? plan.items : [{ mealTime: 'Almoco', quantity: 100 }];
  items.forEach((item) => addMealPlanItemRow(item));
  document.getElementById('mealPlanNotes').value = plan?.notes || '';
  updateMealPlanTotals();
}

function getPendingMessagesLabel(count) {
  if (!count) {
    return 'Conversa em dia.';
  }

  return count === 1
    ? '1 mensagem aguardando resposta.'
    : `${count} mensagens aguardando resposta.`;
}

function syncChatComposerState(patient) {
  const isLoadingLocked = state.isLoadingConversation && !state.activeConversation;
  const isDisabled = !patient || state.isSendingChatMessage || isLoadingLocked;

  if (chatInput) {
    chatInput.disabled = isDisabled;
    chatInput.placeholder = patient
      ? `Responder ${patient.name}...`
      : 'Selecione um paciente para iniciar o chat';
  }

  if (chatSubmitButton) {
    chatSubmitButton.disabled = isDisabled;
    chatSubmitButton.textContent = state.isSendingChatMessage ? 'Enviando...' : 'Enviar';
    chatSubmitButton.classList.toggle('opacity-50', isDisabled);
    chatSubmitButton.classList.toggle('cursor-not-allowed', isDisabled);
  }
}

function renderChatPanel(options = {}) {
  const patient = getChatPatient();
  const conversation = state.activeConversation;
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const metaElement = getChatConversationMetaElement();

  if (chatPatientSelect && chatPatientSelect.value !== (state.chatPatientId || '')) {
    chatPatientSelect.value = state.chatPatientId || '';
  }

  if (metaElement) {
    if (!patient) {
      metaElement.textContent = 'Selecione um paciente para carregar a conversa.';
    } else if (state.isLoadingConversation && !conversation) {
      metaElement.textContent = `Carregando conversa com ${patient.name}...`;
    } else if (conversation?.patient?.pendingMessages) {
      metaElement.textContent = getPendingMessagesLabel(conversation.patient.pendingMessages);
    } else if (conversation?.patient?.latestMessageTime) {
      metaElement.textContent = `Ultima atividade: ${conversation.patient.latestMessageTime}`;
    } else {
      metaElement.textContent = `Sem mensagens com ${patient.name} ainda.`;
    }
  }

  syncChatComposerState(patient);

  if (!chatMessages) {
    return;
  }

  if (!patient) {
    chatMessages.innerHTML = '<p class="mt-10 text-center text-xs text-nutriflow-500">Selecione um paciente para iniciar.</p>';
    return;
  }

  if (state.isLoadingConversation && !conversation) {
    chatMessages.innerHTML = '<p class="mt-10 text-center text-xs font-bold uppercase tracking-[0.12em] text-nutriflow-500">Carregando conversa...</p>';
    return;
  }

  if (!messages.length) {
    chatMessages.innerHTML = `
      <div class="rounded-[24px] border border-dashed border-nutriflow-200 bg-white p-5 text-sm leading-7 text-nutriflow-600">
        Nenhuma mensagem com ${escapeHtml(patient.name)} ainda. Use o campo abaixo para iniciar a conversa.
      </div>
    `;
    return;
  }

  chatMessages.innerHTML = messages.map((message) => {
    const isNutritionistMessage = message.senderRole === 'NUTRITIONIST';
    const senderName = message.senderName || (isNutritionistMessage ? state.currentUser?.name : patient.name);

    return `
      <div class="chat-row${isNutritionistMessage ? ' is-user' : ''}">
        ${isNutritionistMessage ? '' : `<div class="chat-avatar">${escapeHtml(getInitials(patient.name))}</div>`}
        <div class="chat-bubble${isNutritionistMessage ? ' is-user' : ''}">
          <p class="${isNutritionistMessage ? 'text-xs font-semibold uppercase tracking-[0.14em] text-white/60' : 'text-xs font-semibold uppercase tracking-[0.14em] text-nutriflow-500'}">
            ${escapeHtml(senderName)} - ${escapeHtml(message.timeLabel || 'agora')}
          </p>
          <p class="mt-2 text-sm leading-7">${escapeHtml(message.content)}</p>
          ${!isNutritionistMessage && message.pending ? '<span class="mt-2 inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700">Aguardando resposta</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  if (options.scrollToEnd !== false) {
    window.requestAnimationFrame(() => {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }
}

async function syncNutritionistRealtimeChat(options = {}) {
  const patientId = String(options.patientId || state.chatPatientId || '').trim();

  if (!patientId || nutritionistChatSyncInFlight || !session.getToken() || (document.hidden && !options.allowHidden)) {
    return;
  }

  const requestedPatientId = patientId;
  nutritionistChatSyncInFlight = true;
  state.isLoadingConversation = true;

  if (options.forceRender) {
    renderChatPanel();
  }

  try {
    const conversation = await fetchConversation(requestedPatientId);

    if (state.chatPatientId && state.chatPatientId !== requestedPatientId && !options.overrideSelection) {
      return;
    }

    state.chatPatientId = requestedPatientId;
    updateChatPatientSummary(conversation);

    const nextSignature = buildConversationSignature(conversation);
    const shouldRender = options.forceRender || nextSignature !== state.lastConversationSignature || !state.activeConversation;

    state.activeConversation = conversation;
    state.lastConversationSignature = nextSignature;

    if (shouldRender) {
      renderPatientsList();
      renderSelectedPatient();
      populatePatientSelects();
      renderChatPanel();
    }
  } catch (error) {
    if (!options.silent && error.message !== 'Sessao invalida.') {
      showToast(error.message || 'Nao foi possivel carregar a conversa.');
    }
  } finally {
    state.isLoadingConversation = false;
    nutritionistChatSyncInFlight = false;
    renderChatPanel({ scrollToEnd: false });
  }
}

function stopNutritionistRealtimeChat() {
  if (!nutritionistChatSyncIntervalId) {
    return;
  }

  window.clearInterval(nutritionistChatSyncIntervalId);
  nutritionistChatSyncIntervalId = null;
}

function startNutritionistRealtimeChat() {
  if (nutritionistChatSyncIntervalId || !session.getToken()) {
    return;
  }

  nutritionistChatSyncIntervalId = window.setInterval(() => {
    void syncNutritionistRealtimeChat({ silent: true });
  }, 3500);
}

function syncNutritionistRealtimeAvailability() {
  if (!session.getToken()) {
    stopNutritionistRealtimeChat();
    return;
  }

  startNutritionistRealtimeChat();
}

async function handleNutritionistChatSubmit(event) {
  event.preventDefault();

  const patient = getChatPatient();
  const content = chatInput?.value.trim() || '';

  if (!patient) {
    showToast('Selecione um paciente para enviar a mensagem.');
    return;
  }

  if (!content) {
    showToast('Digite uma mensagem para enviar.');
    chatInput?.focus();
    return;
  }

  state.isSendingChatMessage = true;
  renderChatPanel();

  try {
    const result = await sendNutritionistChatMessage({
      patientId: patient.id,
      content,
    });

    if (chatInput) {
      chatInput.value = '';
    }

    await syncNutritionistRealtimeChat({
      patientId: patient.id,
      forceRender: true,
      allowHidden: true,
      silent: true,
      overrideSelection: true,
    });

    showToast(result.message || 'Resposta enviada para o paciente.');
  } catch (error) {
    showToast(error.message || 'Nao foi possivel enviar a resposta.');
  } finally {
    state.isSendingChatMessage = false;
    renderChatPanel();
    chatInput?.focus();
  }
}

function renderGeneralLists() {
  const pId = state.activeFilterId;

  // Filtra as listas se um paciente estiver selecionado
  const plans = pId ? state.mealPlans.filter(p => p.patientId === pId) : state.mealPlans;
  const asss = pId ? state.assessments.filter(a => a.patientId === pId) : state.assessments;
  const apps = pId ? state.appointments.filter(a => a.patientId === pId) : state.appointments;

  const plansContainer = document.getElementById('latestMealPlans');
  plansContainer.innerHTML = plans.length ? plans.map(plan => `
      <div class="bg-white border rounded-xl p-3 shadow-sm relative group">
        <p class="text-xs font-bold text-nutriflow-500 uppercase">${plan.patient}</p>
        <p class="text-sm font-bold text-nutriflow-950 mt-1 pr-12">${plan.title}</p>
        <p class="text-xs font-semibold text-nutriflow-600">${plan.calories} kcal - ${plan.protein}g prot - ${plan.carbs || 0}g carb - ${plan.fats || 0}g gord</p>
        <p class="mt-1 text-xs text-nutriflow-500">${plan.items?.length ? `${plan.items.length} alimentos cadastrados` : 'Sem alimentos detalhados'}</p>
        <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
           <button onclick="window.duplicatePlan('${plan.id}')" title="Reaproveitar Plano" class="p-1 text-nutriflow-500 hover:text-nutriflow-900">📋</button>
           <button onclick="window.deleteResource('meal-plans', '${plan.id}')" title="Excluir" class="p-1 text-red-400 hover:text-red-600">🗑️</button>
        </div>
      </div>
    `).join('') : '<p class="text-sm text-nutriflow-500">Nenhum plano encontrado.</p>';

  const assContainer = document.getElementById('latestAssessments');
  assContainer.innerHTML = asss.length ? asss.map(ass => `
      <div class="bg-white border rounded-xl p-3 shadow-sm relative group">
        <p class="text-xs font-bold text-nutriflow-500 uppercase">${ass.patient}</p>
        <p class="text-sm font-bold text-nutriflow-950 mt-1">Peso: ${ass.weight}kg</p>
        <p class="text-xs font-semibold text-nutriflow-600">${new Date(ass.date).toLocaleDateString()}</p>
        <p class="mt-1 text-xs text-nutriflow-500">${ass.measurements?.length ? `${ass.measurements.length} medidas registradas` : 'Sem medidas complementares'}</p>
        <button onclick="window.deleteResource('assessments', '${ass.id}')" class="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">🗑️</button>
      </div>
    `).join('') : '<p class="text-sm text-nutriflow-500">Nenhuma avaliação.</p>';

  const agendaContainer = document.getElementById('appointmentsList');
  const remindersContainer = document.getElementById('appointmentRemindersList');

  if (remindersContainer) {
    remindersContainer.innerHTML = state.reminders.length
      ? state.reminders.map((reminder) => `
        <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p class="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">${escapeHtml(reminder.reminder?.label || 'Lembrete')}</p>
          <p class="mt-1 text-sm font-bold text-nutriflow-950">${escapeHtml(reminder.patient)} - ${escapeHtml(reminder.type)}</p>
          <p class="text-xs text-nutriflow-700">${escapeHtml(reminder.date)} (${escapeHtml(String(reminder.reminder?.minutesUntil || 0))} min)</p>
        </div>
      `).join('')
      : '<p class="text-sm text-nutriflow-500">Sem lembretes de consulta nas próximas 24h.</p>';
  }

  agendaContainer.innerHTML = apps.length ? apps.map(app => `
      <div class="bg-white border rounded-xl p-3 shadow-sm flex justify-between items-center relative group">
        <div>
          <p class="text-sm font-bold text-nutriflow-950">${app.patient}</p>
          <p class="text-xs font-bold text-nutriflow-500">${app.type}</p>
          <p class="text-[11px] font-bold text-nutriflow-700 mt-1">Status: ${escapeHtml(APPOINTMENT_STATUS_LABELS[app.status] || app.status)}</p>
        </div>
        <div class="flex items-center gap-2">
          <p class="text-xs font-bold bg-nutriflow-50 px-2 py-1 rounded-lg">${app.date}</p>
          <button onclick="window.updateAppointmentStatus('${app.id}', 'confirmada')" class="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">Confirmar</button>
          <button onclick="window.rescheduleAppointment('${app.id}')" class="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">Remarcar</button>
          <button onclick="window.updateAppointmentStatus('${app.id}', 'faltou')" class="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">Faltou</button>
          <button onclick="window.deleteResource('appointments', '${app.id}')" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">🗑️</button>
        </div>
      </div>
    `).join('') : '<p class="text-sm text-nutriflow-500">Sem agenda.</p>';

  const challContainer = document.getElementById('challengesList');
  if (challContainer) {
    challContainer.innerHTML = state.challenges.length ? state.challenges.map(ch => `
      <div class="bg-white border rounded-xl p-3 shadow-sm relative group mb-2">
        <p class="text-sm font-bold text-nutriflow-950 pr-16">${ch.title}</p>
        <p class="text-xs font-semibold text-nutriflow-600">${ch.target}</p>
        <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
           <button onclick="window.openAddParticipant('${ch.id}')" title="Adicionar Paciente" class="p-1 bg-nutriflow-100 rounded text-xs font-bold">➕ Pct</button>
           <button onclick="window.deleteResource('challenges', '${ch.id}')" title="Excluir" class="p-1 text-red-400 hover:text-red-600">🗑️</button>
        </div>
      </div>
    `).join('') : '<p class="text-sm text-nutriflow-600">Nenhum desafio ativo.</p>';
  }
}

function populatePatientSelects() {
  const options = state.patients.map((patient) => {
    const pendingMessages = Number(patient.pendingMessages || 0);
    const label = pendingMessages > 0
      ? `${patient.name} (${pendingMessages} nova${pendingMessages === 1 ? '' : 's'})`
      : patient.name;

    return `<option value="${patient.id}">${escapeHtml(label)}</option>`;
  }).join('');

  ['mealPlanPatient', 'assessmentPatient', 'appointmentPatient', 'chatPatientSelect', 'challengePatient', 'addPartPatient'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      if (id === 'chatPatientSelect') el.innerHTML = '<option value="">Selecione um paciente...</option>' + options;
      else if (id === 'challengePatient') el.innerHTML = '<option value="">Todos os pacientes (Geral)</option>' + options;
      else el.innerHTML = options;
      
      if (id === 'chatPatientSelect') {
        el.value = state.chatPatientId || '';
      } else if (state.selectedPatientId && id !== 'challengePatient' && id !== 'addPartPatient') {
        el.value = state.selectedPatientId;
      }
    }
  });
}

// FUNÇÕES GLOBAIS DE AÇÃO (Excluir, Duplicar, Adicionar Participante)
window.deleteResource = async function(resourceType, id) {
  if(!confirm('Tem certeza que deseja excluir este item permanentemente?')) return;
  try {
    await apiRequest(`/api/nutritionist/${resourceType}/${id}`, { method: 'DELETE' });
    showToast('Excluído com sucesso!');
    await fetchDatabaseData();
  } catch(e) { showToast('Erro ao excluir item.'); }
};

window.duplicatePlan = function(planId) {
  const plan = state.mealPlans.find(p => p.id === planId);
  if(!plan) return;
  document.getElementById('mealPlanTitle').value = plan.title + ' (Cópia)';
  if (plan.patientId) document.getElementById('mealPlanPatient').value = plan.patientId;
  resetMealPlanBuilder(plan);
  openModal('mealPlan');
};

window.openAddParticipant = function(challengeId) {
  state.activeChallengeId = challengeId;
  openModal('addParticipant');
};

window.updateAppointmentStatus = async function(appointmentId, status) {
  try {
    await apiRequest(`/api/nutritionist/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    showToast('Status da consulta atualizado.');
    await fetchDatabaseData();
  } catch (error) {
    showToast(error.message || 'Erro ao atualizar status da consulta.');
  }
};

window.rescheduleAppointment = async function(appointmentId) {
  const newDate = window.prompt('Nova data/hora (formato: 2026-12-30T14:30):');

  if (!newDate) {
    return;
  }

  try {
    await apiRequest(`/api/nutritionist/appointments/${appointmentId}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduledAt: newDate }),
    });
    showToast('Consulta remarcada com sucesso.');
    await fetchDatabaseData();
  } catch (error) {
    showToast(error.message || 'Erro ao remarcar consulta.');
  }
};

// MODAIS
function openModal(modalId) {
  document.querySelectorAll('.nf-modal-overlay').forEach(m => { m.classList.add('hidden'); m.classList.remove('flex'); });
  const modal = document.getElementById(`${modalId}Modal`);
  if (modal) { modal.classList.remove('hidden'); modal.classList.add('flex'); document.body.classList.add('modal-open'); }
}
function closeModal(modalId) {
  const modal = document.getElementById(`${modalId}Modal`);
  if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
  document.body.classList.remove('modal-open');
}

window.openPatientProfile = function(patientId) {
  state.selectedPatientId = patientId;
  state.chatPatientId = patientId;
  renderSelectedPatient();
  renderPatientProfileModal(state.patients.find(p => p.id === patientId));
  openModal('patientProfile');
};

function bindButtons() {
  document.getElementById('btnOpenLinkPatient')?.addEventListener('click', () => openModal('linkPatient'));
  document.getElementById('btnOpenMealPlan')?.addEventListener('click', () => {
    document.getElementById('mealPlanForm').reset();
    if (state.selectedPatientId) document.getElementById('mealPlanPatient').value = state.selectedPatientId;
    resetMealPlanBuilder();
    openModal('mealPlan');
  });
  document.getElementById('btnOpenAssessment')?.addEventListener('click', () => { resetAssessmentForm(); openModal('assessment'); });
  document.getElementById('btnOpenAppointment')?.addEventListener('click', () => { document.getElementById('appointmentForm').reset(); openModal('appointment'); });
  document.getElementById('btnOpenChallenge')?.addEventListener('click', () => { document.getElementById('challengeForm').reset(); openModal('challenge'); });
  
  document.getElementById('btnProfileNewPlan')?.addEventListener('click', () => {
    document.getElementById('mealPlanForm').reset();
    if (state.selectedPatientId) document.getElementById('mealPlanPatient').value = state.selectedPatientId;
    resetMealPlanBuilder();
    openModal('mealPlan');
  });
  document.getElementById('btnAddMealPlanItem')?.addEventListener('click', () => addMealPlanItemRow());
  document.getElementById('btnAddAssessmentMeasurement')?.addEventListener('click', () => addAssessmentMeasurementRow());
  document.getElementById('btnProfileNewAssessment')?.addEventListener('click', () => { resetAssessmentForm(); openModal('assessment'); });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); closeModal(e.target.dataset.close); });
  });
  document.getElementById('logoutButton')?.addEventListener('click', () => { session.clear(); window.location.href = 'index.html'; });

  chatPatientSelect?.addEventListener('change', (event) => {
    state.chatPatientId = event.target.value || null;
    clearActiveConversation();
    renderChatPanel();

    if (state.chatPatientId) {
      void syncNutritionistRealtimeChat({ forceRender: true, allowHidden: true, silent: true });
    }
  });

  chatForm?.addEventListener('submit', handleNutritionistChatSubmit);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void syncNutritionistRealtimeChat({ forceRender: true, silent: true });
    }
  });
  window.addEventListener('beforeunload', stopNutritionistRealtimeChat);
}

// INTEGRAÇÕES REAIS
document.getElementById('linkPatientForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('linkPatientEmail').value;
  const age = document.getElementById('linkPatientAge').value;
  const objective = document.getElementById('linkPatientObjective').value;
  try {
    await apiRequest('/api/nutritionist/link-patient', { method: 'POST', body: JSON.stringify({ patientEmail: email, age, objective }) });
    showToast('Paciente vinculado com sucesso!');
    closeModal('linkPatient');
    await fetchDatabaseData();
  } catch(err) { showToast(err.message || 'Erro ao vincular paciente.'); }
});

document.getElementById('mealPlanForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const items = getMealPlanItemsPayload();

  if (!items.length) {
    showToast('Adicione pelo menos um alimento ao plano.');
    return;
  }

  const payload = {
    patientId: document.getElementById('mealPlanPatient').value,
    title: document.getElementById('mealPlanTitle').value,
    notes: document.getElementById('mealPlanNotes').value,
    items,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30*24*60*60*1000).toISOString()
  };
  try {
    await apiRequest('/api/nutritionist/meal-plans', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Plano salvo!'); closeModal('mealPlan'); await fetchDatabaseData();
  } catch(err) { showToast('Erro ao salvar plano.'); }
});

document.getElementById('assessmentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dateValue = document.getElementById('assessmentDate').value;
  const recordedAt = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const payload = {
    patientId: document.getElementById('assessmentPatient').value,
    weight: document.getElementById('assessmentWeight').value,
    height: document.getElementById('assessmentHeight').value,
    bodyFat: document.getElementById('assessmentBodyFat').value,
    notes: document.getElementById('assessmentNotes').value,
    measurements: getAssessmentMeasurementsPayload(),
    date: Number.isNaN(recordedAt.getTime()) ? new Date().toISOString() : recordedAt.toISOString()
  };
  try {
    await apiRequest('/api/nutritionist/assessments', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Avaliação salva!'); closeModal('assessment'); await fetchDatabaseData();
  } catch(err) { showToast('Erro ao salvar avaliação.'); }
});

// AQUI É A AGENDA SALVANDO DE VERDADE
document.getElementById('appointmentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    patientId: document.getElementById('appointmentPatient').value,
    date: document.getElementById('appointmentDate').value,
    type: document.getElementById('appointmentType').value
  };
  try {
    await apiRequest('/api/nutritionist/appointments', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Consulta Agendada!'); closeModal('appointment'); await fetchDatabaseData();
  } catch(err) { showToast('Erro ao agendar.'); }
});

document.getElementById('challengeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('challengeTitle').value;
  const target = document.getElementById('challengeTarget').value;
  const prize = document.getElementById('challengePrize').value;
  const patientId = document.getElementById('challengePatient').value;
  const finalTarget = prize ? `${target} | 🎁 Prêmio: ${prize}` : target;
  const participantIds = patientId ? [patientId] : state.patients.map(p => p.id);

  try {
    await apiRequest('/api/nutritionist/challenges', { method: 'POST', body: JSON.stringify({ title, target: finalTarget, participantIds }) });
    showToast('Desafio salvo!'); closeModal('challenge'); await fetchDatabaseData();
  } catch(err) { showToast('Erro ao criar desafio.'); }
});

// ADICIONAR PACIENTE A DESAFIO EXISTENTE
document.getElementById('addParticipantForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const patientId = document.getElementById('addPartPatient').value;
  try {
    await apiRequest(`/api/nutritionist/challenges/${state.activeChallengeId}/participants`, { method: 'POST', body: JSON.stringify({ patientId }) });
    showToast('Paciente adicionado ao desafio!'); closeModal('addParticipant'); await fetchDatabaseData();
  } catch(err) { showToast('Erro ao adicionar paciente.'); }
});

// LOGIC PARA O CHAT FLUTUANTE
function openChatModal() {
  if (!chatModal) {
    return;
  }

  if (!state.chatPatientId && state.selectedPatientId) {
    state.chatPatientId = state.selectedPatientId;
  }

  chatModal.classList.remove('chat-hidden');
  chatModal.classList.add('chat-visible');
  renderChatPanel();
  void syncNutritionistRealtimeChat({ forceRender: true, allowHidden: true, silent: true });
}

function closeChatModal() {
  if (!chatModal) {
    return;
  }

  chatModal.classList.add('chat-hidden');
  chatModal.classList.remove('chat-visible');
}

document.getElementById('btnToggleChat')?.addEventListener('click', () => {
  if (chatModal?.classList.contains('chat-hidden')) {
    openChatModal();
    return;
  }

  closeChatModal();
});

document.getElementById('btnCloseChat')?.addEventListener('click', closeChatModal);

// START
async function init() {
  if (!ensureNutritionistAccess()) return;
  bindButtons();
  syncNutritionistRealtimeAvailability();
  await fetchDatabaseData();
}
init();
