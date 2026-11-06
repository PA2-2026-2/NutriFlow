const { performance } = require('node:perf_hooks');
const request = require('supertest');
const { createApp } = require('../src/app');
const {
  createUserWithRole,
  cleanupTestUsers,
  bearer,
} = require('./helpers');

describe('performance endpoints benchmark', () => {
  let app;
  let patient;
  let nutritionist;
  let admin;

  beforeAll(async () => {
    app = createApp();
    patient = await createUserWithRole(app, 'PATIENT');
    nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
    admin = await createUserWithRole(app, 'ADMIN');

    await request(app)
      .post('/api/nutritionist/link-patient')
      .set(bearer(nutritionist.token))
      .send({ patientEmail: patient.email, age: 35, objective: 'Benchmark' })
      .expect(200);

    const profile = await app.locals.prisma.patientProfile.findUnique({
      where: { userId: patient.user.id },
    });
    const now = Date.now();
    const measurementFields = {
      weightKg: 70,
      heightCm: 170,
      bodyFatPercent: 20,
      notes: null,
      neckCircumferenceCm: null,
      chestCircumferenceCm: null,
      waistCircumferenceCm: 80,
      hipCircumferenceCm: null,
      armCircumferenceCm: null,
      thighCircumferenceCm: null,
      calfCircumferenceCm: null,
      tricepsSkinfoldMm: null,
      bicepsSkinfoldMm: null,
      subscapularSkinfoldMm: null,
      suprailiacSkinfoldMm: null,
      abdominalSkinfoldMm: null,
      thighSkinfoldMm: null,
      calfSkinfoldMm: null,
    };

    await app.locals.prisma.patientMeasurement.createMany({
      data: Array.from({ length: 500 }, (_, index) => ({
        id: `benchmark-measurement-${index}`,
        patientProfileId: profile.id,
        ...measurementFields,
        recordedAt: new Date(now - index * 86400000),
      })),
    });
    await app.locals.prisma.patientWeightEntry.createMany({
      data: Array.from({ length: 500 }, (_, index) => ({
        id: `benchmark-weight-${index}`,
        userId: patient.user.id,
        weightKg: 70,
        note: '',
        recordedAt: new Date(now - index * 86400000),
      })),
    });
    await app.locals.prisma.patientMealEntry.createMany({
      data: Array.from({ length: 500 }, (_, index) => ({
        id: `benchmark-meal-${index}`,
        userId: patient.user.id,
        mealType: 'Almoco',
        title: 'Refeicao de benchmark',
        description: '',
        calories: 500,
        protein: 30,
        carbs: 60,
        fats: 15,
        fiber: 5,
        waterMl: 300,
        loggedAt: new Date(now - index * 3600000),
      })),
    });
  });

  afterAll(async () => {
    if (patient) {
      const profile = await app.locals.prisma.patientProfile.findUnique({
        where: { userId: patient.user.id },
        select: { id: true },
      });
      if (profile) {
        await app.locals.prisma.patientMeasurement.deleteMany({
          where: { patientProfileId: profile.id },
        });
      }
      await Promise.all([
        app.locals.prisma.patientWeightEntry.deleteMany({ where: { userId: patient.user.id } }),
        app.locals.prisma.patientMealEntry.deleteMany({ where: { userId: patient.user.id } }),
      ]);
    }
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('mede os endpoints prioritários com histórico sintético', async () => {
    const endpoints = [
      {
        name: 'GET /api/patients/:id/measurements',
        run: () => request(app)
          .get(`/api/patients/${patient.user.id}/measurements`)
          .set(bearer(patient.token)),
      },
      {
        name: 'GET /api/patient/dashboard',
        run: () => request(app)
          .get('/api/patient/dashboard')
          .set(bearer(patient.token)),
      },
      {
        name: 'GET /api/nutritionist/patients',
        run: () => request(app)
          .get('/api/nutritionist/patients')
          .set(bearer(nutritionist.token)),
      },
      {
        name: 'GET /api/admin/summary',
        run: () => request(app)
          .get('/api/admin/summary')
          .set(bearer(admin.token)),
      },
    ];

    const results = [];
    for (const endpoint of endpoints) {
      for (let index = 0; index < 2; index += 1) {
        await endpoint.run().expect(200);
      }

      const durations = [];
      for (let index = 0; index < 5; index += 1) {
        const start = performance.now();
        await endpoint.run().expect(200);
        durations.push(performance.now() - start);
      }

      results.push({
        endpoint: endpoint.name,
        method: 'GET',
        requests: durations.length,
        averageMs: Number((durations.reduce((sum, duration) => sum + duration, 0) / durations.length).toFixed(2)),
        minimumMs: Number(Math.min(...durations).toFixed(2)),
        maximumMs: Number(Math.max(...durations).toFixed(2)),
      });
    }

    console.log(`PERFORMANCE_BENCHMARK ${JSON.stringify({
      environment: 'SQLite test database',
      syntheticRecords: { measurements: 500, weights: 500, meals: 500 },
      databaseQueryCount: 'not instrumented',
      results,
    })}`);
  }, 60000);
});
