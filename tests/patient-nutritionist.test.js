const request = require('supertest');
const { createApp } = require('../src/app');
const {
  createUserWithRole,
  cleanupTestUsers,
  bearer,
} = require('./helpers');

describe('POST /api/patients/me/nutritionist', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('deve vincular o paciente a um nutricionista existente', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    const response = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(patient.token))
      .send({ nutritionistEmail: nutritionist.email });

    expect(response.statusCode).toBe(200);
    expect(response.body.nutritionist).toMatchObject({
      id: nutritionist.user.id,
      email: nutritionist.email,
    });
    expect(response.body.patientProfile.nutritionistId).toBe(nutritionist.user.id);
  });

  it('deve retornar 404 se o nutricionista nao existir', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');

    const response = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(patient.token))
      .send({ nutritionistEmail: 'nao-existe@nutriflow.test' });

    expect(response.statusCode).toBe(404);
  });

  it('deve retornar 404 se o e-mail pertencer a um paciente, nao a um nutricionista', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const otherPatient = await createUserWithRole(app, 'PATIENT');

    const response = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(patient.token))
      .send({ nutritionistEmail: otherPatient.email });

    expect(response.statusCode).toBe(404);
  });

  it('deve substituir o nutricionista anterior ao vincular de novo (apenas 1 por vez)', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const firstNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const secondNutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(patient.token))
      .send({ nutritionistEmail: firstNutritionist.email });

    const response = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(patient.token))
      .send({ nutritionistEmail: secondNutritionist.email });

    expect(response.statusCode).toBe(200);
    expect(response.body.patientProfile.nutritionistId).toBe(secondNutritionist.user.id);
    expect(response.body.patientProfile.nutritionistId).not.toBe(firstNutritionist.user.id);
  });

  it('deve exigir token', async () => {
    const response = await request(app)
      .post('/api/patients/me/nutritionist')
      .send({ nutritionistEmail: 'qualquer@nutriflow.test' });

    expect(response.statusCode).toBe(401);
  });

  it('deve negar acesso a nutricionista e admin (403)', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const admin = await createUserWithRole(app, 'ADMIN');
    const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    const asNutritionist = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(nutritionist.token))
      .send({ nutritionistEmail: otherNutritionist.email });

    expect(asNutritionist.statusCode).toBe(403);

    const asAdmin = await request(app)
      .post('/api/patients/me/nutritionist')
      .set(bearer(admin.token))
      .send({ nutritionistEmail: otherNutritionist.email });

    expect(asAdmin.statusCode).toBe(403);
  });
});

describe('POST /api/nutritionist/link-patient', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('deve permitir que o nutricionista vincule um paciente existente', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    const response = await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({
        patientEmail: patient.email,
        age: '30',
        objective: 'Emagrecimento',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.patient).toMatchObject({
      id: patient.user.id,
      email: patient.email,
    });
    expect(response.body.patientProfile).toMatchObject({
      nutritionistId: nutritionist.user.id,
      age: 30,
      objective: 'Emagrecimento',
    });
  });

  it('deve retornar 404 se o paciente nao existir', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    const response = await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({
        patientEmail: 'nao-existe@nutriflow.test',
        age: 30,
        objective: 'Emagrecimento',
      });

    expect(response.statusCode).toBe(404);
  });

  it('deve substituir o vinculo anterior ao vincular a outro nutricionista', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const firstNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const secondNutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(firstNutritionist.token))
      .send({
        patientEmail: patient.email,
        age: '30',
        objective: 'Emagrecimento',
      });

    const response = await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(secondNutritionist.token))
      .send({
        patientEmail: patient.email,
        age: '30',
        objective: 'Emagrecimento',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.patientProfile.nutritionistId).toBe(secondNutritionist.user.id);
    expect(response.body.patientProfile.nutritionistId).not.toBe(firstNutritionist.user.id);
  });

  it('deve negar acesso a paciente', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const anotherPatient = await createUserWithRole(app, 'PATIENT');

    const response = await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(patient.token))
      .send({
        patientEmail: anotherPatient.email,
        age: 30,
        objective: 'Emagrecimento',
      });

    expect(response.statusCode).toBe(403);
  });

  it('deve listar apenas os pacientes vinculados ao nutricionista autenticado', async () => {
    const patient = await createUserWithRole(app, 'PATIENT', {
      name: 'Paciente Vinculado',
    });
    const otherPatient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({
        patientEmail: patient.email,
        age: '30',
        objective: 'Emagrecimento',
        restrictions: 'Lactose',
      });

    await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(otherNutritionist.token))
      .send({
        patientEmail: otherPatient.email,
        age: '25',
        objective: 'Manutencao',
      });

    const response = await request(app)
      .get('/api/nutritionist/patients')
      .set(bearer(nutritionist.token));

    expect(response.statusCode).toBe(200);
    expect(response.body.patients).toEqual([
      expect.objectContaining({
        id: patient.user.id,
        name: 'Paciente Vinculado',
        email: patient.email,
        objective: 'Emagrecimento',
        restrictions: 'Lactose',
      }),
    ]);
  });
});