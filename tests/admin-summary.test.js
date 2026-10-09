const request = require('supertest');
const { createApp } = require('../src/app');
const {
  createUserWithRole,
  cleanupTestUsers,
  bearer,
} = require('./helpers');

describe('GET /api/admin/summary', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('deve retornar contagens atuais de usuários por perfil e situação', async () => {
    const admin = await createUserWithRole(app, 'ADMIN');
    const baselineResponse = await request(app)
      .get('/api/admin/summary')
      .set(bearer(admin.token));
    const baseline = baselineResponse.body.summary;
    const activePatient = await createUserWithRole(app, 'PATIENT');
    const blockedPatient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    await app.locals.prisma.user.update({
      where: { id: blockedPatient.user.id },
      data: { isActive: false },
    });

    const response = await request(app)
      .get('/api/admin/summary')
      .set(bearer(admin.token));

    expect(response.statusCode).toBe(200);
    expect(response.body.summary).toMatchObject({
      total_users: baseline.total_users + 3,
      total_patients: baseline.total_patients + 2,
      total_nutritionists: baseline.total_nutritionists + 1,
      total_admins: baseline.total_admins,
      active_users: baseline.active_users + 2,
      blocked_users: baseline.blocked_users + 1,
    });
    expect(response.body.summary).toMatchObject({
      food_catalog_available: true,
      food_logs_available: true,
      meal_plans_available: true,
    });
    expect(response.body.summary.total_foods).toBeGreaterThan(0);
    expect(response.body.summary.food_logs_today).toEqual(expect.any(Number));
    expect(response.body.summary.active_meal_plans).toEqual(expect.any(Number));
    expect(response.body.summary.average_food_calories).toEqual(expect.any(Number));
    expect(activePatient.user.isActive).toBe(true);
    expect(nutritionist.user.isActive).toBe(true);
  });

  it('deve exigir autenticação de administrador', async () => {
    const response = await request(app).get('/api/admin/summary');
    expect(response.statusCode).toBe(401);
  });

  it('cadastra alimento no catalogo compartilhado com nutricionista e paciente', async () => {
    const admin = await createUserWithRole(app, 'ADMIN');
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const foodName = `Alimento integrado ${Date.now()}`;

    const createResponse = await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({ name: foodName, calories: 145, protein: 8.5, carbs: 20, fat: 3.2 });

    expect(createResponse.statusCode).toBe(201);
    const food = createResponse.body.food;

    const adminCatalog = await request(app)
      .get('/api/admin/foods')
      .set(bearer(admin.token));
    const nutritionistCatalog = await request(app)
      .get('/api/nutritionist/foods')
      .set(bearer(nutritionist.token));
    expect(adminCatalog.body.foods).toContainEqual(expect.objectContaining({ id: food.id, name: foodName }));
    expect(nutritionistCatalog.body.foods).toContainEqual(expect.objectContaining({ id: food.id, name: foodName }));

    await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({ patientEmail: patient.email, age: 30, objective: 'Acompanhamento' })
      .expect(200);

    const planResponse = await request(app)
      .post('/api/nutritionist/meal-plans')
      .set(bearer(nutritionist.token))
      .send({
        patientId: patient.user.id,
        title: 'Plano com alimento cadastrado',
        items: [{ foodId: food.id, quantity: 100, mealTime: 'Almoco' }],
      });
    expect(planResponse.statusCode).toBe(201);

    const patientDashboard = await request(app)
      .get('/api/patient/dashboard')
      .set(bearer(patient.token));
    expect(patientDashboard.body.foods).toContainEqual(expect.objectContaining({ id: food.id, name: foodName }));
    expect(patientDashboard.body.plan.sections[0].title).toContain(foodName);
  });

  it('aceita calorias acima de 1000 e ainda valida macros e nomes duplicados', async () => {
    const admin = await createUserWithRole(app, 'ADMIN');
    const name = `Alimento exclusivo ${Date.now()}`;
    const validPayload = { name, calories: 100, protein: 5, carbs: 10, fat: 2 };

    await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({ ...validPayload, calories: 3200 })
      .expect(201);
    await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({ ...validPayload, name: `${name} invalid`, carbs: 101 })
      .expect(400);
    await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({ ...validPayload, name: name.toUpperCase() })
      .expect(409);
  });

  it('permite cadastrar novamente alimento removido e nomes que geram identificadores parecidos', async () => {
    const admin = await createUserWithRole(app, 'ADMIN');
    const name = `Cafe removido ${Date.now()}`;
    const original = await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({ name, calories: 120, protein: 3, carbs: 24, fat: 1 })
      .expect(201);

    await request(app)
      .delete(`/api/admin/foods/${original.body.food.id}`)
      .set(bearer(admin.token))
      .expect(200);

    const restored = await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({ name, calories: 130, protein: 4, carbs: 25, fat: 2 })
      .expect(201);
    expect(restored.body.food).toMatchObject({
      id: original.body.food.id,
      isAvailable: true,
      calories: 130,
    });

    const accentedVariant = await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({ name: name.replace('Cafe', 'Café'), calories: 130, protein: 4, carbs: 25, fat: 2 })
      .expect(201);
    expect(accentedVariant.body.food.id).not.toBe(restored.body.food.id);
  });

  it('remove alimento do catálogo e dos planos, recalculando totais ou removendo planos vazios', async () => {
    const admin = await createUserWithRole(app, 'ADMIN');
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const foodToRemoveResponse = await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({
        name: `Alimento removivel ${Date.now()}`,
        calories: 200,
        protein: 10,
        carbs: 25,
        fat: 5,
      });
    const remainingFoodResponse = await request(app)
      .post('/api/admin/foods')
      .set(bearer(admin.token))
      .send({
        name: `Alimento restante ${Date.now()}`,
        calories: 100,
        protein: 4,
        carbs: 12,
        fat: 2,
      });
    const foodToRemove = foodToRemoveResponse.body.food;
    const remainingFood = remainingFoodResponse.body.food;

    await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({ patientEmail: patient.email, age: 30, objective: 'Acompanhamento' })
      .expect(200);

    const emptyAfterRemovalPlan = await request(app)
      .post('/api/nutritionist/meal-plans')
      .set(bearer(nutritionist.token))
      .send({
        patientId: patient.user.id,
        title: 'Plano que ficara vazio',
        items: [{ foodId: foodToRemove.id, quantity: 100, mealTime: 'Almoco' }],
      });
    const recalculatedPlan = await request(app)
      .post('/api/nutritionist/meal-plans')
      .set(bearer(nutritionist.token))
      .send({
        patientId: patient.user.id,
        title: 'Plano que sera atualizado',
        items: [
          { foodId: foodToRemove.id, quantity: 100, mealTime: 'Almoco' },
          { foodId: remainingFood.id, quantity: 200, mealTime: 'Jantar' },
        ],
      });
    expect(emptyAfterRemovalPlan.statusCode).toBe(201);
    expect(recalculatedPlan.statusCode).toBe(201);

    const response = await request(app)
      .delete(`/api/admin/foods/${foodToRemove.id}`)
      .set(bearer(admin.token));

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      affectedPlanCount: 2,
      deletedPlanCount: 1,
      food: { id: foodToRemove.id, isAvailable: false },
    });
    expect(await app.locals.prisma.food.findUnique({ where: { id: foodToRemove.id } }))
      .toMatchObject({ isAvailable: false });
    expect(await app.locals.prisma.mealPlan.findUnique({
      where: { id: emptyAfterRemovalPlan.body.mealPlan.id },
    })).toBeNull();
    expect(await app.locals.prisma.mealPlan.findUnique({
      where: { id: recalculatedPlan.body.mealPlan.id },
    })).toMatchObject({ calories: 200, protein: 8, carbs: 24, fats: 4 });
    expect(await app.locals.prisma.mealPlanItem.findMany({
      where: { foodId: foodToRemove.id },
    })).toHaveLength(0);

    const [adminCatalog, nutritionistCatalog, patientDashboard] = await Promise.all([
      request(app).get('/api/admin/foods').set(bearer(admin.token)),
      request(app).get('/api/nutritionist/foods').set(bearer(nutritionist.token)),
      request(app).get('/api/patient/dashboard').set(bearer(patient.token)),
    ]);
    expect(adminCatalog.statusCode).toBe(200);
    expect(nutritionistCatalog.statusCode).toBe(200);
    expect(patientDashboard.statusCode).toBe(200);
    for (const foods of [
      adminCatalog.body.foods,
      nutritionistCatalog.body.foods,
      patientDashboard.body.foods,
    ]) {
      expect(foods.some((food) => food.id === foodToRemove.id)).toBe(false);
    }
    expect(patientDashboard.body.plan.title).toBe('Plano que sera atualizado');
    expect(patientDashboard.body.plan.sections).toHaveLength(1);
    expect(patientDashboard.body.plan.sections[0].title).toContain(remainingFood.name);
  });

  it('retorna 404 ao tentar remover alimento inexistente', async () => {
    const admin = await createUserWithRole(app, 'ADMIN');
    await request(app)
      .delete('/api/admin/foods/alimento-inexistente')
      .set(bearer(admin.token))
      .expect(404);
  });
});
