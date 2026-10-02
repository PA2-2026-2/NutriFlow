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
      total_foods: null,
      food_logs_today: null,
      active_meal_plans: null,
      food_catalog_available: false,
      food_logs_available: false,
      meal_plans_available: false,
    });
    expect(activePatient.user.isActive).toBe(true);
    expect(nutritionist.user.isActive).toBe(true);
  });

  it('deve exigir autenticação de administrador', async () => {
    const response = await request(app).get('/api/admin/summary');
    expect(response.statusCode).toBe(401);
  });
});
