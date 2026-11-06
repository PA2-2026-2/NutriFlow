(function initializePatientGoals() {
  const { createApiClient, createSessionManager, escapeHtml } = window.NutriFlowCore;
  const session = createSessionManager({ redirectTo: 'index.html' });
  const toast = window.NutriFlowCore.createToastController(document.getElementById('goalToast'));
  const apiRequest = createApiClient({
    getToken: session.getToken,
    onUnauthorized(message) {
      if (message) toast.show(message);
      window.setTimeout(() => session.clear(), 700);
    },
  });
  const list = document.getElementById('patientGoalList');
  const statusFilter = document.getElementById('patientGoalStatusFilter');
  let goals = [];

  const statusLabels = {
    ACTIVE: 'Ativa',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Expirada',
  };

  function formatDate(value) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  }

  function renderHistory(entries, unit) {
    if (!entries.length) return '<p class="mt-3 text-xs text-nutriflow-600">Nenhuma atualização registrada.</p>';
    return `<ol class="mt-3 max-h-48 space-y-2 overflow-y-auto">${entries.slice().reverse().map((entry) => `
      <li class="rounded-xl border border-nutriflow-100 bg-white px-3 py-2 text-xs">
        <div class="flex flex-wrap justify-between gap-2"><strong>${Number(entry.value).toLocaleString('pt-BR')} ${escapeHtml(unit)}</strong>
          <time>${formatDate(entry.recordedAt)}</time></div>
        <p class="mt-1 text-nutriflow-600">${escapeHtml(entry.notes || 'Sem observação')}</p>
      </li>`).join('')}</ol>`;
  }

  function render() {
    const filtered = goals.filter((goal) => !statusFilter.value || goal.status === statusFilter.value);
    if (!filtered.length) {
      list.innerHTML = '<div class="dashboard-surface rounded-[24px] p-6 text-sm text-nutriflow-700">Nenhuma meta encontrada para este filtro.</div>';
      return;
    }

    list.innerHTML = filtered.map((goal) => {
      const progress = Math.min(100, Math.max(0, goal.progressPercent));
      const canUpdate = goal.status === 'ACTIVE';
      return `
        <article class="dashboard-surface min-w-0 rounded-[26px] p-5 md:p-6">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0"><p class="text-xs font-extrabold uppercase tracking-[.16em] text-nutriflow-500">${escapeHtml(goal.category === 'CUSTOM' ? goal.customCategory || 'Personalizada' : goal.category.replaceAll('_', ' '))}</p>
              <h2 class="mt-2 text-xl font-extrabold">${escapeHtml(goal.title)}</h2></div>
            <span class="rounded-full bg-nutriflow-100 px-3 py-1 text-xs font-bold">${statusLabels[goal.status] || escapeHtml(goal.status)}</span>
          </div>
          <p class="mt-3 text-sm leading-6 text-nutriflow-700">${escapeHtml(goal.description || 'Sem descrição adicional.')}</p>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <p class="rounded-xl bg-nutriflow-50 p-3"><span class="block text-xs text-nutriflow-500">Inicial</span><strong>${goal.initialValue.toLocaleString('pt-BR')} ${escapeHtml(goal.unit)}</strong></p>
            <p class="rounded-xl bg-nutriflow-50 p-3"><span class="block text-xs text-nutriflow-500">Atual / alvo</span><strong>${goal.currentValue.toLocaleString('pt-BR')} / ${goal.targetValue.toLocaleString('pt-BR')} ${escapeHtml(goal.unit)}</strong></p>
            <p class="col-span-2 text-xs text-nutriflow-600">Prazo: ${formatDate(goal.endDate)}${goal.nutritionist?.name ? ` · Nutricionista: ${escapeHtml(goal.nutritionist.name)}` : ''}</p>
          </div>
          <div class="mt-4" role="progressbar" aria-label="Progresso da meta ${escapeHtml(goal.title)}" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
            <div class="flex justify-between text-xs font-bold"><span>Progresso</span><span>${progress.toFixed(0)}%</span></div>
            <div class="mini-progress mt-2"><span style="width:${progress}%"></span></div>
          </div>
          ${canUpdate ? `<form data-progress-form="${escapeHtml(goal.id)}" class="mt-4 grid gap-3 rounded-2xl border border-nutriflow-100 bg-nutriflow-50 p-4 sm:grid-cols-[1fr_1.5fr_auto]">
            <label class="nf-field"><span>Valor atualizado (${escapeHtml(goal.unit)})</span><input name="value" type="number" min="0" step="any" required /></label>
            <label class="nf-field"><span>Observação (opcional)</span><input name="notes" maxlength="1000" /></label>
            <button class="self-end rounded-xl bg-nutriflow-950 px-4 py-3 text-sm font-bold text-white" type="submit">Registrar</button>
          </form>` : ''}
          <details class="mt-4 rounded-2xl border border-nutriflow-100 bg-white p-4">
            <summary class="cursor-pointer text-sm font-bold">Histórico de atualizações (${goal.progressHistory.length})</summary>
            ${renderHistory(goal.progressHistory, goal.unit)}
          </details>
        </article>`;
    }).join('');
  }

  async function loadGoals() {
    const response = await apiRequest('/api/patients/goals');
    goals = response.goals || [];
    render();
  }

  list.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-progress-form]');
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const value = Number(data.get('value'));
    if (!Number.isFinite(value) || value < 0) {
      toast.show('Informe um valor válido, maior ou igual a zero.');
      return;
    }
    try {
      await apiRequest(`/api/patients/goals/${encodeURIComponent(form.dataset.progressForm)}/progress`, {
        method: 'POST',
        body: JSON.stringify({ value, notes: String(data.get('notes') || '').trim() }),
      });
      toast.show('Progresso registrado.');
      await loadGoals();
    } catch (error) {
      toast.show(error.message || 'Não foi possível registrar o progresso.');
    }
  });
  statusFilter.addEventListener('change', render);

  const role = String(session.getUser()?.profile || '').toUpperCase();
  if (!['PATIENT', 'PACIENTE'].includes(role)) {
    window.location.replace('/dashboard-nutricionista');
    return;
  }
  loadGoals().catch((error) => toast.show(error.message || 'Não foi possível carregar as metas.'));
})();
