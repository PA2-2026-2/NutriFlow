const request = require('supertest');
const { createApp } = require('../src/app');

function uniqueEmail() {
  return `teste-${Date.now()}-${Math.floor(Math.random() * 10000)}@nutriflow.com`;
}

describe('POST /api/auth/register', () => {
  it('deve cadastrar um usuario com sucesso', async () => {
    const app = createApp();
    const email = uniqueEmail();

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Usuario Teste',
        email,
        password: 'senha1234',
        role: 'patient',
      });

    expect(response.statusCode).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user).toMatchObject({
      name: 'Usuario Teste',
      email,
      role: 'PATIENT',
    });
  });

  it('deve rejeitar cadastro com e-mail ja existente', async () => {
    const app = createApp();
    const email = uniqueEmail();
    const payload = {
      name: 'Usuario Duplicado',
      email,
      password: 'senha1234',
      role: 'patient',
    };

    await request(app).post('/api/auth/register').send(payload);
    const response = await request(app).post('/api/auth/register').send(payload);

    expect(response.statusCode).toBe(409);
  });

  it('deve rejeitar cadastro com campos faltando', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/register')
      .send({ email: uniqueEmail() });

    expect(response.statusCode).toBe(400);
  });
});

describe('POST /api/auth/register - perfis permitidos', () => {
  it('deve cadastrar nutricionista', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Nutri Teste',
        email: uniqueEmail(),
        password: 'senha1234',
        role: 'nutricionista',
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.user.role).toBe('NUTRITIONIST');
  });

  it('deve recusar cadastro publico de administrador', async () => {
    const app = createApp();

    for (const role of ['admin', 'ADMIN', 'Administrador']) {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Quero Ser Admin',
          email: uniqueEmail(),
          password: 'senha1234',
          role,
        });

      expect(response.statusCode).toBe(403);
      expect(response.body).not.toHaveProperty('token');
    }
  });
});

describe('POST /api/auth/login', () => {
  it('deve autenticar com credenciais validas', async () => {
    const app = createApp();
    const email = uniqueEmail();

    await request(app).post('/api/auth/register').send({
      name: 'Usuario Login',
      email,
      password: 'senha1234',
      role: 'patient',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'senha1234' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('token');
  });

  it('deve rejeitar login com senha incorreta', async () => {
    const app = createApp();
    const email = uniqueEmail();

    await request(app).post('/api/auth/register').send({
      name: 'Usuario Senha Errada',
      email,
      password: 'senha1234',
      role: 'patient',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'senhaErrada' });

    expect(response.statusCode).toBe(401);
  });

  it('deve rejeitar login com e-mail inexistente', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail(), password: 'senha1234' });

    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('deve invalidar o token apos o logout', async () => {
    const app = createApp();
    const email = uniqueEmail();

    const registerResponse = await request(app).post('/api/auth/register').send({
      name: 'Usuario Logout',
      email,
      password: 'senha1234',
      role: 'patient',
    });

    const { token } = registerResponse.body;

    const meBeforeLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meBeforeLogout.statusCode).toBe(200);

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(logoutResponse.statusCode).toBe(200);

    const meAfterLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meAfterLogout.statusCode).toBe(401);
  });

  it('deve retornar sucesso mesmo sem token informado', async () => {
    const app = createApp();

    const response = await request(app).post('/api/auth/logout');

    expect(response.statusCode).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('deve rejeitar acesso sem token', async () => {
    const app = createApp();

    const response = await request(app).get('/api/auth/me');

    expect(response.statusCode).toBe(401);
  });
});