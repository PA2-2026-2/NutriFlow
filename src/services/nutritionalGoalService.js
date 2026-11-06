const { AppError } = require('../errors/appError');

const CATEGORIES = Object.freeze([
  'WATER',
  'PROTEIN',
  'CALORIES',
  'FRUITS_VEGETABLES',
  'BODY_WEIGHT',
  'MEAL_FREQUENCY',
  'CUSTOM',
]);
const EDITABLE_FIELDS = Object.freeze([
  'title',
  'description',
  'category',
  'customCategory',
  'initialValue',
  'targetValue',
  'unit',
  'startDate',
  'endDate',
]);

function assertObject(payload, message) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new AppError(message, 400);
  }
}

function parseValue(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AppError(`${label} deve ser um numero finito maior ou igual a zero.`, 400);
  }
  return value;
}

function parseDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${label} invalida. Informe uma data no formato AAAA-MM-DD.`, 400);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new AppError(`${label} invalida.`, 400);
  }
  return date;
}

function progressPercent(initialValue, targetValue, currentValue) {
  const percent = ((currentValue - initialValue) / (targetValue - initialValue)) * 100;
  return Math.round(Math.min(100, Math.max(0, percent)) * 100) / 100;
}

function targetReached(goal, value) {
  return goal.targetValue > goal.initialValue
    ? value >= goal.targetValue
    : value <= goal.targetValue;
}

function effectiveStatus(goal, now = new Date()) {
  if (
    goal.status === 'ACTIVE' &&
    now.getTime() >= new Date(goal.endDate).getTime() + 24 * 60 * 60 * 1000
  ) {
    return 'EXPIRED';
  }
  return goal.status;
}

function serializeGoal(goal) {
  const entries = goal.progressEntries || [];
  const latest = entries[entries.length - 1];
  const currentValue = latest ? Number(latest.value) : Number(goal.initialValue);
  const status = effectiveStatus(goal);

  return {
    id: goal.id,
    patientId: goal.patientId,
    patient: goal.patient || undefined,
    nutritionist: goal.nutritionist || undefined,
    nutritionistId: goal.nutritionistId,
    title: goal.title,
    description: goal.description || '',
    category: goal.category,
    customCategory: goal.customCategory || '',
    initialValue: Number(goal.initialValue),
    targetValue: Number(goal.targetValue),
    currentValue,
    unit: goal.unit,
    direction: goal.targetValue > goal.initialValue ? 'INCREASE' : 'DECREASE',
    progressPercent: progressPercent(
      Number(goal.initialValue),
      Number(goal.targetValue),
      currentValue,
    ),
    startDate: goal.startDate,
    endDate: goal.endDate,
    status,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    progressHistory: entries.map((entry) => ({
      id: entry.id,
      value: Number(entry.value),
      recordedAt: entry.recordedAt,
      notes: entry.notes || '',
      recordedBy: entry.recordedBy
        ? { id: entry.recordedBy.id, name: entry.recordedBy.name }
        : undefined,
    })),
  };
}

function validateCreatePayload(payload) {
  assertObject(payload, 'Informe os dados da meta.');
  const allowedFields = new Set(['patientId', ...EDITABLE_FIELDS]);
  const unknown = Object.keys(payload).find((field) => !allowedFields.has(field));
  if (unknown) throw new AppError(`Campo de meta nao reconhecido: ${unknown}.`, 400);

  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!title || title.length > 120) {
    throw new AppError('Informe um titulo de ate 120 caracteres.', 400);
  }
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  if (description.length > 2000) {
    throw new AppError('A descricao deve ter ate 2000 caracteres.', 400);
  }
  if (!CATEGORIES.includes(payload.category)) {
    throw new AppError('Informe uma categoria valida para a meta.', 400);
  }
  const customCategory = payload.category === 'CUSTOM'
    ? typeof payload.customCategory === 'string' ? payload.customCategory.trim() : ''
    : '';
  if (payload.category === 'CUSTOM' && (!customCategory || customCategory.length > 80)) {
    throw new AppError('Informe uma categoria personalizada de ate 80 caracteres.', 400);
  }
  const unit = typeof payload.unit === 'string' ? payload.unit.trim() : '';
  if (!unit || unit.length > 32) {
    throw new AppError('Informe uma unidade de medida de ate 32 caracteres.', 400);
  }
  const initialValue = parseValue(payload.initialValue, 'O valor inicial');
  const targetValue = parseValue(payload.targetValue, 'O valor desejado');
  if (initialValue === targetValue) {
    throw new AppError('O valor inicial e o valor desejado devem ser diferentes.', 400);
  }
  const startDate = parseDate(payload.startDate, 'A data inicial');
  const endDate = parseDate(payload.endDate, 'A data prevista');
  if (endDate < startDate) {
    throw new AppError('A data prevista nao pode ser anterior a data inicial.', 400);
  }
  if (typeof payload.patientId !== 'string' || !payload.patientId.trim()) {
    throw new AppError('Informe o paciente da meta.', 400);
  }

  return {
    patientId: payload.patientId.trim(),
    title,
    description: description || null,
    category: payload.category,
    customCategory: customCategory || null,
    initialValue,
    targetValue,
    unit,
    startDate,
    endDate,
    status: 'ACTIVE',
  };
}

function validateUpdatePayload(payload, goal) {
  assertObject(payload, 'Informe os dados da meta.');
  const unknown = Object.keys(payload).find((field) => !EDITABLE_FIELDS.includes(field));
  if (unknown) throw new AppError(`Campo de meta nao reconhecido: ${unknown}.`, 400);
  if (Object.keys(payload).length === 0) {
    throw new AppError('Informe ao menos um campo para atualizar.', 400);
  }

  const values = {
    title: goal.title,
    description: goal.description || '',
    category: goal.category,
    customCategory: goal.customCategory || '',
    initialValue: Number(goal.initialValue),
    targetValue: Number(goal.targetValue),
    unit: goal.unit,
    startDate: goal.startDate,
    endDate: goal.endDate,
    ...payload,
  };
  if (typeof values.title !== 'string' || !values.title.trim() || values.title.trim().length > 120) {
    throw new AppError('Informe um titulo de ate 120 caracteres.', 400);
  }
  if (typeof values.description !== 'string' || values.description.trim().length > 2000) {
    throw new AppError('A descricao deve ter ate 2000 caracteres.', 400);
  }
  if (!CATEGORIES.includes(values.category)) {
    throw new AppError('Informe uma categoria valida para a meta.', 400);
  }
  const customCategory = values.category === 'CUSTOM'
    ? typeof values.customCategory === 'string' ? values.customCategory.trim() : ''
    : '';
  if (values.category === 'CUSTOM' && (!customCategory || customCategory.length > 80)) {
    throw new AppError('Informe uma categoria personalizada de ate 80 caracteres.', 400);
  }
  if (typeof values.unit !== 'string' || !values.unit.trim() || values.unit.trim().length > 32) {
    throw new AppError('Informe uma unidade de medida de ate 32 caracteres.', 400);
  }
  const initialValue = parseValue(values.initialValue, 'O valor inicial');
  const targetValue = parseValue(values.targetValue, 'O valor desejado');
  if (initialValue === targetValue) {
    throw new AppError('O valor inicial e o valor desejado devem ser diferentes.', 400);
  }
  const startDate = payload.startDate === undefined
    ? new Date(goal.startDate)
    : parseDate(payload.startDate, 'A data inicial');
  const endDate = payload.endDate === undefined
    ? new Date(goal.endDate)
    : parseDate(payload.endDate, 'A data prevista');
  if (endDate < startDate) {
    throw new AppError('A data prevista nao pode ser anterior a data inicial.', 400);
  }
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    category: values.category,
    customCategory: customCategory || null,
    initialValue,
    targetValue,
    unit: values.unit.trim(),
    startDate,
    endDate,
  };
}

function serializeList(goals, statusFilter) {
  return goals
    .map(serializeGoal)
    .filter((goal) => !statusFilter || goal.status === statusFilter);
}

class NutritionalGoalService {
  constructor(repository, profileRepository) {
    this.repository = repository;
    this.profileRepository = profileRepository;
  }

  async listForNutritionist(nutritionistId, filters = {}) {
    if (filters.category && !CATEGORIES.includes(filters.category)) {
      throw new AppError('Categoria de meta invalida.', 400);
    }
    if (filters.status && !['ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED'].includes(filters.status)) {
      throw new AppError('Status de meta invalido.', 400);
    }
    const goals = await this.repository.listForNutritionist(nutritionistId, filters);
    return { goals: serializeList(goals, filters.status) };
  }

  async listForPatient(patientId) {
    return { goals: serializeList(await this.repository.listForPatient(patientId)) };
  }

  async getForNutritionist(nutritionistId, id) {
    const goal = await this.repository.findForNutritionist(id, nutritionistId);
    if (!goal) throw new AppError('Meta nao encontrada.', 404);
    return { goal: serializeGoal(goal) };
  }

  async getForPatient(patientId, id) {
    const goal = await this.repository.findForPatient(id, patientId);
    if (!goal) throw new AppError('Meta nao encontrada.', 404);
    return { goal: serializeGoal(goal) };
  }

  async createForNutritionist(nutritionistId, payload) {
    const data = validateCreatePayload(payload);
    const patient = await this.profileRepository.findPatientWithUserByUserId(data.patientId);
    if (
      !patient ||
      patient.user.profile !== 'PATIENT' ||
      patient.nutritionistId !== nutritionistId
    ) {
      throw new AppError('Este paciente nao esta vinculado ao nutricionista atual.', 403);
    }

    const goal = await this.repository.create({ ...data, nutritionistId });
    return { goal: serializeGoal(goal) };
  }

  async updateForNutritionist(nutritionistId, id, payload) {
    const goal = await this.repository.findForNutritionist(id, nutritionistId);
    if (!goal) throw new AppError('Meta nao encontrada.', 404);
    if (goal.status !== 'ACTIVE') {
      throw new AppError('Somente metas ativas podem ser editadas.', 409);
    }
    const data = validateUpdatePayload(payload, goal);
    const updated = await this.repository.update(id, data);
    return { goal: serializeGoal(updated) };
  }

  async updateStatusForNutritionist(nutritionistId, id, payload) {
    assertObject(payload, 'Informe o status da meta.');
    if (Object.keys(payload).some((field) => field !== 'status')) {
      throw new AppError('Somente o campo status pode ser atualizado nesta rota.', 400);
    }
    if (!['ACTIVE', 'CANCELLED'].includes(payload.status)) {
      throw new AppError('O status deve ser ACTIVE ou CANCELLED.', 400);
    }
    const goal = await this.repository.findForNutritionist(id, nutritionistId);
    if (!goal) throw new AppError('Meta nao encontrada.', 404);
    if (goal.status === 'COMPLETED' || effectiveStatus(goal) === 'EXPIRED') {
      throw new AppError('Uma meta concluida ou expirada nao pode ser reativada ou alterada.', 409);
    }
    if (payload.status === 'ACTIVE' && goal.status !== 'ACTIVE') {
      throw new AppError('Uma meta cancelada nao pode ser reativada.', 409);
    }
    const updated = await this.repository.update(id, { status: payload.status });
    return { goal: serializeGoal(updated) };
  }

  async recordProgress(patientId, id, payload) {
    assertObject(payload, 'Informe os dados do progresso.');
    const unknown = Object.keys(payload).find((field) => !['value', 'notes'].includes(field));
    if (unknown) {
      throw new AppError(`Campo de progresso nao reconhecido: ${unknown}.`, 400);
    }
    const goal = await this.repository.findForPatient(id, patientId);
    if (!goal) throw new AppError('Meta nao encontrada.', 404);
    if (effectiveStatus(goal) !== 'ACTIVE') {
      throw new AppError('Somente metas ativas podem receber atualizacoes.', 409);
    }
    const recordedAt = new Date();
    if (recordedAt < new Date(goal.startDate)) {
      throw new AppError('A meta ainda nao atingiu a data inicial.', 409);
    }
    const value = parseValue(payload.value, 'O valor informado');
    let notes = null;
    if (payload.notes !== undefined && payload.notes !== null) {
      if (typeof payload.notes !== 'string' || payload.notes.trim().length > 1000) {
        throw new AppError('A observacao deve ter ate 1000 caracteres.', 400);
      }
      notes = payload.notes.trim() || null;
    }

    const completed = targetReached(goal, value);
    const entry = await this.repository.createProgressAndComplete(id, {
      value,
      notes,
      recordedById: patientId,
      recordedAt,
    }, completed);
    if (!entry) {
      throw new AppError('A meta nao esta mais ativa para receber atualizacoes.', 409);
    }
    const updatedGoal = await this.repository.findForPatient(id, patientId);
    return { progress: { ...entry, value: Number(entry.value) }, goal: serializeGoal(updatedGoal) };
  }
}

module.exports = {
  CATEGORIES,
  progressPercent,
  targetReached,
  serializeGoal,
  NutritionalGoalService,
};
