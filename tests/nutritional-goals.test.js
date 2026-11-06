const request = require('supertest');
const { createApp } = require('../src/app');
const { createUserWithRole, cleanupTestUsers, bearer } = require('./helpers');

function dateLabel(date) {
  return date.toISOString().slice(0, 10);
}

function goalDates() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);
  return { startDate: dateLabel(start), endDate: dateLabel(end) };
}

function payload(patientId, overrides = {}) {
  return {
    patientId,
    title: 'Aumentar consumo de água',
    description: 'Acompanhar a hidratação diária.',
    category: 'WATER',
    initialValue: 1,
    targetValue: 2,
    unit: 'L/dia',
    ...goalDates(),
    ...overrides,
  };
}

describe('metas nutricionais', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await app.locals.prisma.nutritionalGoalProgress.deleteMany({
      where: {
        goal: {
          nutritionist: { email: { endsWith: '@sprint2.nutriflow.test' } },
        },
      },
    });
    await app.locals.prisma.nutritionalGoal.deleteMany({
      where: {
        nutritionist: { email: { endsWith: '@sprint2.nutriflow.test' } },
      },
    });
    await cleanupTestUsers(app);
    await app.stop();
  });

  async function linkPatient(nutritionist, patient) {
    await app.locals.prisma.patientProfile.create({
      data: { userId: patient.user.id, nutritionistId: nutritionist.user.id },
    });
  }

  async function createGoal(nutritionist, patient, overrides = {}) {
    return request(app)
      .post('/api/nutritionists/goals')
      .set(bearer(nutritionist.token))
      .send(payload(patient.user.id, overrides));
  }

  it('cria e lista uma meta e seu paciente vinculado', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');
    await linkPatient(nutritionist, patient);

    const created = await createGoal(nutritionist, patient);
    expect(created.statusCode).toBe(201);
    expect(created.body.goal).toMatchObject({
      patientId: patient.user.id,
      nutritionistId: nutritionist.user.id,
      initialValue: 1,
      targetValue: 2,
      currentValue: 1,
      progressPercent: 0,
      status: 'ACTIVE',
      unit: 'L/dia',
    });

    const list = await request(app)
      .get('/api/nutritionist/goals')
      .set(bearer(nutritionist.token));
    expect(list.statusCode).toBe(200);
    expect(list.body.goals[0].patient).toMatchObject({ id: patient.user.id });

    const patientList = await request(app)
      .get('/api/patients/goals')
      .set(bearer(patient.token));
    expect(patientList.statusCode).toBe(200);
    expect(patientList.body.goals.map((goal) => goal.id)).toContain(created.body.goal.id);
  });

  it('recusa metas para pacientes não vinculados', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');

    const response = await createGoal(nutritionist, patient);
    expect(response.statusCode).toBe(403);
  });

  it('salva e retorna o nome informado para categoria personalizada', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');
    await linkPatient(nutritionist, patient);

    const missingCategory = await createGoal(nutritionist, patient, {
      category: 'CUSTOM',
    });
    const created = await createGoal(nutritionist, patient, {
      category: 'CUSTOM',
      customCategory: 'Consumo de fibras',
    });

    expect(missingCategory.statusCode).toBe(400);
    expect(created.statusCode).toBe(201);
    expect(created.body.goal).toMatchObject({
      category: 'CUSTOM',
      customCategory: 'Consumo de fibras',
    });
  });

  it('edita e cancela uma meta ativa somente pelo nutricionista responsável', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');
    await linkPatient(nutritionist, patient);
    const created = await createGoal(nutritionist, patient);
    const id = created.body.goal.id;

    const deniedEdit = await request(app)
      .put(`/api/nutritionists/goals/${id}`)
      .set(bearer(otherNutritionist.token))
      .send({ title: 'Acesso indevido' });
    expect(deniedEdit.statusCode).toBe(404);

    const edited = await request(app)
      .put(`/api/nutritionists/goals/${id}`)
      .set(bearer(nutritionist.token))
      .send({ title: 'Hidratação diária', targetValue: 2.5 });
    expect(edited.statusCode).toBe(200);
    expect(edited.body.goal.title).toBe('Hidratação diária');
    expect(edited.body.goal.targetValue).toBe(2.5);

    const cancelled = await request(app)
      .patch(`/api/nutritionists/goals/${id}/status`)
      .set(bearer(nutritionist.token))
      .send({ status: 'CANCELLED' });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.body.goal.status).toBe('CANCELLED');

    const forbiddenReactivation = await request(app)
      .patch(`/api/nutritionists/goals/${id}/status`)
      .set(bearer(nutritionist.token))
      .send({ status: 'ACTIVE' });
    expect(forbiddenReactivation.statusCode).toBe(409);
  });

  it('calcula progresso crescente, preserva histórico e conclui somente ao atingir o alvo', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');
    await linkPatient(nutritionist, patient);
    const created = await createGoal(nutritionist, patient);
    const id = created.body.goal.id;

    const first = await request(app)
      .post(`/api/patients/goals/${id}/progress`)
      .set(bearer(patient.token))
      .send({ value: 1.5, notes: 'Primeira atualização' });
    expect(first.statusCode).toBe(201);
    expect(first.body.goal.progressPercent).toBe(50);
    expect(first.body.goal.status).toBe('ACTIVE');

    const second = await request(app)
      .post(`/api/patients/goals/${id}/progress`)
      .set(bearer(patient.token))
      .send({ value: 2, notes: 'Alvo alcançado' });
    expect(second.statusCode).toBe(201);
    expect(second.body.goal.progressPercent).toBe(100);
    expect(second.body.goal.status).toBe('COMPLETED');
    expect(second.body.goal.progressHistory).toHaveLength(2);
    expect(second.body.goal.progressHistory[0].recordedBy.id).toBe(patient.user.id);
    expect(new Date(second.body.goal.progressHistory[1].recordedAt).getTime())
      .toBeGreaterThan(new Date(second.body.goal.progressHistory[0].recordedAt).getTime());
  });

  it('calcula corretamente uma meta decrescente de peso corporal', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');
    await linkPatient(nutritionist, patient);
    const created = await createGoal(nutritionist, patient, {
      title: 'Reduzir peso',
      category: 'BODY_WEIGHT',
      initialValue: 90,
      targetValue: 80,
      unit: 'kg',
    });

    const progress = await request(app)
      .post(`/api/patients/goals/${created.body.goal.id}/progress`)
      .set(bearer(patient.token))
      .send({ value: 85 });
    expect(progress.statusCode).toBe(201);
    expect(progress.body.goal.direction).toBe('DECREASE');
    expect(progress.body.goal.progressPercent).toBe(50);

    const completed = await request(app)
      .post(`/api/patients/goals/${created.body.goal.id}/progress`)
      .set(bearer(patient.token))
      .send({ value: 79.5 });
    expect(completed.body.goal.progressPercent).toBe(100);
    expect(completed.body.goal.status).toBe('COMPLETED');
  });

  it('impede leitura e atualização por pacientes terceiros ou alteração de campos protegidos', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const owner = await createUserWithRole(app, 'PATIENT');
    const stranger = await createUserWithRole(app, 'PATIENT');
    await linkPatient(nutritionist, owner);
    const created = await createGoal(nutritionist, owner);
    const id = created.body.goal.id;

    const readDenied = await request(app)
      .get(`/api/patients/goals/${id}`)
      .set(bearer(stranger.token));
    const updateDenied = await request(app)
      .post(`/api/patients/goals/${id}/progress`)
      .set(bearer(stranger.token))
      .send({ value: 5 });
    const targetChangeDenied = await request(app)
      .post(`/api/patients/goals/${id}/progress`)
      .set(bearer(owner.token))
      .send({ value: 1.5, targetValue: 100, category: 'CUSTOM' });
    const forbiddenEdit = await request(app)
      .put(`/api/nutritionists/goals/${id}`)
      .set(bearer(owner.token))
      .send({ targetValue: 100 });

    expect(readDenied.statusCode).toBe(404);
    expect(updateDenied.statusCode).toBe(404);
    expect(targetChangeDenied.statusCode).toBe(400);
    expect(forbiddenEdit.statusCode).toBe(403);
    expect((await app.locals.prisma.nutritionalGoal.findUnique({ where: { id } })).targetValue).toBe(2);
  });

  it('rejeita valores inválidos, alvos iguais e status de conclusão manual', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');
    await linkPatient(nutritionist, patient);

    const equalValues = await createGoal(nutritionist, patient, { targetValue: 1 });
    const invalidNumber = await createGoal(nutritionist, patient, { initialValue: -1 });
    const created = await createGoal(nutritionist, patient);
    const badProgress = await request(app)
      .post(`/api/patients/goals/${created.body.goal.id}/progress`)
      .set(bearer(patient.token))
      .send({ value: Number.POSITIVE_INFINITY });
    const manualCompletion = await request(app)
      .patch(`/api/nutritionists/goals/${created.body.goal.id}/status`)
      .set(bearer(nutritionist.token))
      .send({ status: 'COMPLETED' });

    expect(equalValues.statusCode).toBe(400);
    expect(invalidNumber.statusCode).toBe(400);
    expect(badProgress.statusCode).toBe(400);
    expect(manualCompletion.statusCode).toBe(400);
  });
});
