const request = require('supertest');
const { createApp } = require('../src/app');
const {
  createUserWithRole,
  cleanupTestUsers,
  bearer,
} = require('./helpers');

describe('planos alimentares do nutricionista', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  async function linkPatient(nutritionist, patient) {
    const response = await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({
        patientEmail: patient.email,
        age: 32,
        objective: 'Reeducacao alimentar',
      });
    expect(response.statusCode).toBe(200);
  }

  it('fornece catálogo e grava/lista plano com totais calculados', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    await linkPatient(nutritionist, patient);

    const foodsResponse = await request(app)
      .get('/api/nutritionist/foods')
      .set(bearer(nutritionist.token));
    expect(foodsResponse.statusCode).toBe(200);
    expect(foodsResponse.body.foods.length).toBeGreaterThan(0);
    const rice = foodsResponse.body.foods.find((food) => food.id === 'arroz-branco-cozido');
    expect(rice).toBeDefined();

    const createResponse = await request(app)
      .post('/api/nutritionist/meal-plans')
      .set(bearer(nutritionist.token))
      .send({
        patientId: patient.user.id,
        title: 'Plano inicial',
        notes: 'Reavaliar em 30 dias.',
        items: [{ foodId: rice.id, quantity: 200, mealTime: 'Almoco' }],
      });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.mealPlan).toMatchObject({
      patientId: patient.user.id,
      patient: patient.user.name,
      title: 'Plano inicial',
      notes: 'Reavaliar em 30 dias.',
      calories: 256,
      protein: 5,
      carbs: 56,
      items: [{
        foodId: rice.id,
        foodName: rice.name,
        quantity: 200,
        mealTime: 'Almoco',
      }],
    });

    const listResponse = await request(app)
      .get('/api/nutritionist/meal-plans')
      .set(bearer(nutritionist.token));
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.mealPlans).toContainEqual(createResponse.body.mealPlan);
  });

  it('rejeita pacientes nao vinculados e itens invalidos', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const anotherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    await linkPatient(nutritionist, patient);

    const foodsResponse = await request(app)
      .get('/api/nutritionist/foods')
      .set(bearer(nutritionist.token));
    const food = foodsResponse.body.foods[0];

    const notLinked = await request(app)
      .post('/api/nutritionist/meal-plans')
      .set(bearer(anotherNutritionist.token))
      .send({
        patientId: patient.user.id,
        title: 'Plano',
        items: [{ foodId: food.id, quantity: 100, mealTime: 'Almoco' }],
      });
    const invalidItem = await request(app)
      .post('/api/nutritionist/meal-plans')
      .set(bearer(nutritionist.token))
      .send({
        patientId: patient.user.id,
        title: 'Plano',
        items: [{ foodId: 'inexistente', quantity: 100, mealTime: 'Almoco' }],
      });

    expect(notLinked.statusCode).toBe(403);
    expect(invalidItem.statusCode).toBe(400);
  });
});
