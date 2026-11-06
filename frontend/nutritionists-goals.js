(function initializeNutritionistGoals() {
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
  const form = document.getElementById('nutritionistGoalForm');
  const list = document.getElementById('nutritionistGoalList');
  const patientSelect = document.getElementById('goalPatientId');
  const patientFilter = document.getElementById('goalFilterPatient');
  const linkedPatientSidebar = document.getElementById('linkedPatientSidebar');
  const categorySelect = form.elements.namedItem('category');
  const customCategoryField = document.getElementById('customCategoryField');
  const customCategoryInput = form.elements.namedItem('customCategory');
  const categoryFilter = document.getElementById('goalFilterCategory');
  const statusFilter = document.getElementById('goalFilterStatus');
  const cancelEditButton = document.getElementById('goalCancelEdit');
  const formTitle = document.getElementById('goalFormTitle');
  const submitButton = document.getElementById('goalSubmitButton');
  const sidebarGoalSummary = document.getElementById('sidebarGoalSummary');
  let patients = [];
  let goals = [];
  let editingGoalId = null;

  const statusLabels = { ACTIVE: 'Ativa', COMPLETED: 'Concluída', CANCELLED: 'Cancelada', EXPIRED: 'Expirada' };
  const categoryLabels = {
    WATER: 'Água',
    PROTEIN: 'Proteínas',
    CALORIES: 'Calorias',
    FRUITS_VEGETABLES: 'Frutas e vegetais',
    BODY_WEIGHT: 'Peso corporal',
    MEAL_FREQUENCY: 'Frequência de refeições',
    CUSTOM: 'Personalizada',
  };

  function updateCustomCategoryField() {
    const isCustom = categorySelect.value === 'CUSTOM';
    customCategoryField.classList.toggle('hidden', !isCustom);
    customCategoryInput.required = isCustom;
    if (!isCustom) customCategoryInput.value = '';
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
  }

  function renderHistory(entries) {
    if (!entries.length) return '<p class="mt-3 text-xs text-nutriflow-600">Nenhuma atualização registrada.</p>';
    return `<ol class="mt-3 max-h-44 space-y-2 overflow-y-auto">${entries.slice().reverse().map((entry) => `
      <li class="rounded-xl border border-nutriflow-100 bg-white px-3 py-2 text-xs">
        <div class="flex flex-wrap justify-between gap-2"><strong>${Number(entry.value).toLocaleString('pt-BR')}</strong>
          <time>${formatDate(entry.recordedAt)}</time></div>
        <p class="mt-1">${escapeHtml(entry.recordedBy?.name || 'Paciente')}${entry.notes ? ` · ${escapeHtml(entry.notes)}` : ''}</p>
      </li>`).join('')}</ol>`;
  }

  function render() {
    const filtered = goals.filter((goal) =>
      (!patientFilter.value || goal.patientId === patientFilter.value) &&
      (!categoryFilter.value || goal.category === categoryFilter.value) &&
      (!statusFilter.value || goal.status === statusFilter.value));
    if (!filtered.length) {
      list.innerHTML = '<div class="dashboard-surface rounded-[24px] p-6 text-sm text-nutriflow-700">Nenhuma meta encontrada para esses filtros.</div>';
      return;
    }
    list.innerHTML = filtered.map((goal) => {
      const progress = Math.min(100, Math.max(0, goal.progressPercent));
      return `<article class="dashboard-surface min-w-0 rounded-[24px] p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><p class="text-xs font-extrabold uppercase tracking-[.14em] text-nutriflow-500">${goal.category === 'CUSTOM' ? escapeHtml(goal.customCategory || 'Personalizada') : categoryLabels[goal.category] || escapeHtml(goal.category)}</p>
            <h2 class="mt-2 text-lg font-extrabold">${escapeHtml(goal.title)}</h2></div>
          <span class="rounded-full bg-nutriflow-100 px-3 py-1 text-xs font-bold">${statusLabels[goal.status] || escapeHtml(goal.status)}</span>
        </div>
        <p class="mt-2 text-xs text-nutriflow-600">${escapeHtml(goal.patient?.name || 'Paciente')}</p>
        <p class="mt-2 text-sm text-nutriflow-700">${escapeHtml(goal.description || 'Sem descrição adicional.')}</p>
        <p class="mt-3 text-sm"><strong>${goal.currentValue.toLocaleString('pt-BR')} ${escapeHtml(goal.unit)}</strong> · inicial ${goal.initialValue.toLocaleString('pt-BR')} · alvo ${goal.targetValue.toLocaleString('pt-BR')} ${escapeHtml(goal.unit)}</p>
        <div class="mt-3" role="progressbar" aria-label="Progresso da meta ${escapeHtml(goal.title)}" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
          <div class="flex justify-between text-xs font-bold"><span>Prazo ${formatDate(goal.endDate)}</span><span>${progress.toFixed(0)}%</span></div>
          <div class="mini-progress mt-2"><span style="width:${progress}%"></span></div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          ${goal.status === 'ACTIVE' ? `<button type="button" data-edit-goal="${escapeHtml(goal.id)}" class="rounded-lg border border-nutriflow-200 px-3 py-2 text-xs font-bold">Editar</button>
            <button type="button" data-cancel-goal="${escapeHtml(goal.id)}" class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Encerrar meta</button>` : ''}
        </div>
        <details class="mt-4 rounded-xl border border-nutriflow-100 bg-white p-3">
          <summary class="cursor-pointer text-sm font-bold">Histórico (${goal.progressHistory.length})</summary>
          ${renderHistory(goal.progressHistory)}
        </details>
      </article>`;
    }).join('');
  }

  function fillPatients() {
    const options = patients.map((patient) =>
      `<option value="${escapeHtml(patient.id)}">${escapeHtml(patient.name)} · ${escapeHtml(patient.email)}</option>`).join('');
    patientSelect.innerHTML = `<option value="">${patients.length ? 'Selecione um paciente' : 'Nenhum paciente vinculado'}</option>${options}`;
    patientSelect.disabled = patients.length === 0;
    submitButton.disabled = patients.length === 0;
    submitButton.title = patients.length ? '' : 'Vincule um paciente antes de criar uma meta.';
    patientFilter.innerHTML = `<option value="">Todos os pacientes</option>${options}`;
    linkedPatientSidebar.innerHTML = patients.length
      ? patients.map((patient) => `
        <button type="button" data-linked-patient="${escapeHtml(patient.id)}"
          class="block w-full rounded-xl px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/12 hover:text-white">
          <span class="block truncate font-bold">${escapeHtml(patient.name)}</span>
          <span class="block truncate text-xs text-white/60">${escapeHtml(patient.email)}</span>
        </button>`).join('')
      : '<p class="text-xs leading-5 text-white/65">Nenhum paciente vinculado ainda. Use “Vincular paciente” para adicionar.</p>';
  }

  async function loadData() {
    const [patientResponse, goalResponse] = await Promise.all([
      apiRequest('/api/nutritionist/patients'),
      apiRequest('/api/nutritionists/goals'),
    ]);
    patients = patientResponse.patients || [];
    goals = goalResponse.goals || [];
    sidebarGoalSummary.textContent = String(goals.filter((goal) => goal.status === 'ACTIVE').length);
    fillPatients();
    render();
  }

  function resetForm() {
    editingGoalId = null;
    form.reset();
    patientSelect.disabled = false;
    updateCustomCategoryField();
    formTitle.textContent = 'Criar meta';
    submitButton.textContent = 'Criar meta';
    cancelEditButton.classList.add('hidden');
  }

  function beginEdit(id) {
    const goal = goals.find((item) => item.id === id);
    if (!goal || goal.status !== 'ACTIVE') return;
    editingGoalId = id;
    for (const [field, value] of Object.entries({
      patientId: goal.patientId,
      title: goal.title,
      description: goal.description,
      category: goal.category,
      customCategory: goal.customCategory || '',
      initialValue: goal.initialValue,
      targetValue: goal.targetValue,
      unit: goal.unit,
      startDate: goal.startDate.slice(0, 10),
      endDate: goal.endDate.slice(0, 10),
    })) {
      form.elements.namedItem(field).value = value;
    }
    updateCustomCategoryField();
    patientSelect.disabled = true;
    formTitle.textContent = 'Editar meta';
    submitButton.textContent = 'Salvar alterações';
    cancelEditButton.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      patientId: String(data.get('patientId') || ''),
      title: String(data.get('title') || '').trim(),
      description: String(data.get('description') || '').trim(),
      category: data.get('category'),
      customCategory: String(data.get('customCategory') || '').trim(),
      initialValue: Number(data.get('initialValue')),
      targetValue: Number(data.get('targetValue')),
      unit: String(data.get('unit') || '').trim(),
      startDate: data.get('startDate'),
      endDate: data.get('endDate'),
    };
    if (editingGoalId) delete payload.patientId;
    if (!Number.isFinite(payload.initialValue) || !Number.isFinite(payload.targetValue)) {
      toast.show('Informe valores numéricos válidos.');
      return;
    }
    try {
      await apiRequest(editingGoalId
        ? `/api/nutritionists/goals/${encodeURIComponent(editingGoalId)}`
        : '/api/nutritionists/goals', {
        method: editingGoalId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      toast.show(editingGoalId ? 'Meta atualizada.' : 'Meta criada.');
      resetForm();
      await loadData();
    } catch (error) {
      toast.show(error.message || 'Não foi possível salvar a meta.');
    }
  });

  list.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-goal]');
    if (edit) return beginEdit(edit.dataset.editGoal);
    const cancel = event.target.closest('[data-cancel-goal]');
    if (!cancel) return;
    if (!window.confirm('Deseja encerrar esta meta?')) return;
    try {
      await apiRequest(`/api/nutritionists/goals/${encodeURIComponent(cancel.dataset.cancelGoal)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      toast.show('Meta encerrada.');
      await loadData();
    } catch (error) {
      toast.show(error.message || 'Não foi possível encerrar a meta.');
    }
  });

  linkedPatientSidebar.addEventListener('click', (event) => {
    const patientButton = event.target.closest('[data-linked-patient]');
    if (!patientButton) return;
    patientFilter.value = patientButton.dataset.linkedPatient;
    patientSelect.value = patientButton.dataset.linkedPatient;
    render();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  cancelEditButton.addEventListener('click', resetForm);
  categorySelect.addEventListener('change', updateCustomCategoryField);
  patientFilter.addEventListener('change', render);
  categoryFilter.addEventListener('change', render);
  statusFilter.addEventListener('change', render);
  const role = String(session.getUser()?.profile || '').toUpperCase();
  if (!['NUTRITIONIST', 'NUTRICIONISTA'].includes(role)) {
    window.location.replace('/dashboard');
    return;
  }
  loadData().catch((error) => toast.show(error.message || 'Não foi possível carregar os dados das metas.'));
})();
