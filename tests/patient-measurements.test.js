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

  describe('GET /api/patients/:id/measurements', () => {
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

    it('retorna todas as medidas em ordem cronologica para o paciente e nutricionista vinculado', async () => {
      const patient = await createUserWithRole(app, 'PATIENT');
      const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      const profile = await linkPatient(nutritionist, patient);
      const older = await app.locals.prisma.patientMeasurement.create({
        data: {
          patientProfileId: profile.id,
          weightKg: 70,
          heightCm: 175,
          recordedAt: new Date('2026-01-10T10:00:00.000Z'),
        },
      });
      const newer = await app.locals.prisma.patientMeasurement.create({
        data: {
          patientProfileId: profile.id,
          weightKg: 72,
          heightCm: 175,
          waistCircumferenceCm: 80,
          recordedAt: new Date('2026-02-10T10:00:00.000Z'),
        },
      });

      const patientResponse = await request(app)
        .get(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(patient.token));
      const nutritionistResponse = await request(app)
        .get(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(nutritionist.token));

      for (const response of [patientResponse, nutritionistResponse]) {
        expect(response.statusCode).toBe(200);
        expect(response.body.measurements.map((entry) => entry.id)).toEqual([older.id, newer.id]);
        expect(response.body.measurements.map((entry) => entry.recordedAt)).toEqual([
          older.recordedAt.toISOString(),
          newer.recordedAt.toISOString(),
        ]);
      }
      expect(patientResponse.body.measurements[1]).toMatchObject({
        weightKg: 72,
        waistCircumferenceCm: 80,
      });
    });

    it('impede que o paciente consulte outro e que nutricionista consulte paciente nao vinculado', async () => {
      const patient = await createUserWithRole(app, 'PATIENT');
      const otherPatient = await createUserWithRole(app, 'PATIENT');
      const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      await linkPatient(nutritionist, patient);

      const patientLookingAtOther = await request(app)
        .get(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(otherPatient.token));
      const unrelatedNutritionist = await request(app)
        .get(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(otherNutritionist.token));

      expect(patientLookingAtOther.statusCode).toBe(403);
      expect(unrelatedNutritionist.statusCode).toBe(403);
    });

    it('retorna historico vazio ao proprio paciente sem perfil ou medidas', async () => {
      const patient = await createUserWithRole(app, 'PATIENT');
      const response = await request(app)
        .get(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(patient.token));

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ measurements: [] });
    });
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

  describe('PUT/PATCH/DELETE /api/patients/:id/measurements/:measurementId', () => {
    it('atualiza parcialmente a medida somente para o nutricionista responsavel', async () => {
      const patient = await createUserWithRole(app, 'PATIENT');
      const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      await linkPatient(nutritionist, patient);

      const created = await request(app)
        .post(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(nutritionist.token))
        .send({
          weightKg: 72,
          heightCm: 175,
          waistCircumferenceCm: 82,
          notes: 'Registro inicial',
        });

      const updated = await request(app)
        .patch(`/api/patients/${patient.user.id}/measurements/${created.body.measurement.id}`)
        .set(bearer(nutritionist.token))
        .send({ weightKg: 70, waistCircumferenceCm: null });
      const forbidden = await request(app)
        .patch(`/api/patients/${patient.user.id}/measurements/${created.body.measurement.id}`)
        .set(bearer(otherNutritionist.token))
        .send({ weightKg: 69 });

      expect(updated.statusCode).toBe(200);
      expect(updated.body.measurement).toMatchObject({
        weightKg: 70,
        heightCm: 175,
        waistCircumferenceCm: null,
        notes: 'Registro inicial',
      });
      expect(forbidden.statusCode).toBe(403);
    });

    it('substitui os dados com PUT e valida peso e altura obrigatorios', async () => {
      const patient = await createUserWithRole(app, 'PATIENT');
      const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      await linkPatient(nutritionist, patient);

      const created = await request(app)
        .post(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(nutritionist.token))
        .send({
          weightKg: 72,
          heightCm: 175,
          waistCircumferenceCm: 82,
          notes: 'Registro inicial',
        });

      const updated = await request(app)
        .put(`/api/patients/${patient.user.id}/measurements/${created.body.measurement.id}`)
        .set(bearer(nutritionist.token))
        .send({ weightKg: 71, heightCm: 174 });
      const invalid = await request(app)
        .put(`/api/patients/${patient.user.id}/measurements/${created.body.measurement.id}`)
        .set(bearer(nutritionist.token))
        .send({ weightKg: 71 });

      expect(updated.statusCode).toBe(200);
      expect(updated.body.measurement).toMatchObject({
        weightKg: 71,
        heightCm: 174,
        waistCircumferenceCm: null,
        notes: null,
      });
      expect(invalid.statusCode).toBe(400);
    });

    it('remove a medida do historico de evolucao', async () => {
      const patient = await createUserWithRole(app, 'PATIENT');
      const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      await linkPatient(nutritionist, patient);

      const created = await request(app)
        .post(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(nutritionist.token))
        .send({ weightKg: 72, heightCm: 175 });
      const deleted = await request(app)
        .delete(`/api/patients/${patient.user.id}/measurements/${created.body.measurement.id}`)
        .set(bearer(nutritionist.token));
      const history = await request(app)
        .get(`/api/patients/${patient.user.id}/measurements`)
        .set(bearer(patient.token));

      expect(deleted.statusCode).toBe(200);
      expect(deleted.body).toEqual({ message: 'Medida removida com sucesso.' });
      expect(history.statusCode).toBe(200);
      expect(history.body.measurements).toEqual([]);
    });

    it('retorna 404 ao editar ou remover uma medida inexistente', async () => {
      const patient = await createUserWithRole(app, 'PATIENT');
      const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
      await linkPatient(nutritionist, patient);

      const path = `/api/patients/${patient.user.id}/measurements/medida-inexistente`;
      const updated = await request(app)
        .patch(path)
        .set(bearer(nutritionist.token))
        .send({ weightKg: 70 });
      const deleted = await request(app)
        .delete(path)
        .set(bearer(nutritionist.token));

      expect(updated.statusCode).toBe(404);
      expect(deleted.statusCode).toBe(404);
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

  it('edita parcialmente uma medida e reflete os valores atualizados no historico', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const profile = await linkPatient(nutritionist, patient);
    const measurement = await app.locals.prisma.patientMeasurement.create({
      data: {
        patientProfileId: profile.id,
        weightKg: 72,
        heightCm: 175,
        waistCircumferenceCm: 82,
        notes: 'Registro original',
      },
    });

    const response = await request(app)
      .put(`/api/patients/${patient.user.id}/measurements/${measurement.id}`)
      .set(bearer(nutritionist.token))
      .send({
        weightKg: 73,
        waistCircumferenceCm: null,
        notes: '  Registro corrigido  ',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.measurement).toMatchObject({
      id: measurement.id,
      weightKg: 73,
      heightCm: 175,
      waistCircumferenceCm: null,
      notes: 'Registro corrigido',
    });

    const history = await request(app)
      .get(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(patient.token));
    expect(history.body.measurements).toHaveLength(1);
    expect(history.body.measurements[0]).toMatchObject({
      id: measurement.id,
      weightKg: 73,
      waistCircumferenceCm: null,
    });
  });

  it('remove a medida do historico de evolucao', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const profile = await linkPatient(nutritionist, patient);
    const measurement = await app.locals.prisma.patientMeasurement.create({
      data: {
        patientProfileId: profile.id,
        weightKg: 72,
        heightCm: 175,
      },
    });

    const response = await request(app)
      .delete(`/api/patients/${patient.user.id}/measurements/${measurement.id}`)
      .set(bearer(nutritionist.token));

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toContain('historico de evolucao');

    const history = await request(app)
      .get(`/api/patients/${patient.user.id}/measurements`)
      .set(bearer(patient.token));
    expect(history.body.measurements).toEqual([]);
    expect(await app.locals.prisma.patientMeasurement.findUnique({
      where: { id: measurement.id },
    })).toBeNull();
  });

  it('permite alterar ou excluir apenas ao nutricionista responsavel', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const profile = await linkPatient(nutritionist, patient);
    const measurement = await app.locals.prisma.patientMeasurement.create({
      data: {
        patientProfileId: profile.id,
        weightKg: 72,
        heightCm: 175,
      },
    });

    const update = await request(app)
      .put(`/api/patients/${patient.user.id}/measurements/${measurement.id}`)
      .set(bearer(otherNutritionist.token))
      .send({ weightKg: 73 });
    const deletion = await request(app)
      .delete(`/api/patients/${patient.user.id}/measurements/${measurement.id}`)
      .set(bearer(otherNutritionist.token));

    expect(update.statusCode).toBe(403);
    expect(deletion.statusCode).toBe(403);
    expect((await app.locals.prisma.patientMeasurement.findUnique({
      where: { id: measurement.id },
    })).weightKg).toBe(72);
  });

  it.each([
    [{}],
    [{ weightKg: 0 }],
    [{ heightCm: null }],
    [{ recordedAt: '2000-01-01T00:00:00.000Z' }],
  ])('rejeita dados invalidos ao editar medidas: %s', async (payload) => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const profile = await linkPatient(nutritionist, patient);
    const measurement = await app.locals.prisma.patientMeasurement.create({
      data: {
        patientProfileId: profile.id,
        weightKg: 72,
        heightCm: 175,
      },
    });

    const response = await request(app)
      .put(`/api/patients/${patient.user.id}/measurements/${measurement.id}`)
      .set(bearer(nutritionist.token))
      .send(payload);

    expect(response.statusCode).toBe(400);
  });

  it('retorna 404 ao editar ou excluir medida inexistente do paciente', async () => {
    const patient = await createUserWithRole(app, 'PATIENT');
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    await linkPatient(nutritionist, patient);

    const update = await request(app)
      .put(`/api/patients/${patient.user.id}/measurements/medida-inexistente`)
      .set(bearer(nutritionist.token))
      .send({ weightKg: 73 });
    const deletion = await request(app)
      .delete(`/api/patients/${patient.user.id}/measurements/medida-inexistente`)
      .set(bearer(nutritionist.token));

    expect(update.statusCode).toBe(404);
    expect(deletion.statusCode).toBe(404);
  });
});
