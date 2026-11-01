const { createApiClient, createSessionManager, escapeHtml, getInitials } = window.NutriFlowCore;

const session = createSessionManager({ redirectTo: 'index.html' });
const apiRequest = createApiClient({
  getToken: session.getToken,
  onUnauthorized(message) {
    if (message) {
      showToast(message);
    }
    window.setTimeout(() => session.clear(), 700);
  }
});

const state = {
  challenges: [],
  linkedPatients: [],
  selectedChallengeId: null,
  editingChallengeId: null,
};

const toast = document.getElementById('nutritionistToast');
const challengeList = document.getElementById('challengeList');
const challengeDetailPanel = document.getElementById('challengeDetailPanel');
const challengeDetailHeader = document.getElementById('challengeDetailHeader');
const participantProgressList = document.getElementById('participantProgressList');
const participantCheckInList = document.getElementById('participantCheckInList');
const sidebarSummary = document.getElementById('sidebarSummary');
const challengeModal = document.getElementById('challengeModal');
const challengeModalTitle = document.getElementById('challengeModalTitle');
const challengeForm = document.getElementById('challengeForm');
const challengeTitleInput = document.getElementById('challengeTitleInput');
const challengeDescriptionInput = document.getElementById('challengeDescriptionInput');
const challengeCategoryInput = document.getElementById('challengeCategoryInput');
const challengeGoalDescriptionInput = document.getElementById('challengeGoalDescriptionInput');
const challengeGoalTargetInput = document.getElementById('challengeGoalTargetInput');
const challengeStartDateInput = document.getElementById('challengeStartDateInput');
const challengeEndDateInput = document.getElementById('challengeEndDateInput');
const addParticipantModal = document.getElementById('addParticipantModal');
const challengePatientSelect = document.getElementById('challengePatientSelect');
const addParticipantForm = document.getElementById('addParticipantForm');

const statusMap = {
  AGENDADO: 'Agendado',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  ENCERRADO: 'Encerrado',
};

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
  }, 2800);
}

function ensureAuthorized() {
  const user = session.getUser();
  const profile = String(user?.profile || '').trim().toLowerCase();
  if (profile !== 'nutricionista' && profile !== 'nutritionist') {
    window.location.replace('/dashboard');
    return false;
  }

  return true;
}

function formatDate(value) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatStatusLabel(status) {
  return statusMap[status] || String(status || 'Ativo');
}

function getChallengeProgress(challenge) {
  if (!challenge) return 0;
  const average = Number(challenge.averageProgress || 0);
  return Math.min(100, Math.max(0, average));
}

function getSelectedChallenge() {
  return state.challenges.find((challenge) => challenge.id === state.selectedChallengeId) || state.challenges[0] || null;
}

function setChallengeModalState(isOpen) {
  challengeModal?.classList.toggle('hidden', !isOpen);
  document.body.classList.toggle('modal-open', isOpen);
}

function resetChallengeForm() {
  state.editingChallengeId = null;
  challengeForm?.reset();
  challengeModalTitle.textContent = 'Criar desafio';
  challengeCategoryInput.value = 'GERAL';
  challengeStartDateInput.value = new Date().toISOString().slice(0, 10);
  challengeEndDateInput.value = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function openChallengeModal(challenge = null) {
  if (challenge) {
    state.editingChallengeId = challenge.id;
    challengeModalTitle.textContent = 'Editar desafio';
    challengeTitleInput.value = challenge.title || '';
    challengeDescriptionInput.value = challenge.description || '';
    challengeCategoryInput.value = challenge.category || 'GERAL';
    challengeGoalDescriptionInput.value = challenge.goalDescription || '';
    challengeGoalTargetInput.value = challenge.goalTarget == null ? '' : challenge.goalTarget;
    challengeStartDateInput.value = challenge.startDate ? challenge.startDate.slice(0, 10) : '';
    challengeEndDateInput.value = challenge.endDate ? challenge.endDate.slice(0, 10) : '';
  } else {
    resetChallengeForm();
  }

  setChallengeModalState(true);
}

function closeChallengeModal() {
  setChallengeModalState(false);
  challengeForm?.reset();
}

function handleChallengeDelete(challengeId) {
  const challenge = state.challenges.find((item) => item.id === challengeId);
  if (!challenge || !window.confirm(`Arquivar o desafio "${challenge.title}"?`)) {
    return;
  }

  apiRequest(`/api/nutritionist/challenges/${encodeURIComponent(challengeId)}`, { method: 'DELETE' })
    .then(() => {
      showToast('Desafio arquivado com sucesso.');
      return loadChallenges();
    })
    .catch((error) => {
      showToast(error.message || 'Não foi possível arquivar o desafio.');
    });
}

function renderParticipantProgress(participants = []) {
  if (!participants.length) {
    participantProgressList.innerHTML = '<div class="rounded-2xl border border-dashed border-nutriflow-200 bg-white px-4 py-5 text-sm text-nutriflow-600">Nenhum paciente inscrito neste desafio.</div>';
    return;
  }

  const rows = participants.map((participant) => {
    const name = participant.patient || 'Paciente';
    const progress = Math.min(100, Math.max(0, Number(participant.progress || 0)));
    return `
      <button type="button" data-participant-id="${escapeHtml(participant.id)}" class="w-full rounded-[20px] border border-nutriflow-100 bg-white p-3 text-left transition hover:border-nutriflow-200 hover:bg-nutriflow-50">
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <span class="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-nutriflow-500 to-nutriflow-700 text-xs font-extrabold text-white">${escapeHtml(getInitials(name, 'P'))}</span>
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-nutriflow-950">${escapeHtml(name)}</p>
              <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-nutriflow-500">${escapeHtml(participant.status || 'INSCRITO')}</p>
            </div>
          </div>
          <span class="text-sm font-extrabold text-nutriflow-800">${progress.toFixed(0)}%</span>
        </div>
        <div class="mini-progress mt-3"><span style="width:${progress}%"></span></div>
      </button>
    `;
  }).join('');

  participantProgressList.innerHTML = rows;
}

function renderCheckIns(participants = [], participantId = '') {
  const selectedParticipant = participants.find((participant) => participant.id === participantId) || participants[0];

  if (!selectedParticipant) {
    participantCheckInList.innerHTML = '<div class="rounded-2xl border border-dashed border-nutriflow-200 bg-white px-4 py-5 text-sm text-nutriflow-600">Selecione um paciente para ver o histórico.</div>';
    return;
  }

  const checkIns = Array.isArray(selectedParticipant.checkIns) ? selectedParticipant.checkIns : [];

  if (!checkIns.length) {
    participantCheckInList.innerHTML = `<div class="rounded-2xl border border-dashed border-nutriflow-200 bg-white px-4 py-5 text-sm text-nutriflow-600">${escapeHtml(selectedParticipant.patient || 'Paciente')} ainda não registrou check-ins neste desafio.</div>`;
    return;
  }

  participantCheckInList.innerHTML = checkIns.slice().sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate)).map((entry) => `
    <div class="rounded-[18px] border border-nutriflow-100 bg-nutriflow-50/60 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-bold text-nutriflow-950">${formatDate(entry.checkInDate)}</p>
        <span class="rounded-full ${entry.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em]">${entry.completed ? 'Concluído' : 'Registro'}</span>
      </div>
      <div class="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-nutriflow-700">
        <span>${entry.recordedValue == null ? 'Sem valor' : `${Number(entry.recordedValue).toLocaleString('pt-BR')} pts`}</span>
        <span>${entry.notes ? escapeHtml(entry.notes.slice(0, 48)) : 'Sem observação'}</span>
      </div>
    </div>
  `).join('');
}

function renderChallengeDetail(selectedChallenge) {
  if (!selectedChallenge) {
    challengeDetailPanel.classList.add('hidden');
    return;
  }

  challengeDetailPanel.classList.remove('hidden');
  const selectedParticipantId = selectedChallenge.participants?.find((participant) => participant.id === state.selectedParticipantId)?.id || selectedChallenge.participants?.[0]?.id || '';
  state.selectedParticipantId = selectedParticipantId;

  challengeDetailHeader.innerHTML = `
    <div>
      <p class="text-xs font-bold uppercase tracking-[0.18em] text-nutriflow-500">${escapeHtml(selectedChallenge.category || 'GERAL')}</p>
      <h3 class="mt-2 text-3xl font-extrabold tracking-[-0.06em] text-nutriflow-950">${escapeHtml(selectedChallenge.title)}</h3>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-nutriflow-700">${escapeHtml(selectedChallenge.description || 'Sem descrição adicional para este desafio.')}</p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <span class="rounded-full bg-nutriflow-100 px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-nutriflow-800">${escapeHtml(formatStatusLabel(selectedChallenge.status))}</span>
      <span class="rounded-full border border-nutriflow-200 bg-white px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-nutriflow-700">${selectedChallenge.participantCount || 0} participantes</span>
      <button type="button" data-action="edit" data-challenge-id="${escapeHtml(selectedChallenge.id)}" class="rounded-xl border border-nutriflow-200 bg-white px-3 py-2 text-sm font-bold text-nutriflow-800 hover:bg-nutriflow-50">Editar</button>
      <button type="button" data-action="archive" data-challenge-id="${escapeHtml(selectedChallenge.id)}" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100">Arquivar</button>
    </div>
  `;

  renderParticipantProgress(selectedChallenge.participants || []);
  renderCheckIns(selectedChallenge.participants || [], selectedParticipantId);

  participantProgressList.querySelectorAll('[data-participant-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedParticipantId = button.dataset.participantId;
      renderChallengeDetail(getSelectedChallenge());
    });
  });

  challengeDetailHeader.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    const challengeId = button.dataset.challengeId;
    if (action === 'edit') {
      button.addEventListener('click', () => {
        const challenge = state.challenges.find((item) => item.id === challengeId);
        if (challenge) openChallengeModal(challenge);
      });
    }

    if (action === 'archive') {
      button.addEventListener('click', () => handleChallengeDelete(challengeId));
    }
  });
}

function renderChallenges() {
  const activeChallenges = state.challenges;
  sidebarSummary.textContent = String(activeChallenges.length);

  if (!activeChallenges.length) {
    challengeList.innerHTML = '<div class="col-span-full rounded-[24px] border border-dashed border-nutriflow-200 bg-white px-5 py-8 text-center text-sm text-nutriflow-600">Nenhum desafio cadastrado. Crie o primeiro desafio para iniciar a campanha.</div>';
    challengeDetailPanel.classList.add('hidden');
    return;
  }

  challengeList.innerHTML = activeChallenges.map((challenge) => {
    const isSelected = challenge.id === state.selectedChallengeId;
    const progress = getChallengeProgress(challenge);
    return `
      <article class="rounded-[24px] border ${isSelected ? 'border-nutriflow-300 bg-nutriflow-50/80' : 'border-nutriflow-100 bg-white'} p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-nutriflow-200">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-nutriflow-500">${escapeHtml(challenge.category || 'GERAL')}</p>
            <h3 class="mt-2 text-xl font-extrabold tracking-[-0.04em] text-nutriflow-950">${escapeHtml(challenge.title)}</h3>
          </div>
          <span class="rounded-full bg-nutriflow-100 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-800">${escapeHtml(formatStatusLabel(challenge.status))}</span>
        </div>

        <p class="mt-3 text-sm leading-6 text-nutriflow-700">${escapeHtml(challenge.description || 'Sem descrição disponível.')}</p>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-[18px] border border-nutriflow-100 bg-white p-3">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-500">Meta</p>
            <p class="mt-2 text-sm font-bold text-nutriflow-950">${escapeHtml(challenge.goalDescription || 'Meta não definida')}</p>
          </div>
          <div class="rounded-[18px] border border-nutriflow-100 bg-white p-3">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-500">Participantes</p>
            <p class="mt-2 text-sm font-bold text-nutriflow-950">${challenge.participantCount || 0}</p>
          </div>
          <div class="rounded-[18px] border border-nutriflow-100 bg-white p-3 sm:col-span-2">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-500">Período</p>
            <p class="mt-2 text-sm font-bold text-nutriflow-950">${formatDate(challenge.startDate)} até ${formatDate(challenge.endDate)}</p>
          </div>
        </div>

        <div class="mt-4">
          <div class="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-nutriflow-600">
            <span>Média do progresso</span>
            <span>${progress.toFixed(0)}%</span>
          </div>
          <div class="mini-progress"><span style="width:${progress}%"></span></div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button type="button" data-action="select" data-challenge-id="${escapeHtml(challenge.id)}" class="rounded-xl bg-nutriflow-950 px-3 py-2 text-xs font-bold text-white">Detalhes</button>
          <button type="button" data-action="edit" data-challenge-id="${escapeHtml(challenge.id)}" class="rounded-xl border border-nutriflow-200 bg-white px-3 py-2 text-xs font-bold text-nutriflow-800">Editar</button>
          <button type="button" data-action="archive" data-challenge-id="${escapeHtml(challenge.id)}" class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Arquivar</button>
        </div>
      </article>
    `;
  }).join('');

  challengeList.querySelectorAll('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    const challengeId = button.dataset.challengeId;

    if (action === 'select') {
      button.addEventListener('click', () => {
        state.selectedChallengeId = challengeId;
        const selectedChallenge = getSelectedChallenge();
        renderChallenges();
        renderChallengeDetail(selectedChallenge);
      });
    }

    if (action === 'edit') {
      button.addEventListener('click', () => {
        const challenge = state.challenges.find((item) => item.id === challengeId);
        if (challenge) openChallengeModal(challenge);
      });
    }

    if (action === 'archive') {
      button.addEventListener('click', () => handleChallengeDelete(challengeId));
    }
  });

  const selected = getSelectedChallenge();
  if (selected) {
    renderChallengeDetail(selected);
  } else {
    challengeDetailPanel.classList.add('hidden');
  }
}

async function loadLinkedPatients() {
  const result = await apiRequest('/api/nutritionist/patients');
  state.linkedPatients = Array.isArray(result?.patients) ? result.patients : [];

  challengePatientSelect.innerHTML = '<option value="">Selecione um paciente</option>' + state.linkedPatients.map((patient) => `
    <option value="${escapeHtml(patient.id)}">${escapeHtml(patient.name || patient.email || 'Paciente')}</option>
  `).join('');
}

async function loadChallenges() {
  const response = await apiRequest('/api/nutritionist/challenges');
  state.challenges = Array.isArray(response?.challenges) ? response.challenges : [];
  if (!state.selectedChallengeId && state.challenges[0]) {
    state.selectedChallengeId = state.challenges[0].id;
  }
  renderChallenges();
}

async function saveChallenge(event) {
  event.preventDefault();

  const payload = {
    title: challengeTitleInput.value.trim(),
    description: challengeDescriptionInput.value.trim(),
    category: challengeCategoryInput.value || 'GERAL',
    goalDescription: challengeGoalDescriptionInput.value.trim(),
    goalTarget: challengeGoalTargetInput.value === '' ? null : Number(challengeGoalTargetInput.value),
    startDate: challengeStartDateInput.value,
    endDate: challengeEndDateInput.value,
  };

  if (!payload.title || !payload.goalDescription || !payload.startDate || !payload.endDate) {
    showToast('Preencha título, meta, data inicial e final.');
    return;
  }

  const method = state.editingChallengeId ? 'PUT' : 'POST';
  const url = state.editingChallengeId
    ? `/api/nutritionist/challenges/${encodeURIComponent(state.editingChallengeId)}`
    : '/api/nutritionist/challenges';

  try {
    await apiRequest(url, {
      method,
      body: JSON.stringify(payload),
    });

    showToast(state.editingChallengeId ? 'Desafio atualizado.' : 'Desafio criado com sucesso.');
    closeChallengeModal();
    await loadChallenges();
    const challenge = state.challenges.find((item) => item.id === state.selectedChallengeId) || state.challenges[0] || null;
    if (challenge) {
      state.selectedChallengeId = challenge.id;
      renderChallenges();
    }
  } catch (error) {
    showToast(error.message || 'Não foi possível salvar o desafio.');
  }
}

async function addParticipantToChallenge(event) {
  event.preventDefault();
  const patientId = challengePatientSelect.value;
  const challengeId = getSelectedChallenge()?.id;

  if (!patientId || !challengeId) {
    showToast('Selecione um paciente e um desafio.');
    return;
  }

  try {
    await apiRequest(`/api/nutritionist/challenges/${encodeURIComponent(challengeId)}/participants`, {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });

    showToast('Paciente adicionado ao desafio.');
    addParticipantForm.reset();
    addParticipantModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    await loadChallenges();
  } catch (error) {
    showToast(error.message || 'Não foi possível adicionar o paciente.');
  }
}

function initEvents() {
  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const modalKey = button.dataset.close;
      if (modalKey === 'challenge') {
        closeChallengeModal();
      }
      if (modalKey === 'addParticipant') {
        addParticipantModal.classList.add('hidden');
        document.body.classList.remove('modal-open');
      }
    });
  });

  challengeForm?.addEventListener('submit', saveChallenge);
  addParticipantForm?.addEventListener('submit', addParticipantToChallenge);
  document.getElementById('createChallengeBtn')?.addEventListener('click', () => {
    resetChallengeForm();
    setChallengeModalState(true);
  });
  document.getElementById('quickCreateBtn')?.addEventListener('click', () => {
    resetChallengeForm();
    setChallengeModalState(true);
  });
  document.getElementById('refreshChallengesBtn')?.addEventListener('click', () => {
    loadChallenges().catch((error) => showToast(error.message || 'Não foi possível atualizar os desafios.'));
  });
  document.getElementById('addParticipantBtn')?.addEventListener('click', async () => {
    const challenge = getSelectedChallenge();
    if (!challenge) {
      showToast('Selecione um desafio primeiro.');
      return;
    }

    await loadLinkedPatients();
    addParticipantModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  });
}

async function initialize() {
  if (!ensureAuthorized()) {
    return;
  }

  initEvents();
  await Promise.all([
    loadChallenges(),
    loadLinkedPatients(),
  ]);
  resetChallengeForm();
}

initialize().catch((error) => {
  showToast(error.message || 'Não foi possível carregar os desafios.');
});
