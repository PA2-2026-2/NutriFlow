const request = require('supertest');
const { createApp } = require('../src/app');
const { createUserWithRole, cleanupTestUsers, bearer } = require('./helpers');


describe('/api/users/me', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  describe('GET /api/users/me', () => {
    it.each(['PATIENT', 'NUTRITIONIST'])('deve retornar os dados de %s autenticado', async (role) => {
      const account = await createUserWithRole(app, role, { name: 'Maria Silva' });

      const response = await request(app).get('/api/users/me').set(bearer(account.token));

      expect(response.statusCode).toBe(200);
      expect(response.body.user).toMatchObject({
        id: account.user.id,
        name: 'Maria Silva',
        email: account.email,
        role,
        isActive: true,
        phone: null,
        profilePhotoUrl: null,
      });
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('deve exigir token', async () => {
      const response = await request(app).get('/api/users/me');
      expect(response.statusCode).toBe(401);
    });
  });

  describe('PUT /api/users/me', () => {
    it('deve atualizar nome e telefone e persistir', async () => {
      const account = await createUserWithRole(app, 'PATIENT');

      const response = await request(app)
        .put('/api/users/me')
        .set(bearer(account.token))
        .send({ name: '  Novo Nome  ', phone: '+55 (85) 99999-0000' });

      expect(response.statusCode).toBe(200);
      expect(response.body.user).toMatchObject({ name: 'Novo Nome', phone: '5585999990000' });

      const again = await request(app).get('/api/users/me').set(bearer(account.token));
      expect(again.body.user).toMatchObject({ name: 'Novo Nome', phone: '5585999990000' });
    });

    it('deve atualizar so o campo enviado (parcial)', async () => {
      const account = await createUserWithRole(app, 'PATIENT', { name: 'Nome Original' });

      const response = await request(app)
        .put('/api/users/me')
        .set(bearer(account.token))
        .send({ phone: '85999990000' });

      expect(response.statusCode).toBe(200);
      expect(response.body.user).toMatchObject({ name: 'Nome Original', phone: '85999990000' });
    });

    it('deve permitir remover o telefone', async () => {
      const account = await createUserWithRole(app, 'PATIENT', { data: { phone: '85999990000' } });

      const response = await request(app)
        .put('/api/users/me')
        .set(bearer(account.token))
        .send({ phone: '' });

      expect(response.statusCode).toBe(200);
      expect(response.body.user.phone).toBeNull();
    });

    it('deve ignorar campos nao permitidos (e-mail, perfil, status, senha)', async () => {
      const account = await createUserWithRole(app, 'PATIENT');

      const response = await request(app)
        .put('/api/users/me')
        .set(bearer(account.token))
        .send({
          name: 'Continua Paciente',
          email: 'outro@email.com',
          role: 'ADMIN',
          profile: 'ADMIN',
          isActive: false,
          passwordHash: 'x',
          id: 'outro-id',
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.user).toMatchObject({
        id: account.user.id,
        name: 'Continua Paciente',
        email: account.email,
        role: 'PATIENT',
        isActive: true,
      });

      
      const adminRoute = await request(app).get('/api/admin/users').set(bearer(account.token));
      expect(adminRoute.statusCode).toBe(403);
    });

    it('deve rejeitar nome vazio ou longo demais', async () => {
      const account = await createUserWithRole(app, 'PATIENT');

      for (const name of ['', '   ', 'a'.repeat(101), 123]) {
        const response = await request(app)
          .put('/api/users/me')
          .set(bearer(account.token))
          .send({ name });

        expect(response.statusCode).toBe(400);
      }
    });

    it('deve rejeitar telefone invalido', async () => {
      const account = await createUserWithRole(app, 'PATIENT');

      for (const phone of ['123', 'abc', '1'.repeat(20), { a: 1 }]) {
        const response = await request(app)
          .put('/api/users/me')
          .set(bearer(account.token))
          .send({ phone });

        expect(response.statusCode).toBe(400);
      }
    });

    it('deve rejeitar corpo sem nenhum campo atualizavel', async () => {
      const account = await createUserWithRole(app, 'PATIENT');

      const response = await request(app)
        .put('/api/users/me')
        .set(bearer(account.token))
        .send({ email: 'so-email@teste.com' });

      expect(response.statusCode).toBe(400);
    });

    it('deve exigir token', async () => {
      const response = await request(app).put('/api/users/me').send({ name: 'X' });
      expect(response.statusCode).toBe(401);
    });
  });
});
