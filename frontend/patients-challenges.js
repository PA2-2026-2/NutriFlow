const { createApiClient, createSessionManager, escapeHtml } = window.NutriFlowCore;

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
};

const challengeList = document.getElementById('challengeList');
const sidebarChallengeCount = document.getElementById('sidebarChallengeCount');
const toast = document.getElementById('patientToast');

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

  if (profile !== 'paciente' && profile !== 'patient') {
    window.location.replace('/dashboard-nutricionista');
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

function getCurrentParticipation(challenge) {
  const currentUser = session.getUser();
  return (challenge.participants || []).find((participant) => participant.patientId === currentUser?.id) || null;
}

function getEmptyState() {
  return `
    <article class="rounded-[28px] border border-dashed border-nutriflow-200 bg-white/80 p-6 text-center text-sm text-nutriflow-600">
      Nenhum desafio disponível no momento. Aguarde a sua nutricionista publicar uma nova meta ou acompanhe seu painel principal.
    </article>
  `;
}

function renderCheckIns(checkIns = []) {
  if (!checkIns.length) {
    return '<div class="mt-3 rounded-2xl border border-dashed border-nutriflow-200 bg-nutriflow-50 px-3 py-3 text-xs text-nutriflow-600">Ainda não há check-ins registrados.</div>';
  }

  return checkIns.slice().sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate)).map((entry) => `
    <div class="mt-2 rounded-2xl border border-nutriflow-100 bg-nutriflow-50 px-3 py-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-bold uppercase tracking-[0.14em] text-nutriflow-600">${formatDate(entry.checkInDate)}</span>
        <span class="rounded-full ${entry.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em]">${entry.completed ? 'Concluído' : 'Registro'}</span>
      </div>
      <div class="mt-1 text-sm text-nutriflow-800">
        <span class="font-bold">${entry.recordedValue == null ? 'Valor não informado' : `${Number(entry.recordedValue).toLocaleString('pt-BR')} pts`}</span>
      </div>
      <p class="mt-1 text-xs leading-5 text-nutriflow-700">${escapeHtml(entry.notes || 'Sem observação adicional.')}</p>
    </div>
  `).join('');
}

function renderChallenges() {
  sidebarChallengeCount.textContent = String(state.challenges.length);

  if (!state.challenges.length) {
    challengeList.innerHTML = getEmptyState();
    return;
  }

  challengeList.innerHTML = state.challenges.map((challenge) => {
    const participation = getCurrentParticipation(challenge);
    const progress = Math.min(100, Math.max(0, Number(participation?.progress || challenge.averageProgress || 0)));
    const enrolled = Boolean(challenge.enrolled || participation);
    const statusLabel = formatStatusLabel(challenge.status);
    const progressNote = participation?.checkIns?.length ? `${participation.checkIns.length} registro(s)` : 'Sem registro';

    return `
      <article class="rounded-[28px] border border-nutriflow-100 bg-white/90 p-5 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-nutriflow-500">${escapeHtml(challenge.category || 'GERAL')}</p>
            <h2 class="mt-2 text-2xl font-extrabold tracking-[-0.05em] text-nutriflow-950">${escapeHtml(challenge.title)}</h2>
          </div>
          <span class="rounded-full ${challenge.status === 'CONCLUIDO' ? 'bg-emerald-100 text-emerald-700' : challenge.status === 'ENCERRADO' ? 'bg-red-100 text-red-700' : 'bg-nutriflow-100 text-nutriflow-800'} px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em]">${escapeHtml(statusLabel)}</span>
        </div>

        <p class="mt-3 text-sm leading-6 text-nutriflow-700">${escapeHtml(challenge.description || 'Sem descrição adicional.')}</p>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-[18px] border border-nutriflow-100 bg-nutriflow-50 p-3">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-500">Meta</p>
            <p class="mt-2 text-sm font-bold text-nutriflow-950">${escapeHtml(challenge.goalDescription || 'Meta não definida')}</p>
          </div>
          <div class="rounded-[18px] border border-nutriflow-100 bg-nutriflow-50 p-3">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-500">Alvo</p>
            <p class="mt-2 text-sm font-bold text-nutriflow-950">${challenge.goalTarget == null ? 'Sem valor' : `${Number(challenge.goalTarget).toLocaleString('pt-BR')}`}</p>
          </div>
          <div class="rounded-[18px] border border-nutriflow-100 bg-nutriflow-50 p-3 sm:col-span-2">
            <p class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-500">Período</p>
            <p class="mt-2 text-sm font-bold text-nutriflow-950">${formatDate(challenge.startDate)} até ${formatDate(challenge.endDate)}</p>
          </div>
        </div>

        <div class="mt-5 rounded-[20px] border border-nutriflow-100 bg-white p-3">
          <div class="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-[0.14em] text-nutriflow-600">
            <span>Progresso atual</span>
            <span>${progress.toFixed(0)}%</span>
          </div>
          <div class="mini-progress mt-3"><span style="width:${progress}%"></span></div>
          <p class="mt-2 text-xs text-nutriflow-600">${escapeHtml(progressNote)}</p>
        </div>

        <div class="mt-5 grid gap-3">
          ${enrolled ? '' : `<button type="button" data-action="enroll" data-challenge-id="${escapeHtml(challenge.id)}" class="rounded-[16px] bg-nutriflow-950 px-4 py-3 text-sm font-bold text-white">Inscrever-se</button>`}
          ${enrolled ? `<button type="button" data-action="finish" data-challenge-id="${escapeHtml(challenge.id)}" class="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">Marcar como concluído</button>` : ''}
        </div>

        <div class="mt-5 rounded-[20px] border border-nutriflow-100 bg-nutriflow-50 p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-base font-extrabold tracking-[-0.04em] text-nutriflow-950">Check-in diário</h3>
            <span class="text-[10px] font-extrabold uppercase tracking-[0.14em] text-nutriflow-500">${enrolled ? 'Ativo' : 'Disponível'}</span>
          </div>

          <form data-checkin-form="${escapeHtml(challenge.id)}" class="mt-3 grid gap-3">
            <div class="grid gap-3 md:grid-cols-2">
              <label class="nf-field">
                <span>Data</span>
                <input name="checkInDate" type="date" class="font-bold" value="${new Date().toISOString().slice(0, 10)}" required />
              </label>
              <label class="nf-field">
                <span>Valor realizado</span>
                <input name="recordedValue" type="number" step="0.1" min="0" class="font-bold" value="" placeholder="Ex.: 3000" />
              </label>
            </div>
            <label class="nf-field">
              <span>Observação</span>
              <textarea name="notes" rows="2" class="font-bold" placeholder="Descreva o que foi realizado hoje"></textarea>
            </label>
            <button type="submit" class="rounded-[16px] bg-nutriflow-950 px-4 py-3 text-sm font-bold text-white" ${enrolled ? '' : 'disabled'}>
              ${enrolled ? 'Registrar check-in' : 'Inscreva-se para registrar'}
            </button>
          </form>

          <div class="mt-4 border-t border-nutriflow-100 pt-4">
            <p class="text-xs font-bold uppercase tracking-[0.14em] text-nutriflow-500">Histórico</p>
            ${renderCheckIns(participation?.checkIns || [])}
          </div>
        </div>
      </article>
    `;
  }).join('');

  challengeList.querySelectorAll('[data-action="enroll"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const challengeId = button.dataset.challengeId;
      try {
        await apiRequest(`/api/patient/challenges/${encodeURIComponent(challengeId)}/enroll`, { method: 'POST' });
        showToast('Inscrição realizada com sucesso.');
        await loadChallenges();
      } catch (error) {
        showToast(error.message || 'Não foi possível concluir a inscrição.');
      }
    });
  });

  challengeList.querySelectorAll('[data-action="finish"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const challengeId = button.dataset.challengeId;
      try {
        await apiRequest(`/api/patient/challenges/${encodeURIComponent(challengeId)}/complete`, { method: 'PATCH' });
        showToast('Desafio marcado como concluído.');
        await loadChallenges();
      } catch (error) {
        showToast(error.message || 'Não foi possível concluir o desafio.');
      }
    });
  });

  challengeList.querySelectorAll('[data-checkin-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const challengeId = form.dataset.checkinForm;
      const challenge = state.challenges.find((item) => item.id === challengeId);
      const participation = challenge ? getCurrentParticipation(challenge) : null;

      if (!challenge || !participation) {
        showToast('Você precisa se inscrever no desafio antes de registrar check-ins.');
        return;
      }

      const formData = new FormData(form);
      const payload = {
        checkInDate: String(formData.get('checkInDate') || new Date().toISOString().slice(0, 10)),
        recordedValue: formData.get('recordedValue') === '' ? null : Number(formData.get('recordedValue')),
        notes: String(formData.get('notes') || '').trim(),
      };

      if (payload.recordedValue !== null && Number.isNaN(payload.recordedValue)) {
        showToast('Informe um valor válido para o check-in.');
        return;
      }

      try {
        await apiRequest(`/api/patient/challenges/${encodeURIComponent(challengeId)}/checkins`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        showToast('Check-in registrado com sucesso.');
        await loadChallenges();
      } catch (error) {
        showToast(error.message || 'Não foi possível registrar o check-in.');
      }
    });
  });
}

async function loadChallenges() {
  const response = await apiRequest('/api/patient/challenges');
  state.challenges = Array.isArray(response?.challenges) ? response.challenges : [];
  renderChallenges();
}

async function initialize() {
  if (!ensureAuthorized()) {
    return;
  }

  document.getElementById('refreshChallengesBtn')?.addEventListener('click', () => {
    loadChallenges().catch((error) => showToast(error.message || 'Não foi possível atualizar os desafios.'));
  });

  document.getElementById('goToDashboardBtn')?.addEventListener('click', () => {
    window.location.assign('/dashboard');
  });

  await loadChallenges();
}

initialize().catch((error) => {
  showToast(error.message || 'Não foi possível carregar os desafios.');
});
