const request = require('supertest');
const { createApp } = require('../src/app');
const {
  PASSWORD,
  uniqueEmail,
  createUserWithRole,
  cleanupTestUsers,
  bearer,
} = require('./helpers');


describe('/api/admin/users', () => {
  let app;
  let admin;
  let patient;
  let nutritionist;

  beforeAll(async () => {
    app = createApp();
    admin = await createUserWithRole(app, 'ADMIN', { name: 'Admin Sprint2' });
    patient = await createUserWithRole(app, 'PATIENT', { name: 'Paciente Alfa' });
    nutritionist = await createUserWithRole(app, 'NUTRITIONIST', { name: 'Nutri Beta' });
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  describe('GET /api/admin/users', () => {
    it('deve listar usuarios sem expor o hash da senha', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(200);

      const emails = response.body.users.map((user) => user.email);
      expect(emails).toContain(admin.email);
      expect(emails).toContain(patient.email);
      expect(emails).toContain(nutritionist.email);
      expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    });

    it('deve retornar a data de criacao original do Prisma em formato ISO', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set(bearer(admin.token));
      const listedPatient = response.body.users.find((user) => user.id === patient.user.id);

      expect(response.statusCode).toBe(200);
      expect(listedPatient.createdAt).toBe(patient.user.createdAt.toISOString());
    });

    it('deve filtrar por role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=NUTRITIONIST')
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(200);
      expect(response.body.users.length > 0).toBe(true);
      expect(response.body.users.every((user) => user.role === 'NUTRITIONIST')).toBe(true);
      expect(response.body.users.map((user) => user.email)).toContain(nutritionist.email);
    });

    it('deve aceitar o apelido em portugues no filtro de role', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=paciente')
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(200);
      expect(response.body.users.every((user) => user.role === 'PATIENT')).toBe(true);
    });

    it('deve rejeitar role invalida no filtro', async () => {
      const response = await request(app)
        .get('/api/admin/users?role=chefe')
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(400);
    });

    it('deve buscar por nome ou e-mail', async () => {
      const response = await request(app)
        .get('/api/admin/users?search=Paciente Alfa')
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(200);
      expect(response.body.users.map((user) => user.email)).toContain(patient.email);
      expect(response.body.users.map((user) => user.email)).not.toContain(nutritionist.email);
    });
  });

  describe('PUT /api/admin/users/:userId', () => {
    it('deve editar nome, e-mail e telefone', async () => {
      const target = await createUserWithRole(app, 'PATIENT');
      const newEmail = uniqueEmail('editado');

      const response = await request(app)
        .put(`/api/admin/users/${target.user.id}`)
        .set(bearer(admin.token))
        .send({ name: '  Nome Editado ', email: newEmail.toUpperCase(), phone: '(85) 99999-0000' });

      expect(response.statusCode).toBe(200);
      expect(response.body.user).toMatchObject({
        id: target.user.id,
        name: 'Nome Editado',
        email: newEmail,
        phone: '85999990000',
        role: 'PATIENT',
      });
    });

    it('nao deve alterar o perfil (role) por aqui', async () => {
      const target = await createUserWithRole(app, 'PATIENT');

      const response = await request(app)
        .put(`/api/admin/users/${target.user.id}`)
        .set(bearer(admin.token))
        .send({ name: 'Mesmo Perfil', email: target.email, role: 'ADMIN' });

      expect(response.statusCode).toBe(200);
      expect(response.body.user.role).toBe('PATIENT');
    });

    it('deve rejeitar nome/e-mail ausentes e e-mail invalido', async () => {
      const target = await createUserWithRole(app, 'PATIENT');
      const url = `/api/admin/users/${target.user.id}`;

      const missing = await request(app).put(url).set(bearer(admin.token)).send({ name: 'So Nome' });
      const invalidEmail = await request(app)
        .put(url)
        .set(bearer(admin.token))
        .send({ name: 'Nome', email: 'isso-nao-e-email' });
      const invalidPhone = await request(app)
        .put(url)
        .set(bearer(admin.token))
        .send({ name: 'Nome', email: target.email, phone: '123' });

      expect(missing.statusCode).toBe(400);
      expect(invalidEmail.statusCode).toBe(400);
      expect(invalidPhone.statusCode).toBe(400);
    });

    it('deve recusar e-mail ja usado por outra conta (409)', async () => {
      const target = await createUserWithRole(app, 'PATIENT');

      const response = await request(app)
        .put(`/api/admin/users/${target.user.id}`)
        .set(bearer(admin.token))
        .send({ name: 'Duplicado', email: patient.email });

      expect(response.statusCode).toBe(409);
    });

    it('deve retornar 404 para usuario inexistente', async () => {
      const response = await request(app)
        .put('/api/admin/users/00000000-0000-0000-0000-000000000000')
        .set(bearer(admin.token))
        .send({ name: 'Ninguem', email: uniqueEmail() });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/admin/users/:userId/status', () => {
    it('deve bloquear e o bloqueio vale na hora (token e login)', async () => {
      const target = await createUserWithRole(app, 'PATIENT');

      const before = await request(app).get('/api/users/me').set(bearer(target.token));
      expect(before.statusCode).toBe(200);

      const block = await request(app)
        .patch(`/api/admin/users/${target.user.id}/status`)
        .set(bearer(admin.token))
        .send({ isActive: false });

      expect(block.statusCode).toBe(200);
      expect(block.body.user.isActive).toBe(false);

      const withOldToken = await request(app).get('/api/users/me').set(bearer(target.token));
      expect(withOldToken.statusCode).toBe(403);

      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: target.email, password: PASSWORD });
      expect(login.statusCode).toBe(403);
    });

    it('deve desbloquear e o usuario volta a acessar', async () => {
      const target = await createUserWithRole(app, 'PATIENT');
      const url = `/api/admin/users/${target.user.id}/status`;

      await request(app).patch(url).set(bearer(admin.token)).send({ isActive: false });
      const unblock = await request(app).patch(url).set(bearer(admin.token)).send({ isActive: true });

      expect(unblock.statusCode).toBe(200);
      expect(unblock.body.user.isActive).toBe(true);

      const response = await request(app).get('/api/users/me').set(bearer(target.token));
      expect(response.statusCode).toBe(200);
    });

    it('deve exigir isActive booleano', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${patient.user.id}/status`)
        .set(bearer(admin.token))
        .send({ isActive: 'false' });

      expect(response.statusCode).toBe(400);
    });

    it('nao deve permitir que o admin bloqueie a propria conta', async () => {
      const response = await request(app)
        .patch(`/api/admin/users/${admin.user.id}/status`)
        .set(bearer(admin.token))
        .send({ isActive: false });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    it('deve remover o usuario e invalidar o token dele', async () => {
      const target = await createUserWithRole(app, 'PATIENT');

      const response = await request(app)
        .delete(`/api/admin/users/${target.user.id}`)
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(200);

      const list = await request(app).get('/api/admin/users').set(bearer(admin.token));
      expect(list.body.users.map((user) => user.id)).not.toContain(target.user.id);

      const withOldToken = await request(app).get('/api/users/me').set(bearer(target.token));
      expect(withOldToken.statusCode).toBe(401);
    });

    it('nao deve permitir que o admin remova a propria conta', async () => {
      const response = await request(app)
        .delete(`/api/admin/users/${admin.user.id}`)
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(400);
    });

    it('deve retornar 404 para usuario inexistente', async () => {
      const response = await request(app)
        .delete('/api/admin/users/00000000-0000-0000-0000-000000000000')
        .set(bearer(admin.token));

      expect(response.statusCode).toBe(404);
    });
  });

  describe('controle de acesso', () => {
    it('deve exigir token', async () => {
      const response = await request(app).get('/api/admin/users');
      expect(response.statusCode).toBe(401);
    });

    it('deve negar acesso a paciente e nutricionista (403) em todas as rotas', async () => {
      const id = patient.user.id;

      for (const { token } of [patient, nutritionist]) {
        const calls = [
          request(app).get('/api/admin/users'),
          request(app).put(`/api/admin/users/${id}`).send({ name: 'X', email: uniqueEmail() }),
          request(app).patch(`/api/admin/users/${id}/status`).send({ isActive: false }),
          request(app).delete(`/api/admin/users/${id}`),
        ];

        for (const call of calls) {
          const response = await call.set(bearer(token));
          expect(response.statusCode).toBe(403);
        }
      }

      
      const check = await request(app).get('/api/users/me').set(bearer(patient.token));
      expect(check.statusCode).toBe(200);
      expect(check.body.user.isActive).toBe(true);
    });
  });
});
