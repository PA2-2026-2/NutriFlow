const request = require('supertest');
const { createApp } = require('../src/app');
const {
  createUserWithRole,
  cleanupTestUsers,
  bearer,
} = require('./helpers');

describe('POST /api/patients/:id/measurements', () => {
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
        age: 30,
        objective: 'Acompanhamento',
      });

    expect(response.statusCode).toBe(200);
    return response.body.patientProfile;
  }

  it('registra medidas válidas do paciente vinculado com data automática', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    await linkPatient(nutritionist, patient);
    const beforeRequest = Date.now();

    const response = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(nutritionist.token))
      .send({
        weightKg: 72.5,
        heightCm: 175,
        bodyFatPercent: 22.4,
        notes: 'Medidas registradas em consulta.',
        neckCircumferenceCm: 36,
        waistCircumferenceCm: 82,
        tricepsSkinfoldMm: 14,
      });

    const afterRequest = Date.now();
    expect(response.statusCode).toBe(201);
    expect(response.body.measurement).toMatchObject({
      patientProfileId: (await app.locals.prisma.patientProfile.findUnique({
        where: { userId: patient.user.id },
      })).id,
      weightKg: 72.5,
      heightCm: 175,
      bodyFatPercent: 22.4,
      notes: 'Medidas registradas em consulta.',
      neckCircumferenceCm: 36,
      waistCircumferenceCm: 82,
      tricepsSkinfoldMm: 14,
    });
    expect(new Date(response.body.measurement.recordedAt).getTime())
      .toBeGreaterThanOrEqual(beforeRequest);
    expect(new Date(response.body.measurement.recordedAt).getTime())
      .toBeLessThanOrEqual(afterRequest);

    const patientsResponse = await request(app)
      .get('/api/nutritionist/patients')
      .set(bearer(nutritionist.token));

    expect(patientsResponse.body.patients[0]).toMatchObject({
      id: patient.user.id,
      weight: 72.5,
      height: 175,
      bodyFat: 22.4,
      weightEntries: [
        {
          weight: 72.5,
          date: new Date(response.body.measurement.recordedAt).toLocaleDateString('pt-BR'),
        },
      ],
      bodyMeasurements: {
        latest: expect.arrayContaining([
          { label: 'Peso', value: 72.5, valueLabel: '72.5 kg' },
          { label: 'Altura', value: 175, valueLabel: '175 cm' },
          { label: 'Gordura corporal', value: 22.4, valueLabel: '22.4 %' },
          { label: 'Cintura', value: 82, valueLabel: '82 cm' },
          { label: 'Dobra tricipital', value: 14, valueLabel: '14 mm' },
        ]),
        history: [
          expect.objectContaining({
            id: response.body.measurement.id,
            date: response.body.measurement.recordedAt,
            items: expect.arrayContaining([
              expect.objectContaining({ label: 'Cintura', value: 82 }),
            ]),
          }),
        ],
      },
    });
  });

  it('nega o registro por nutricionista diferente do vinculado', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const linkedNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    await linkPatient(linkedNutritionist, patient);

    const response = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(otherNutritionist.token))
      .send({ weightKg: 72, heightCm: 175 });

    expect(response.statusCode).toBe(403);
  });

  it('retorna 404 para paciente inexistente', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

    const response = await request(app)
      .post('/api/patients/id-inexistente/measurements')
      .set(bearer(nutritionist.token))
      .send({ weightKg: 72, heightCm: 175 });

    expect(response.statusCode).toBe(404);
  });

  it.each([
    [{ weightKg: 0, heightCm: 175 }, 'weightKg'],
    [{ weightKg: 72, heightCm: 301 }, 'heightCm'],
    [{ weightKg: 72, heightCm: 175, waistCircumferenceCm: 251 }, 'waistCircumferenceCm'],
    [{ weightKg: 72, heightCm: 175, tricepsSkinfoldMm: 0 }, 'tricepsSkinfoldMm'],
    [{ weightKg: '72', heightCm: 175 }, 'weightKg'],
  ])('rejeita valor inválido em %s', async (measurements) => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    await linkPatient(nutritionist, patient);

    const response = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(nutritionist.token))
      .send(measurements);

    expect(response.statusCode).toBe(400);
  });

  it('exige peso e altura e não permite informar a data', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    await linkPatient(nutritionist, patient);

    const missingRequiredField = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(nutritionist.token))
      .send({ weightKg: 72 });

    const suppliedDate = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(nutritionist.token))
      .send({
        weightKg: 72,
        heightCm: 175,
        recordedAt: '2000-01-01T00:00:00.000Z',
      });

    expect(missingRequiredField.statusCode).toBe(400);
    expect(suppliedDate.statusCode).toBe(400);
  });

  it('nega acesso a paciente e administrador', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const admin = await createUserWithRole(app, 'ADMIN');
    await linkPatient(nutritionist, patient);

    const asPatient = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(patient.token))
      .send({ weightKg: 72, heightCm: 175 });
    const asAdmin = await request(app)
      .post(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(admin.token))
      .send({ weightKg: 72, heightCm: 175 });

    expect(asPatient.statusCode).toBe(403);
    expect(asAdmin.statusCode).toBe(403);
  });
});
