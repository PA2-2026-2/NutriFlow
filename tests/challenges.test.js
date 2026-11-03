const request = require('supertest');
const { createApp } = require('../src/app');
const { createUserWithRole, cleanupTestUsers, bearer } = require('./helpers');

describe('desafios do nutricionista', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    const challengeFilter = {
      challenge: {
        nutritionist: {
          email: { endsWith: '@sprint2.nutriflow.test' },
        },
      },
    };
    await app.locals.prisma.challengeCheckIn.deleteMany({
      where: { participation: challengeFilter },
    });
    await app.locals.prisma.challengeParticipant.deleteMany({
      where: challengeFilter,
    });
    await app.locals.prisma.challenge.deleteMany({
      where: {
        nutritionist: {
          email: { endsWith: '@sprint2.nutriflow.test' },
        },
      },
    });
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('cria e lista um desafio para o nutricionista autenticado', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const payload = {
      title: 'Hidratacao diaria',
      description: 'Aumentar o consumo de agua.',
      category: 'HIDRATACAO',
      goalDescription: 'Beber agua todos os dias',
      goalTarget: 2,
      startDate: '2026-11-02',
      endDate: '2026-11-30',
    };

    const createResponse = await request(app)
      .post('/api/nutritionist/challenges')
      .set(bearer(nutritionist.token))
      .send(payload);

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.body.challenge).toMatchObject({
      nutritionistId: nutritionist.user.id,
      title: payload.title,
      goalDescription: payload.goalDescription,
      goalTarget: payload.goalTarget,
      participantCount: 0,
      participants: [],
    });

    const listResponse = await request(app)
      .get('/api/nutritionist/challenges')
      .set(bearer(nutritionist.token));

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.body.challenges).toContainEqual(createResponse.body.challenge);
  });

  it('limita os dados de participantes exibidos a cada paciente', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const firstPatient = await createUserWithRole(app, 'PATIENT');
    const secondPatient = await createUserWithRole(app, 'PATIENT');
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);
    const startDateLabel = startDate.toISOString().slice(0, 10);
    const endDateLabel = endDate.toISOString().slice(0, 10);

    for (const patient of [firstPatient, secondPatient]) {
      await app.locals.prisma.patientProfile.create({
        data: {
          userId: patient.user.id,
          nutritionistId: nutritionist.user.id,
        },
      });
    }

    const created = await request(app)
      .post('/api/nutritionist/challenges')
      .set(bearer(nutritionist.token))
      .send({
        title: 'Rotina de hidratacao',
        goalDescription: 'Registrar hidratacao diariamente',
        startDate: startDateLabel,
        endDate: endDateLabel,
      });
    const challengeId = created.body.challenge.id;

    const selfEnrollment = await request(app)
      .post(`/api/patients/challenges/${challengeId}/enroll`)
      .set(bearer(firstPatient.token));
    const nutritionistEnrollment = await request(app)
      .post(`/api/nutritionist/challenges/${challengeId}/participants`)
      .set(bearer(nutritionist.token))
      .send({ patientId: secondPatient.user.id });

    expect(selfEnrollment.statusCode).toBe(201);
    expect(nutritionistEnrollment.statusCode).toBe(201);

    const checkIn = await request(app)
      .post(`/api/patients/challenges/${challengeId}/checkins`)
      .set(bearer(secondPatient.token))
      .send({ checkInDate: startDateLabel, completed: true });
    expect(checkIn.statusCode).toBe(201);

    const firstPatientChallenges = await request(app)
      .get('/api/patients/challenges')
      .set(bearer(firstPatient.token));
    const visibleChallenge = firstPatientChallenges.body.challenges.find(
      (challenge) => challenge.id === challengeId,
    );

    expect(firstPatientChallenges.statusCode).toBe(200);
    expect(visibleChallenge.participantCount).toBe(2);
    expect(visibleChallenge.participants).toHaveLength(1);
    expect(visibleChallenge.participants[0].patientId).toBe(firstPatient.user.id);
    expect(visibleChallenge.averageProgress).toBe(0);
    expect(JSON.stringify(visibleChallenge)).not.toContain(secondPatient.user.id);

    const nutritionistChallenges = await request(app)
      .get('/api/nutritionist/challenges')
      .set(bearer(nutritionist.token));
    const nutritionistView = nutritionistChallenges.body.challenges.find(
      (challenge) => challenge.id === challengeId,
    );
    expect(nutritionistView.participants).toHaveLength(2);
  });

  it('impede o nutricionista de inscrever pacientes sem vínculo com sua conta', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const unlinkedPatient = await createUserWithRole(app, 'PATIENT');
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);

    const created = await request(app)
      .post('/api/nutritionist/challenges')
      .set(bearer(nutritionist.token))
      .send({
        title: 'Desafio restrito',
        goalDescription: 'Participacao vinculada',
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      });

    await app.locals.prisma.patientProfile.create({
      data: {
        userId: unlinkedPatient.user.id,
        nutritionistId: otherNutritionist.user.id,
      },
    });

    const response = await request(app)
      .post(`/api/nutritionist/challenges/${created.body.challenge.id}/participants`)
      .set(bearer(nutritionist.token))
      .send({ patientId: unlinkedPatient.user.id });

    expect(response.statusCode).toBe(403);
  });

  it('impede o nutricionista de incluir pacientes em desafios de outro profissional', async () => {
    const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    const challengeOwner = await createUserWithRole(app, 'NUTRITIONIST');
    const patient = await createUserWithRole(app, 'PATIENT');
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);

    await app.locals.prisma.patientProfile.create({
      data: {
        userId: patient.user.id,
        nutritionistId: challengeOwner.user.id,
      },
    });

    const created = await request(app)
      .post('/api/nutritionist/challenges')
      .set(bearer(challengeOwner.token))
      .send({
        title: 'Desafio de outro profissional',
        goalDescription: 'Manter o acompanhamento autorizado',
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      });

    const response = await request(app)
      .post(`/api/nutritionist/challenges/${created.body.challenge.id}/participants`)
      .set(bearer(nutritionist.token))
      .send({ patientId: patient.user.id });

    expect(response.statusCode).toBe(404);
    expect(await app.locals.prisma.challengeParticipant.findUnique({
      where: {
        challengeId_patientId: {
          challengeId: created.body.challenge.id,
          patientId: patient.user.id,
        },
      },
    })).toBeNull();
  });
});
