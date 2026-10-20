const {
  createApiClient,
  createSessionManager,
  createToastController,
  cropImageToSquare,
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
  activeFilterId: null, 
  activeChallengeId: null, 
  mealPlans: [], assessments: [], appointments: [], challenges: [], messages: [], foods: [], reminders: [],
  chatConversations: [],
  workspaceConversationId: null,
  workspaceMessages: [],
  workspacePagination: null,
  workspacePage: 1,
  workspaceRequestId: 0,
  isLoadingWorkspace: false,
  isSendingWorkspaceMessage: false,
  patientSearch: '',
  editingMeasurement: null,
};

const APPOINTMENT_STATUS_LABELS = {
  agendada: 'Agendada',
  confirmada: 'Confirmada',
  remarcada: 'Remarcada',
  faltou: 'Faltou',
};
const MAX_PROFILE_PHOTO_UPLOAD_BYTES = 5 * 1024 * 1024;

const toast = document.getElementById('nutritionistToast');
const toastController = createToastController(toast, { duration: 3000 });
const nutritionistPatientSearch = document.getElementById('nutritionistPatientSearch');
const conversationList = document.getElementById('conversationList');
const workspaceMessages = document.getElementById('workspaceMessages');
const workspaceMessageInput = document.getElementById('workspaceMessageInput');
const workspaceMessageSubmit = document.getElementById('workspaceMessageSubmit');
const workspaceMessageForm = document.getElementById('workspaceMessageForm');
const workspaceVoiceButton = document.getElementById('workspaceVoiceButton');
const workspaceMessageStatus = document.getElementById('workspaceMessageStatus');
const workspaceVoicePreview = document.getElementById('workspaceVoicePreview');
const workspaceVoiceRecording = document.getElementById('workspaceVoiceRecording');
const workspaceVoiceRecordingTime = document.getElementById('workspaceVoiceRecordingTime');
const workspaceVoiceCancel = document.getElementById('workspaceVoiceCancel');
const loadOlderMessagesButton = document.getElementById('loadOlderMessages');
let nutritionistChatSyncIntervalId = null;
let workspaceVoiceDraft = null;
let workspaceRecordingConversationId = null;

function showToast(message) { toastController.show(message); }
function ensureNutritionistAccess() { return session.ensureAuthenticated(); }

function ensureValidPatientSelections() {
  const patientIds = new Set(state.patients.map((patient) => patient.id));

  if (!state.patients.length) {
    state.selectedPatientId = null;
    state.activeFilterId = null;
    return;
  }

  if (!patientIds.has(state.selectedPatientId)) {
    state.selectedPatientId = state.patients[0].id;
  }

  if (state.activeFilterId && !patientIds.has(state.activeFilterId)) {
    state.activeFilterId = null;
  }

}

async function fetchChatConversations() {
  return apiRequest('/api/chat/conversations');
}

async function fetchChatHistory(conversationId, page = 1) {
  const query = new URLSearchParams({ page: String(page), limit: '50' });
  return apiRequest(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages?${query}`);
}

function formatConversationTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function renderWorkspaceConversationList() {
  if (!conversationList) return;
  const conversations = state.chatConversations;
  const totalUnread = conversations.reduce((sum, conversation) => sum + Number(conversation.unreadCount || 0), 0);
  const badge = document.getElementById('sidebarUnreadBadge');
  const summary = document.getElementById('conversationUnreadSummary');

  if (badge) {
    badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
    badge.classList.toggle('hidden', totalUnread === 0);
  }
  if (summary) {
    summary.textContent = totalUnread
      ? `${totalUnread} mensagem${totalUnread === 1 ? '' : 'ns'} não lida${totalUnread === 1 ? '' : 's'}`
      : `${conversations.length} conversa${conversations.length === 1 ? '' : 's'}`;
  }

  if (!conversations.length) {
    conversationList.innerHTML = '<p class="p-5 text-sm leading-6 text-nutriflow-600">Nenhum paciente vinculado para conversar.</p>';
    return;
  }

  conversationList.innerHTML = conversations.map((conversation) => {
    const patient = conversation.patient || {};
    const selected = conversation.id === state.workspaceConversationId;
    const unreadCount = Number(conversation.unreadCount || 0);
    const lastMessage = conversation.lastMessage;
    const preview = lastMessage?.type === 'AUDIO'
      ? 'Mensagem de voz'
      : (lastMessage?.content || 'Conversa ainda sem mensagens');
    return `
      <button type="button" data-conversation-id="${escapeHtml(conversation.id)}" class="flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-nutriflow-50 ${selected ? 'bg-nutriflow-50' : ''}">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-nutriflow-200 text-xs font-extrabold text-nutriflow-900">${escapeHtml(getInitials(patient.name) || 'P')}</span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-extrabold text-nutriflow-950">${escapeHtml(patient.name || 'Paciente')}</span>
            <span class="shrink-0 text-[10px] text-nutriflow-500">${escapeHtml(formatConversationTimestamp(lastMessage?.createdAt))}</span>
          </span>
          <span class="mt-1 block truncate text-xs ${unreadCount ? 'font-bold text-nutriflow-800' : 'text-nutriflow-600'}">${escapeHtml(preview)}</span>
        </span>
        ${unreadCount ? `<span class="mt-1 grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-nutriflow-700 px-1 text-[10px] font-extrabold text-white">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
      </button>
    `;
  }).join('');
}

function renderWorkspaceMessages(options = {}) {
  const conversation = state.chatConversations.find((item) => item.id === state.workspaceConversationId);
  const name = document.getElementById('workspaceConversationName');
  const meta = document.getElementById('workspaceConversationMeta');
  const olderButton = loadOlderMessagesButton;

  if (name) name.textContent = conversation?.patient?.name || 'Selecione um paciente';
  if (meta) {
    const unread = Number(conversation?.unreadCount || 0);
    meta.textContent = conversation
      ? (unread ? `${unread} mensagem${unread === 1 ? '' : 'ns'} não lida${unread === 1 ? '' : 's'}` : 'Conversa privada com paciente vinculado')
      : 'O histórico aparecerá aqui.';
  }

  const isDisabled = !conversation || state.isSendingWorkspaceMessage;
  if (workspaceMessageInput) {
    workspaceMessageInput.disabled = isDisabled;
    workspaceMessageInput.placeholder = conversation ? `Mensagem para ${conversation.patient.name}...` : 'Selecione um paciente para responder...';
  }
  if (workspaceMessageSubmit) workspaceMessageSubmit.disabled = isDisabled;
  if (workspaceVoiceButton) workspaceVoiceButton.disabled = isDisabled;
  if (olderButton) {
    olderButton.classList.toggle('hidden', !state.workspacePagination || state.workspacePage >= state.workspacePagination.totalPages);
    olderButton.disabled = state.isLoadingWorkspace;
  }

  if (!workspaceMessages) return;
  const renderSignature = JSON.stringify({
    conversationId: state.workspaceConversationId,
    currentUserId: state.currentUser?.id,
    loading: state.isLoadingWorkspace && !state.workspaceMessages.length,
    messages: state.workspaceMessages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      createdAt: message.createdAt,
      content: message.content,
      type: message.type,
      audioDurationSeconds: message.audioDurationSeconds,
      transcript: message.transcript,
      status: message.status,
    })),
  });
  if (workspaceMessages.dataset.renderSignature === renderSignature) return;

  window.NutriFlowChatVoice.releaseAudioPlayers(workspaceMessages);
  workspaceMessages.dataset.renderSignature = renderSignature;
  if (!conversation) {
    workspaceMessages.innerHTML = '<p class="m-auto text-center text-sm text-nutriflow-500">Selecione um paciente para abrir a conversa.</p>';
    return;
  }
  if (state.isLoadingWorkspace && !state.workspaceMessages.length) {
    workspaceMessages.innerHTML = '<p class="m-auto text-center text-sm text-nutriflow-500">Carregando histórico...</p>';
    return;
  }
  if (!state.workspaceMessages.length) {
    workspaceMessages.innerHTML = '<p class="m-auto text-center text-sm text-nutriflow-500">Nenhuma mensagem nesta conversa. Envie a primeira mensagem abaixo.</p>';
    return;
  }

  workspaceMessages.innerHTML = state.workspaceMessages.map((message) => {
    const isMine = message.senderId === state.currentUser?.id;
    const audioMessage = message.type === 'AUDIO';
    return `
      <article class="max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${isMine ? 'ml-auto bg-nutriflow-800 text-white' : 'mr-auto border border-nutriflow-100 bg-white text-nutriflow-950'}">
        <p class="mb-1 text-[10px] font-bold uppercase tracking-wide ${isMine ? 'text-white/65' : 'text-nutriflow-500'}">${isMine ? 'Você' : escapeHtml(message.senderName || conversation.patient.name)} · ${escapeHtml(formatConversationTimestamp(message.createdAt))}</p>
        ${audioMessage
          ? `<p class="whitespace-pre-wrap break-words text-sm leading-6">Mensagem de voz · ${Number(message.audioDurationSeconds || 0)}s</p><button type="button" data-audio-message-id="${escapeHtml(message.id)}" data-audio-transcript="${escapeHtml(message.transcript || '')}" class="mt-2 rounded-lg border border-current/20 px-3 py-2 text-sm font-semibold">Reproduzir áudio</button>`
          : `<p class="whitespace-pre-wrap break-words text-sm leading-6">${escapeHtml(message.content)}</p>`}
        ${isMine ? `<p class="mt-2 text-right text-[10px] text-white/65">${message.status === 'READ' ? 'Lida' : 'Enviada'}</p>` : ''}
      </article>
    `;
  }).join('');

  workspaceMessages.querySelectorAll('[data-audio-message-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.NutriFlowChatVoice.loadAudioPlayer(button, (messageId) => (
        window.NutriFlowApi.request(
          `/api/chat/messages/${encodeURIComponent(messageId)}/audio`,
          { headers: { Authorization: `Bearer ${session.getToken()}` } },
        )
      ));
      if (button.dataset.error) showToast(button.dataset.error);
    });
  });

  if (options.scrollToEnd) workspaceMessages.scrollTop = workspaceMessages.scrollHeight;
}

async function loadConversationWorkspace(options = {}) {
  if (state.isLoadingWorkspace) return;
  state.isLoadingWorkspace = true;
  const requestId = ++state.workspaceRequestId;
  renderWorkspaceConversationList();
  renderWorkspaceMessages();

  try {
    const result = await fetchChatConversations();
    if (requestId !== state.workspaceRequestId) return;
    state.chatConversations = result.conversations || [];
    if (!state.chatConversations.some((item) => item.id === state.workspaceConversationId)) {
      state.workspaceConversationId = state.chatConversations[0]?.id || null;
      state.workspaceMessages = [];
      state.workspacePagination = null;
      state.workspacePage = 1;
    }
    renderWorkspaceConversationList();

    if (state.workspaceConversationId && options.loadMessages !== false) {
      const history = await fetchChatHistory(state.workspaceConversationId, 1);
      if (requestId !== state.workspaceRequestId) return;
      state.workspaceMessages = history.messages || [];
      state.workspacePagination = history.pagination || null;
      state.workspacePage = history.pagination?.page || 1;
      const selectedConversation = state.chatConversations.find((item) => item.id === state.workspaceConversationId);
      if (selectedConversation && history.unreadCount) selectedConversation.unreadCount = 0;
      renderWorkspaceConversationList();
      renderWorkspaceMessages({ scrollToEnd: options.scrollToEnd === true });
    }
  } catch (error) {
    if (!options.silent) showToast(error.message || 'Não foi possível carregar os bate-papos.');
  } finally {
    if (requestId === state.workspaceRequestId) {
      state.isLoadingWorkspace = false;
      renderWorkspaceMessages();
    }
  }
}

async function loadOlderConversationMessages() {
  if (!state.workspaceConversationId || !state.workspacePagination || state.workspacePage >= state.workspacePagination.totalPages) return;
  const previousHeight = workspaceMessages?.scrollHeight || 0;
  const nextPage = state.workspacePage + 1;
  state.isLoadingWorkspace = true;
  renderWorkspaceMessages();
  try {
    const result = await fetchChatHistory(state.workspaceConversationId, nextPage);
    state.workspaceMessages = [...(result.messages || []), ...state.workspaceMessages];
    state.workspacePage = result.pagination?.page || nextPage;
    state.workspacePagination = result.pagination || state.workspacePagination;
    renderWorkspaceMessages();
    if (workspaceMessages) workspaceMessages.scrollTop = workspaceMessages.scrollHeight - previousHeight;
  } catch (error) {
    showToast(error.message || 'Não foi possível carregar mensagens anteriores.');
  } finally {
    state.isLoadingWorkspace = false;
    renderWorkspaceMessages();
  }
}


async function fetchDatabaseData() {
  try {
    const [patientsData, foodsData, mealPlansData] = await Promise.all([
      apiRequest('/api/nutritionist/patients'),
      apiRequest('/api/nutritionist/foods'),
      apiRequest('/api/nutritionist/meal-plans'),
    ]);
    state.patients = patientsData.patients || [];
    state.foods = foodsData.foods || [];
    state.mealPlans = mealPlansData.mealPlans || [];
    state.assessments = state.patients
      .flatMap((patient) => (patient.bodyMeasurements?.history || []).map((entry) => {
        const weight = entry.items.find((item) => item.label === 'Peso');
        const bodyFat = entry.items.find((item) => item.label === 'Gordura corporal');

        return {
          id: entry.id,
          patientId: patient.id,
          patient: patient.name,
          weight: weight?.value ?? '--',
          bodyFat: bodyFat?.value ?? null,
          date: entry.date,
          measurements: entry.items.filter(
            (item) => !['Peso', 'Altura', 'Gordura corporal'].includes(item.label),
          ),
        };
      }))
      .sort((first, second) => new Date(second.date) - new Date(first.date));

    ensureValidPatientSelections();
    renderAll();
    await loadConversationWorkspace({
      loadMessages: isNutritionistConversationPage(),
      silent: true,
    });
  } catch (error) { showToast(error.message || 'Erro ao carregar os dados do painel.'); }
}

function renderAll() {
  renderHeader();
  renderPatientsList();
  renderSelectedPatient();
  renderGeneralLists();
  populatePatientSelects();
  renderWorkspaceConversationList();
}

function renderHeader() {
  const currentUser = state.currentUser || session.getUser() || { name: 'Nutricionista' };
  document.querySelectorAll('[data-nutritionist-name]').forEach(el => el.textContent = currentUser.name);
  document.querySelectorAll('[data-nutritionist-initial]').forEach((element) => {
    if (currentUser.profilePhotoUrl) {
      const image = document.createElement('img');
      image.src = currentUser.profilePhotoUrl;
      image.alt = `Foto de perfil de ${currentUser.name || 'nutricionista'}`;
      image.className = 'h-full w-full rounded-[14px] object-cover';
      image.addEventListener('error', () => {
        element.textContent = getInitials(currentUser.name) || '--';
      }, { once: true });
      element.replaceChildren(image);
      return;
    }

    element.textContent = getInitials(currentUser.name) || '--';
  });
  document.querySelectorAll('[data-nutritionist-email]').forEach(el => el.textContent = currentUser.email || '--');
  document.querySelector('[data-sidebar-date]').textContent = formatCoreSidebarDate();
  document.querySelector('[data-header-greeting]').textContent = `Olá, ${currentUser.name}`;
}

function renderNutritionistProfilePhoto(user) {
  const preview = document.getElementById('nutritionistProfilePhotoPreview');

  if (!preview) {
    return;
  }

  const initials = getInitials(user?.name) || '--';

  if (!user?.profilePhotoUrl) {
    preview.textContent = initials;
    return;
  }

  const image = document.createElement('img');
  image.src = user.profilePhotoUrl;
  image.alt = `Foto de perfil de ${user.name || 'nutricionista'}`;
  image.className = 'h-full w-full rounded-full object-cover';
  image.addEventListener('error', () => {
    preview.textContent = initials;
  }, { once: true });
  preview.replaceChildren(image);
}

function renderPatientsList() {
  const list = document.getElementById('patientsList');
  if (!list) return;
  list.innerHTML = '';

  const search = state.patientSearch.trim().toLocaleLowerCase('pt-BR');
  const patients = state.patients.filter((patient) =>
    [patient.name, patient.email, patient.objective].some((value) =>
      String(value || '').toLocaleLowerCase('pt-BR').includes(search),
    ),
  );
  const emptyState = document.getElementById('emptyPatientsState');

  if (patients.length === 0) {
    emptyState.textContent = state.patients.length && search
      ? 'Nenhum paciente corresponde à busca.'
      : 'Nenhum paciente vinculado. Adicione um clicando em "Vincular Paciente".';
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  patients.forEach((patient) => {
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
          <p class="text-xs text-nutriflow-600">${escapeHtml(patient.objective || 'Em avaliação')}</p>
        </div>
      </div>
      <button class="text-xs bg-nutriflow-950 text-white px-3 py-1 rounded-lg font-bold" onclick="window.openPatientProfile('${patient.id}')">Perfil</button>
    `;
    
    row.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        state.selectedPatientId = patient.id;
        state.activeFilterId = patient.id; 
        renderAll(); 
        window.openPatientProfile(patient.id);
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
  const patientHeight = Number(patient.height);
  const patientHeightLabel = Number.isFinite(patientHeight) && patientHeight > 0
    ? `${patientHeight}${patientHeight <= 3 ? 'm' : 'cm'}`
    : '--';
  document.getElementById('selectedPatientHeight').textContent = patientHeightLabel;
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
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs font-bold uppercase tracking-[0.12em] text-nutriflow-500">${escapeHtml(group.dateLabel)}</p>
              <div class="flex gap-2">
                <button type="button" data-edit-measurement-id="${escapeHtml(group.id)}" class="rounded-lg border border-nutriflow-200 bg-white px-2 py-1 text-xs font-bold text-nutriflow-900">Editar</button>
                <button type="button" data-delete-measurement-id="${escapeHtml(group.id)}" class="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600">Excluir</button>
              </div>
            </div>
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

function getSelectedPatient() {
  return state.patients.find((patient) => patient.id === state.selectedPatientId) || state.patients[0] || null;
}

function getAssessmentMeasurementsPayload(options = {}) {
  const allowIncomplete = options.allowIncomplete === true;

  const measurements = {};
  const rows = Array.from(document.querySelectorAll('[data-assessment-measurement-row]'));

  for (const row of rows) {
    const field = row.querySelector('[data-assessment-measurement-label]')?.value || '';
    const value = row.querySelector('[data-assessment-measurement-value]')?.value || '';

    if (!field || !value) {
      if (allowIncomplete && (field || value)) {
        return null;
      }
      continue;
    }

    if (Object.hasOwn(measurements, field)) {
      return null;
    }

    measurements[field] = Number(value);
  }

  return measurements;
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
    <select class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-assessment-measurement-label>
      <option value="neckCircumferenceCm">Pescoco (cm)</option>
      <option value="chestCircumferenceCm">Torax (cm)</option>
      <option value="waistCircumferenceCm">Cintura (cm)</option>
      <option value="hipCircumferenceCm">Quadril (cm)</option>
      <option value="armCircumferenceCm">Braco (cm)</option>
      <option value="thighCircumferenceCm">Coxa (cm)</option>
      <option value="calfCircumferenceCm">Panturrilha (cm)</option>
      <option value="tricepsSkinfoldMm">Dobra tricipital (mm)</option>
      <option value="bicepsSkinfoldMm">Dobra bicipital (mm)</option>
      <option value="subscapularSkinfoldMm">Dobra subescapular (mm)</option>
      <option value="suprailiacSkinfoldMm">Dobra suprailiaca (mm)</option>
      <option value="abdominalSkinfoldMm">Dobra abdominal (mm)</option>
      <option value="thighSkinfoldMm">Dobra da coxa (mm)</option>
      <option value="calfSkinfoldMm">Dobra da panturrilha (mm)</option>
    </select>
    <input class="rounded-lg border border-nutriflow-200 px-3 py-2 text-sm font-bold" data-assessment-measurement-value type="number" min="0.1" max="500" step="0.1" placeholder="Valor" value="${escapeHtml(String(measurement.value || ''))}" />
    <button class="rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-500" type="button" data-remove-assessment-measurement>Remover</button>
  `;
  if (measurement.field) {
    row.querySelector('[data-assessment-measurement-label]').value = measurement.field;
  }

  row.querySelector('[data-remove-assessment-measurement]')?.addEventListener('click', () => {
    row.remove();
  });

  list.appendChild(row);
}

function resetAssessmentForm() {
  document.getElementById('assessmentForm')?.reset();
  state.editingMeasurement = null;
  document.getElementById('assessmentModalTitle').textContent = 'Registrar Avaliação Física';
  document.getElementById('assessmentSubmitButton').textContent = 'Salvar no Banco';

  const patient = getSelectedPatient();
  const patientSelect = document.getElementById('assessmentPatient');
  const weightInput = document.getElementById('assessmentWeight');
  const heightInput = document.getElementById('assessmentHeight');
  const measurementsList = document.getElementById('assessmentMeasurementsList');

  if (weightInput) {
    weightInput.value = '';
  }

  if (heightInput) {
    heightInput.value = '';
  }

  if (patientSelect && patient?.id) {
    patientSelect.value = patient.id;
  }

  if (measurementsList) {
    measurementsList.innerHTML = '';
  }
}

async function editPatientMeasurement(patientId, measurementId) {
  try {
    const response = await apiRequest(`/api/patients/${encodeURIComponent(patientId)}/measurements`);
    const measurement = (response.measurements || []).find((entry) => entry.id === measurementId);

    if (!measurement) {
      showToast('Medida nao encontrada no historico.');
      return;
    }

    resetAssessmentForm();
    state.editingMeasurement = { patientId, measurementId };
    document.getElementById('assessmentModalTitle').textContent = 'Editar Avaliação Física';
    document.getElementById('assessmentSubmitButton').textContent = 'Salvar alterações';
    document.getElementById('assessmentPatient').value = patientId;
    document.getElementById('assessmentWeight').value = measurement.weightKg;
    document.getElementById('assessmentHeight').value = measurement.heightCm;
    document.getElementById('assessmentBodyFat').value = measurement.bodyFatPercent ?? '';
    document.getElementById('assessmentNotes').value = measurement.notes || '';

    for (const [field, value] of Object.entries(measurement)) {
      if (
        field.endsWith('CircumferenceCm') ||
        field.endsWith('SkinfoldMm')
      ) {
        if (value !== null && value !== undefined) {
          addAssessmentMeasurementRow({ field, value });
        }
      }
    }

    openModal('assessment');
  } catch (error) {
    showToast(error.message || 'Nao foi possivel carregar a medida.');
  }
}

async function deletePatientMeasurement(patientId, measurementId) {
  if (!window.confirm('Deseja excluir esta medida do historico de evolucao?')) {
    return;
  }

  try {
    await apiRequest(
      `/api/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(measurementId)}`,
      { method: 'DELETE' },
    );
    showToast('Medida removida do historico.');
    await fetchDatabaseData();
    renderPatientProfileModal(state.patients.find((patient) => patient.id === patientId));
  } catch (error) {
    showToast(error.message || 'Nao foi possivel excluir a medida.');
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
    void loadConversationWorkspace({
      loadMessages: isNutritionistConversationPage(),
      silent: true,
      scrollToEnd: false,
    });
  }, 3500);
}

function syncNutritionistRealtimeAvailability() {
  if (!session.getToken()) {
    stopNutritionistRealtimeChat();
    return;
  }

  startNutritionistRealtimeChat();
}

function renderGeneralLists() {
  const pId = state.activeFilterId;

  
  const plans = pId ? state.mealPlans.filter(p => p.patientId === pId) : state.mealPlans;
  const asss = pId ? state.assessments.filter(a => a.patientId === pId) : state.assessments;
  const apps = pId ? state.appointments.filter(a => a.patientId === pId) : state.appointments;

  const plansContainer = document.getElementById('latestMealPlans');
  plansContainer.innerHTML = plans.length ? plans.map(plan => `
      <div class="h-[136px] shrink-0 bg-white border rounded-xl p-3 shadow-sm relative group">
        <p class="text-xs font-bold text-nutriflow-500 uppercase">${escapeHtml(plan.patient)}</p>
        <p class="text-sm font-bold text-nutriflow-950 mt-1 pr-12">${escapeHtml(plan.title)}</p>
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
      <div class="h-[136px] shrink-0 bg-white border rounded-xl p-3 shadow-sm relative group">
        <p class="text-xs font-bold text-nutriflow-500 uppercase">${escapeHtml(ass.patient)}</p>
        <p class="text-sm font-bold text-nutriflow-950 mt-1">Peso: ${ass.weight}kg</p>
        ${ass.bodyFat !== null ? `<p class="text-xs font-semibold text-nutriflow-600">Gordura corporal: ${ass.bodyFat}%</p>` : ''}
        <p class="text-xs font-semibold text-nutriflow-600">${new Date(ass.date).toLocaleDateString('pt-BR')}</p>
        <p class="mt-1 text-xs text-nutriflow-500">${ass.measurements?.length ? `${ass.measurements.length} medidas registradas` : 'Sem medidas complementares'}</p>
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

  if (agendaContainer) {
    agendaContainer.innerHTML = apps.length ? apps.map(app => `
      <div class="bg-white border rounded-xl p-3 shadow-sm flex justify-between items-center relative group">
        <div>
          <p class="text-sm font-bold text-nutriflow-950">${escapeHtml(app.patient)}</p>
          <p class="text-xs font-bold text-nutriflow-500">${escapeHtml(app.type)}</p>
          <p class="text-[11px] font-bold text-nutriflow-700 mt-1">Status: ${escapeHtml(APPOINTMENT_STATUS_LABELS[app.status] || app.status)}</p>
        </div>
        <div class="flex items-center gap-2">
          <p class="text-xs font-bold bg-nutriflow-50 px-2 py-1 rounded-lg">${escapeHtml(app.date)}</p>
          <button onclick="window.updateAppointmentStatus('${app.id}', 'confirmada')" class="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">Confirmar</button>
          <button onclick="window.rescheduleAppointment('${app.id}')" class="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">Remarcar</button>
          <button onclick="window.updateAppointmentStatus('${app.id}', 'faltou')" class="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700">Faltou</button>
          <button onclick="window.deleteResource('appointments', '${app.id}')" class="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">🗑️</button>
        </div>
      </div>
    `).join('') : '<p class="text-sm text-nutriflow-500">Sem agenda.</p>';
  }

  const challContainer = document.getElementById('challengesList');
  if (challContainer) {
    challContainer.innerHTML = state.challenges.length ? state.challenges.map(ch => `
      <div class="bg-white border rounded-xl p-3 shadow-sm relative group mb-2">
        <p class="text-sm font-bold text-nutriflow-950 pr-16">${escapeHtml(ch.title)}</p>
        <p class="text-xs font-semibold text-nutriflow-600">${escapeHtml(ch.target)}</p>
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

  ['mealPlanPatient', 'assessmentPatient', 'appointmentPatient', 'challengePatient', 'addPartPatient'].forEach(id => {
    const el = document.getElementById(id);
    if(el) {
      if (id === 'challengePatient') el.innerHTML = '<option value="">Todos os pacientes (Geral)</option>' + options;
      else el.innerHTML = options;
      
      if (state.selectedPatientId && id !== 'challengePatient' && id !== 'addPartPatient') {
        el.value = state.selectedPatientId;
      }
    }
  });
}


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

async function openNutritionistSettings() {
  const profileName = document.getElementById('nutriProfileName');
  const profileEmail = document.getElementById('nutriProfileEmail');
  const profilePhone = document.getElementById('nutriProfilePhone');
  let user = state.currentUser || session.getUser() || {};

  try {
    const response = await apiRequest('/api/users/me');
    user = response.user || user;
    state.currentUser = session.persistUser(user);
    renderHeader();
  } catch (error) {
    showToast(error.message || 'Não foi possível carregar o perfil.');
  }

  profileName.value = user.name || '';
  profileEmail.value = user.email || '';
  profilePhone.value = user.phone || '';
  renderNutritionistProfilePhoto(user);
  openModal('settings');
}

async function handleNutritionistPhotoUpload() {
  const input = document.getElementById('nutritionistProfilePhotoInput');
  const file = input?.files?.[0];

  if (!file) {
    return;
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showToast('Selecione uma imagem JPEG, PNG ou WebP.');
    input.value = '';
    return;
  }

  try {
    const croppedPhoto = await cropImageToSquare(file);

    if (croppedPhoto.size > MAX_PROFILE_PHOTO_UPLOAD_BYTES) {
      showToast('Não foi possível ajustar a foto ao limite de envio.');
      return;
    }

    const response = await apiRequest('/api/users/me/photo', {
      method: 'POST',
      headers: { 'Content-Type': croppedPhoto.type },
      body: await croppedPhoto.arrayBuffer(),
    });
    const user = {
      ...state.currentUser,
      ...(response.user || {}),
      profilePhotoUrl:
        response.profilePhotoUrl ||
        response.user?.profilePhotoUrl ||
        state.currentUser?.profilePhotoUrl ||
        null,
    };

    state.currentUser = session.persistUser(user);
    renderNutritionistProfilePhoto(user);
    renderHeader();
    showToast(response.message || 'Foto atualizada com sucesso.');
  } catch (error) {
    showToast(error.message || 'Não foi possível atualizar a foto.');
  } finally {
    input.value = '';
  }
}

async function handleNutritionistProfileSubmit(event) {
  event.preventDefault();

  const submitButton = document.getElementById('nutritionistProfileSubmit');
  submitButton.disabled = true;
  submitButton.textContent = 'Salvando...';

  try {
    const response = await apiRequest('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        name: document.getElementById('nutriProfileName').value,
        phone: document.getElementById('nutriProfilePhone').value,
      }),
    });

    state.currentUser = session.persistUser({
      ...state.currentUser,
      ...(response.user || {}),
    });
    renderHeader();
    showToast(response.message || 'Perfil atualizado com sucesso.');
    closeModal('settings');
  } catch (error) {
    showToast(error.message || 'Não foi possível atualizar o perfil.');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Salvar alterações';
  }
}

window.openPatientProfile = function(patientId) {
  state.selectedPatientId = patientId;
  renderSelectedPatient();
  renderPatientProfileModal(state.patients.find(p => p.id === patientId));
  openModal('patientProfile');
};

function bindButtons() {

  document.getElementById('btnOpenSettings')?.addEventListener('click', () => {
    void openNutritionistSettings();
  });

  nutritionistPatientSearch?.addEventListener('input', (event) => {
    state.patientSearch = event.target.value;
    renderPatientsList();
  });

  document.getElementById('settingsForm')?.addEventListener('submit', handleNutritionistProfileSubmit);
  document.getElementById('nutritionistProfilePhotoInput')?.addEventListener('change', handleNutritionistPhotoUpload);

  document.getElementById('btnOpenLinkPatient')?.addEventListener('click', () => {
    openModal('linkPatient');
  });

  document.getElementById('btnOpenMealPlan')?.addEventListener('click', () => {
    document.getElementById('mealPlanForm')?.reset();

    if (state.selectedPatientId) {
      const patientSelect = document.getElementById('mealPlanPatient');

      if (patientSelect) {
        patientSelect.value = state.selectedPatientId;
      }
    }

    resetMealPlanBuilder();
    openModal('mealPlan');
  });

  document.getElementById('btnOpenAssessment')?.addEventListener('click', () => {
    resetAssessmentForm();
    openModal('assessment');
  });

  document.getElementById('btnOpenAppointment')?.addEventListener('click', () => {
    document.getElementById('appointmentForm')?.reset();
    openModal('appointment');
  });

  document.getElementById('btnOpenChallenge')?.addEventListener('click', () => {
    document.getElementById('challengeForm')?.reset();
    openModal('challenge');
  });

  document.getElementById('btnProfileNewPlan')?.addEventListener('click', () => {
    document.getElementById('mealPlanForm')?.reset();

    if (state.selectedPatientId) {
      const patientSelect = document.getElementById('mealPlanPatient');

      if (patientSelect) {
        patientSelect.value = state.selectedPatientId;
      }
    }

    resetMealPlanBuilder();
    openModal('mealPlan');
  });

  document.getElementById('btnAddMealPlanItem')?.addEventListener('click', () => {
    addMealPlanItemRow();
  });

  document.getElementById('btnAddAssessmentMeasurement')?.addEventListener('click', () => {
    addAssessmentMeasurementRow();
  });

  document.getElementById('btnProfileNewAssessment')?.addEventListener('click', () => {
    resetAssessmentForm();
    openModal('assessment');
  });

  document.getElementById('patientProfileBodyMeasurementHistory')?.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-edit-measurement-id]');
    const deleteButton = event.target.closest('[data-delete-measurement-id]');

    if (editButton) {
      void editPatientMeasurement(state.selectedPatientId, editButton.dataset.editMeasurementId);
    } else if (deleteButton) {
      void deletePatientMeasurement(state.selectedPatientId, deleteButton.dataset.deleteMeasurementId);
    }
  });

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();

      const modalId = e.currentTarget.dataset.close;

      if (modalId) {
        closeModal(modalId);
      }
    });
  });


  document.getElementById('logoutButton')?.addEventListener('click', async () => {
    await session.clear();
    window.location.href = 'index.html';
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void loadConversationWorkspace({
        loadMessages: isNutritionistConversationPage(),
        silent: true,
      });
    }
  });


  window.addEventListener(
    'beforeunload',
    stopNutritionistRealtimeChat
  );
}


document.getElementById('linkPatientForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('linkPatientEmail').value;
  const age = document.getElementById('linkPatientAge').value;
  const objective = document.getElementById('linkPatientObjective').value;
  const restrictions = document.getElementById('linkPatientRestrictions').value;
  try {
    await apiRequest('/api/nutritionist/link-patient', { method: 'POST', body: JSON.stringify({ patientEmail: email, age, objective, restrictions }) });
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
  } catch(err) { showToast(err.message || 'Erro ao salvar plano.'); }
});

document.getElementById('assessmentForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const measurements = getAssessmentMeasurementsPayload({ allowIncomplete: true });
  if (!measurements) {
    showToast('Complete as medidas adicionadas e nao repita o mesmo tipo.');
    return;
  }

  const patientId = state.editingMeasurement?.patientId
    || document.getElementById('assessmentPatient').value;
  const payload = {
    weightKg: Number(document.getElementById('assessmentWeight').value),
    heightCm: Number(document.getElementById('assessmentHeight').value),
    ...measurements,
  };
  const bodyFatValue = document.getElementById('assessmentBodyFat').value;
  const notesValue = document.getElementById('assessmentNotes').value;

  if (state.editingMeasurement) {
    payload.bodyFatPercent = bodyFatValue ? Number(bodyFatValue) : null;
    payload.notes = notesValue.trim() || null;
    for (const field of [
      'neckCircumferenceCm',
      'chestCircumferenceCm',
      'waistCircumferenceCm',
      'hipCircumferenceCm',
      'armCircumferenceCm',
      'thighCircumferenceCm',
      'calfCircumferenceCm',
      'tricepsSkinfoldMm',
      'bicepsSkinfoldMm',
      'subscapularSkinfoldMm',
      'suprailiacSkinfoldMm',
      'abdominalSkinfoldMm',
      'thighSkinfoldMm',
      'calfSkinfoldMm',
    ]) {
      payload[field] = Object.hasOwn(measurements, field) ? measurements[field] : null;
    }
  } else {
    if (bodyFatValue) {
      payload.bodyFatPercent = Number(bodyFatValue);
    }
    payload.notes = notesValue;
  }

  try {
    await apiRequest(
      state.editingMeasurement
        ? `/api/patients/${encodeURIComponent(patientId)}/measurements/${encodeURIComponent(state.editingMeasurement.measurementId)}`
        : `/api/patients/${encodeURIComponent(patientId)}/measurements`,
      {
      method: state.editingMeasurement ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
      },
    );
    showToast(state.editingMeasurement ? 'Avaliação atualizada!' : 'Avaliação salva!');
    closeModal('assessment');
    state.editingMeasurement = null;
    await fetchDatabaseData();
    renderPatientProfileModal(state.patients.find((patient) => patient.id === patientId));
  } catch(err) { showToast(err.message || 'Erro ao salvar avaliação.'); }
});


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


document.getElementById('addParticipantForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const patientId = document.getElementById('addPartPatient').value;
  try {
    await apiRequest(`/api/nutritionist/challenges/${state.activeChallengeId}/participants`, { method: 'POST', body: JSON.stringify({ patientId }) });
    showToast('Paciente adicionado ao desafio!'); closeModal('addParticipant'); await fetchDatabaseData();
  } catch(err) { showToast('Erro ao adicionar paciente.'); }
});


function renderNutritionistPage() {
  const requestedPage = window.location.hash.slice(1);
  const storedPage = window.history.state?.nutriflowDashboardPage;
  const pageIds = ['pacientes', 'plano-alimentar', 'avaliacoes', 'conversas'];
  const activePage = pageIds.includes(requestedPage)
    ? requestedPage
    : pageIds.includes(storedPage)
      ? storedPage
      : 'pacientes';
  const showConversations = activePage === 'conversas';

  if (window.location.hash || storedPage !== activePage) {
    window.history.replaceState(
      { ...window.history.state, nutriflowDashboardPage: activePage },
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  }

  const dashboard = document.getElementById('nutritionistDashboard');
  const conversationPage = document.getElementById('conversationPage');
  dashboard?.classList.toggle('hidden', showConversations);
  conversationPage?.classList.toggle('hidden', !showConversations);

  document.querySelectorAll('[data-dashboard-view]').forEach((page) => {
    page.classList.toggle('hidden', page.id !== activePage);
  });

  document.querySelectorAll('.nutritionist-sidebar [data-dashboard-page="conversations"]').forEach((link) => {
    link.classList.toggle('bg-white/12', showConversations);
    link.classList.toggle('text-white', showConversations);
    link.classList.toggle('text-white/75', !showConversations);
  });
  document.querySelectorAll('.nutritionist-sidebar [data-dashboard-page="patients"], .nutritionist-sidebar [data-dashboard-page="plans"], .nutritionist-sidebar [data-dashboard-page="assessments"]').forEach((link) => {
    const isActive = link.getAttribute('href') === `#${activePage}`;
    link.classList.toggle('bg-white/12', isActive);
    link.classList.toggle('text-white', isActive);
    link.classList.toggle('text-white/75', !isActive);
  });

  document.querySelectorAll('[data-dashboard-page="conversations"]').forEach((link) => {
    link.classList.toggle('is-active', showConversations);
  });
  document.querySelectorAll('[data-dashboard-page="patients"], [data-dashboard-page="plans"], [data-dashboard-page="assessments"]').forEach((link) => {
    const isActive = link.getAttribute('href') === `#${activePage}`;
    link.classList.toggle('is-active', isActive);
  });

  if (showConversations) void loadConversationWorkspace({ scrollToEnd: true });
}

function isNutritionistConversationPage() {
  return window.location.hash === '#conversas'
    || window.history.state?.nutriflowDashboardPage === 'conversas';
}

function discardWorkspaceVoiceDraft() {
  window.NutriFlowChatVoice.releaseAudioPlayers(workspaceVoicePreview);
  workspaceVoiceDraft = null;
  workspaceVoicePreview?.replaceChildren();
  workspaceVoicePreview?.classList.add('hidden');
  workspaceMessageForm?.classList.remove('hidden');
  if (workspaceMessageInput) workspaceMessageInput.disabled = false;
  if (workspaceVoiceButton) {
    workspaceVoiceButton.disabled = !state.workspaceConversationId;
    workspaceVoiceButton.textContent = 'Voz';
  }
}

const workspaceVoiceRecorder = window.NutriFlowChatVoice?.createRecorder({
  onRecordingChange(isRecording, elapsedSeconds, transcriptionAvailable) {
    if (workspaceVoiceButton) {
      workspaceVoiceButton.textContent = isRecording ? 'Finalizar' : 'Voz';
      workspaceVoiceButton.setAttribute('aria-label', isRecording ? 'Finalizar gravação' : 'Gravar mensagem de voz');
    }
    workspaceVoiceRecording?.classList.toggle('hidden', !isRecording);
    workspaceVoiceRecording?.classList.toggle('flex', isRecording);
    if (workspaceVoiceRecordingTime) {
      const suffix = transcriptionAvailable ? ' · transcrevendo' : '';
      workspaceVoiceRecordingTime.textContent = `Gravando · ${window.NutriFlowChatVoice.formatDuration(elapsedSeconds)}${suffix}`;
    }
    if (workspaceMessageInput) workspaceMessageInput.disabled = isRecording || state.isSendingWorkspaceMessage;
  },
  onTranscript(transcript) {
    if (workspaceVoiceDraft) workspaceVoiceDraft.transcript = transcript;
  },
  onDraft(draft) {
    workspaceVoiceDraft = { ...draft };
    workspaceVoiceRecording?.classList.add('hidden');
    workspaceVoiceRecording?.classList.remove('flex');
    workspaceMessageForm?.classList.add('hidden');
    workspaceVoicePreview?.classList.remove('hidden');
    window.NutriFlowChatVoice.renderDraftPreview(workspaceVoicePreview, workspaceVoiceDraft, {
      onTranscriptChange(value) {
        workspaceVoiceDraft.transcript = value;
      },
      onDiscard: discardWorkspaceVoiceDraft,
      async onSend(value) {
        if (state.isSendingWorkspaceMessage || !workspaceVoiceDraft || !workspaceRecordingConversationId) return;
        state.isSendingWorkspaceMessage = true;
        renderWorkspaceMessages();
        if (workspaceMessageStatus) {
          workspaceMessageStatus.textContent = 'Enviando mensagem de voz...';
          workspaceMessageStatus.classList.remove('hidden', 'text-red-700');
          workspaceMessageStatus.classList.add('text-nutriflow-700');
        }
        try {
          await apiRequest('/api/chat/messages', {
            method: 'POST',
            body: JSON.stringify({
              recipientId: workspaceRecordingConversationId,
              audioBase64: await window.NutriFlowChatVoice.blobToBase64(value.audio),
              audioMimeType: value.audioMimeType,
              audioDurationSeconds: value.audioDurationSeconds,
              ...(value.transcript ? { transcript: value.transcript } : {}),
            }),
          });
          discardWorkspaceVoiceDraft();
          await loadConversationWorkspace({ scrollToEnd: true });
          if (workspaceMessageStatus) workspaceMessageStatus.textContent = 'Mensagem de voz enviada.';
          showToast('Mensagem de voz enviada.');
        } catch (error) {
          if (workspaceMessageStatus) {
            workspaceMessageStatus.textContent = `Falha no envio: ${error.message || 'tente novamente.'}`;
            workspaceMessageStatus.classList.remove('hidden', 'text-nutriflow-700');
            workspaceMessageStatus.classList.add('text-red-700');
          }
          showToast(error.message || 'Não foi possível enviar o áudio.');
          throw error;
        } finally {
          state.isSendingWorkspaceMessage = false;
          renderWorkspaceMessages();
        }
      },
    });
  },
  onError(message) {
    if (workspaceMessageStatus) {
      workspaceMessageStatus.textContent = message;
      workspaceMessageStatus.classList.remove('hidden', 'text-nutriflow-700');
      workspaceMessageStatus.classList.add('text-red-700');
    }
    showToast(message);
  },
});

workspaceVoiceButton?.addEventListener('click', async () => {
  if (workspaceVoiceRecorder?.isRecording) {
    await workspaceVoiceRecorder.stop();
    return;
  }
  if (!state.workspaceConversationId || state.isSendingWorkspaceMessage || workspaceVoiceDraft) return;
  workspaceRecordingConversationId = state.workspaceConversationId;
  await workspaceVoiceRecorder?.start();
});

workspaceVoiceCancel?.addEventListener('click', async () => {
  await workspaceVoiceRecorder?.cancel();
  workspaceVoiceRecording?.classList.add('hidden');
  workspaceVoiceRecording?.classList.remove('flex');
  if (workspaceMessageInput) workspaceMessageInput.disabled = false;
  if (workspaceVoiceButton) workspaceVoiceButton.textContent = 'Voz';
});

async function handleWorkspaceMessageSubmit(event) {
  event.preventDefault();
  if (workspaceVoiceRecorder?.isRecording || workspaceVoiceDraft) {
    showToast('Finalize, envie ou apague a gravação antes de enviar uma mensagem de texto.');
    return;
  }
  const conversationId = state.workspaceConversationId;
  const content = workspaceMessageInput?.value.trim() || '';
  if (!conversationId) {
    showToast('Selecione uma conversa antes de enviar.');
    return;
  }
  if (!content) {
    showToast('Digite uma mensagem para enviar.');
    workspaceMessageInput?.focus();
    return;
  }
  if (content.length > 2000 || state.isSendingWorkspaceMessage) return;

  state.isSendingWorkspaceMessage = true;
  renderWorkspaceMessages();
  if (workspaceMessageStatus) {
    workspaceMessageStatus.textContent = 'Enviando mensagem...';
    workspaceMessageStatus.classList.remove('hidden', 'text-red-700');
    workspaceMessageStatus.classList.add('text-nutriflow-700');
  }
  if (workspaceMessageSubmit) workspaceMessageSubmit.textContent = 'Enviando...';
  try {
    await apiRequest('/api/chat/messages', {
      method: 'POST',
      body: JSON.stringify({ recipientId: conversationId, content }),
    });
    workspaceMessageInput.value = '';
    await loadConversationWorkspace({ scrollToEnd: true });
    if (workspaceMessageStatus) workspaceMessageStatus.textContent = 'Mensagem enviada.';
    showToast('Mensagem enviada.');
  } catch (error) {
    if (workspaceMessageStatus) {
      workspaceMessageStatus.textContent = `Falha no envio: ${error.message || 'tente novamente.'}`;
      workspaceMessageStatus.classList.remove('hidden', 'text-nutriflow-700');
      workspaceMessageStatus.classList.add('text-red-700');
    }
    showToast(error.message || 'Não foi possível enviar a mensagem.');
  } finally {
    state.isSendingWorkspaceMessage = false;
    renderWorkspaceMessages();
    if (workspaceMessageSubmit) workspaceMessageSubmit.textContent = 'Enviar';
    workspaceMessageInput?.focus();
  }
}

conversationList?.addEventListener('click', (event) => {
  const conversationButton = event.target.closest('[data-conversation-id]');
  if (!conversationButton) return;
  if (workspaceVoiceRecorder?.isRecording || workspaceVoiceDraft) {
    showToast('Finalize ou apague a gravação antes de trocar de conversa.');
    return;
  }
  state.workspaceConversationId = conversationButton.dataset.conversationId;
  state.workspaceMessages = [];
  state.workspacePagination = null;
  state.workspacePage = 1;
  renderWorkspaceConversationList();
  renderWorkspaceMessages();
  void loadConversationWorkspace({ scrollToEnd: true });
});

workspaceMessageForm?.addEventListener('submit', handleWorkspaceMessageSubmit);
loadOlderMessagesButton?.addEventListener('click', () => void loadOlderConversationMessages());
document.querySelectorAll('[data-dashboard-page][href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const requestedPage = link.getAttribute('href').slice(1);
    const pageIds = ['pacientes', 'plano-alimentar', 'avaliacoes', 'conversas'];

    if (!pageIds.includes(requestedPage)) {
      return;
    }

    event.preventDefault();
    if (window.history.state?.nutriflowDashboardPage === requestedPage) {
      return;
    }

    window.history.pushState(
      { ...window.history.state, nutriflowDashboardPage: requestedPage },
      '',
      `${window.location.pathname}${window.location.search}`,
    );
    renderNutritionistPage();
  });
});
window.addEventListener('popstate', renderNutritionistPage);


async function init() {
  if (!ensureNutritionistAccess()) return;
  renderHeader();
  bindButtons();
  renderNutritionistPage();
  syncNutritionistRealtimeAvailability();
  await fetchDatabaseData();
}
init();
