const request = require('supertest');
const { createApp } = require('../src/app');
const {
  createUserWithRole,
  cleanupTestUsers,
  bearer,
} = require('./helpers');

describe('dashboard do paciente', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  async function linkPatient(patient, nutritionist) {
    const response = await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({
        patientEmail: patient.email,
        age: 45,
        objective: 'Engordar',
        restrictions: 'Arroz',
      });
    expect(response.statusCode).toBe(200);
  }

  it('carrega dados vinculados, plano, medidas e registros do paciente', async () => {
    const patient = await createUserWithRole(app, 'PATIENT', { name: 'Vinicius' });
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST', { name: 'Carlos Nutri' });
    await linkPatient(patient, nutritionist);

    const planResponse = await request(app)
      .post('/api/nutritionist/meal-plans')
      .set(bearer(nutritionist.token))
      .send({
        patientId: patient.user.id,
        title: 'Plano para ganho de peso',
        items: [{ foodId: 'arroz-branco-cozido', quantity: 200, mealTime: 'Almoco' }],
      });
    expect(planResponse.statusCode).toBe(201);

    const measurementResponse = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(nutritionist.token))
      .send({
        weightKg: 68,
        heightCm: 172,
        bodyFatPercent: 18,
        waistCircumferenceCm: 78,
      });
    expect(measurementResponse.statusCode).toBe(201);

      const newerMeasurementResponse = await request(app)
        .post(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(nutritionist.token))
        .send({
          weightKg: 69,
          heightCm: 172,
          bodyFatPercent: 17,
          waistCircumferenceCm: 77,
        });
      expect(newerMeasurementResponse.statusCode).toBe(201);

    const mealResponse = await request(app)
      .post('/api/patient/meals')
      .set(bearer(patient.token))
      .send({
        mealType: 'Almoco',
        title: 'Arroz e feijao',
        description: 'Almoco completo',
        loggedAt: new Date().toISOString(),
        calories: 650,
        protein: 28,
        carbs: 90,
        fats: 15,
        fiber: 8,
        waterMl: 400,
      });
    expect(mealResponse.statusCode).toBe(201);

    const weightResponse = await request(app)
      .post('/api/patient/weights')
      .set(bearer(patient.token))
      .send({
        weight: 68.4,
        recordedAt: new Date().toISOString(),
        note: 'Pesagem da semana',
      });
    expect(weightResponse.statusCode).toBe(201);

    const response = await request(app)
      .get('/api/patient/dashboard')
      .set(bearer(patient.token));

    expect(response.statusCode).toBe(200);
    expect(response.body.setupRequired).toBe(false);
    expect(response.body.patient).toMatchObject({
      name: 'Vinicius',
      age: 45,
      objective: 'Engordar',
      restrictions: 'Arroz',
      weight: 68.4,
      nutritionist: { id: nutritionist.user.id, name: 'Carlos Nutri' },
    });
    expect(response.body.overview).toMatchObject({
      caloriesConsumed: 650,
      caloriesTarget: 256,
      fiber: 8,
      waterLiters: 0.4,
    });
    expect(response.body.meals).toEqual([
      expect.objectContaining({ title: 'Arroz e feijao', calories: 650 }),
    ]);
    expect(response.body.plan).toMatchObject({
      title: 'Plano para ganho de peso',
      sections: [expect.objectContaining({ slotLabel: 'Almoco' })],
    });
    expect(response.body.bodyMeasurements.latest).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Peso', value: 69 }),
      expect.objectContaining({ label: 'Cintura', value: 77 }),
    ]));
    expect(response.body.bodyMeasurements.history).toHaveLength(2);
    expect(response.body.weight.currentLabel).toBe('68,4kg');
    expect(response.body.weight.history[0].note).toBe('Pesagem da semana');
    expect(response.body.foods.length).toBeGreaterThan(0);
    expect(response.body.history[0].caloriesLabel).toBe('650 kcal');
  });

  it('exige vinculacao para registrar refeicao e restringe o dashboard por perfil', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    const beforeLink = await request(app)
      .post('/api/patient/meals')
      .set(bearer(patient.token))
      .send({});
    const nutritionistDashboard = await request(app)
      .get('/api/patient/dashboard')
      .set(bearer(nutritionist.token));

    expect(beforeLink.statusCode).toBe(403);
    expect(nutritionistDashboard.statusCode).toBe(403);
  });

  it('persiste os dados informados ao conectar o paciente e valida registros', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    const linkResponse = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(patient.token))
      .send({
        nutritionistEmail: nutritionist.email,
        age: '45',
        objective: 'Engordar',
        restrictions: 'Sem lactose',
      });
    expect(linkResponse.statusCode).toBe(200);

    const invalidAgeResponse = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(patient.token))
      .send({ nutritionistEmail: nutritionist.email, age: '12' });
    expect(invalidAgeResponse.statusCode).toBe(400);

    const invalidWeightResponse = await request(app)
      .post('/api/patient/weights')
      .set(bearer(patient.token))
      .send({ weight: 5, recordedAt: new Date().toISOString() });
    expect(invalidWeightResponse.statusCode).toBe(400);

    const response = await request(app)
      .get('/api/patient/dashboard')
      .set(bearer(patient.token));
    expect(response.body.patient).toMatchObject({
      age: 45,
      objective: 'Engordar',
      restrictions: 'Sem lactose',
    });
  });
});
