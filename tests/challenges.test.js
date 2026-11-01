const request = require('supertest');
const { createApp } = require('../src/app');
const { createUserWithRole, cleanupTestUsers, bearer } = require('./helpers');

describe('desafios do nutricionista', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
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
});
