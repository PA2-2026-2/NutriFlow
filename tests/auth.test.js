const request = require('supertest');
const { createApp } = require('../src/app');
const { cleanupTestUsers, uniqueEmail } = require('./helpers');

describe('autenticação por Supabase e perfis Prisma', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('rejeita e-mail inválido no cadastro antes de chamar o Supabase', async () => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Pessoa Teste',
      email: 'email-invalido',
      password: 'senha1234',
      role: 'patient',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain('e-mail válido');
  });

  it('cria o perfil Prisma com o UUID do Auth e exige confirmação por e-mail', async () => {
    const email = uniqueEmail();
    const response = await request(app).post('/api/auth/register').send({
      name: 'Pessoa Teste',
      email,
      password: 'senha1234',
      role: 'patient',
    });

    expect(response.statusCode).toBe(202);
    expect(response.body).toEqual({
      message: 'Se o cadastro puder ser concluído, enviaremos uma confirmação para o e-mail informado.',
    });
    expect(response.body).not.toHaveProperty('token');

    const authAccount = app.locals.supabaseAuthClient.mock;
    const prismaUser = await app.locals.prisma.user.findUnique({ where: { email } });
    const authUser = authAccount.usersByEmail.get(email).user;

    expect(prismaUser).toMatchObject({
      name: 'Pessoa Teste',
      email,
      profile: 'PATIENT',
      passwordHash: '',
    });
    expect(prismaUser.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(authUser.email_confirmed_at).toBeNull();
    expect(authUser.id).toBe(prismaUser.id);
    expect(authAccount.signupRequests[0].options.emailRedirectTo)
      .toBe('http://127.0.0.1:3000/auth/confirm');
    expect(authAccount.confirmationRequests).toHaveLength(0);
  });

  it('não expõe se um endereço já está cadastrado', async () => {
    const email = uniqueEmail();
    const payload = {
      name: 'Pessoa Duplicada',
      email,
      password: 'senha1234',
      role: 'patient',
    };

    const first = await request(app).post('/api/auth/register').send(payload);
    const repeated = await request(app).post('/api/auth/register').send(payload);

    expect(first.statusCode).toBe(202);
    expect(repeated.statusCode).toBe(202);
    expect(repeated.body).toEqual(first.body);
  });

  it('rejeita campos obrigatórios ausentes e cadastro público de administrador', async () => {
    const missing = await request(app).post('/api/auth/register').send({ email: uniqueEmail() });
    const admin = await request(app).post('/api/auth/register').send({
      name: 'Admin',
      email: uniqueEmail(),
      password: 'senha1234',
      role: 'admin',
    });

    expect(missing.statusCode).toBe(400);
    expect(admin.statusCode).toBe(403);
  });

  it('exibe falha de envio sem tratar o cadastro como confirmado', async () => {
    app.locals.supabaseAuthClient.auth.signUp = async () => ({
      data: null,
      error: { status: 500, message: 'smtp unavailable' },
    });
    const response = await request(app).post('/api/auth/register').send({
      name: 'Pessoa sem e-mail',
      email: uniqueEmail(),
      password: 'senha1234',
      role: 'patient',
    });

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toContain('Não foi possível realizar o cadastro');
    expect(response.body).not.toHaveProperty('token');
  });

  it('expõe somente a chave pública de autenticação ao navegador', async () => {
    const response = await request(app).get('/api/auth/config');

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      url: 'https://auth.test',
      anonKey: 'test-anon-key',
    });
    expect(response.body).not.toHaveProperty('secretKey');
    expect(response.body).not.toHaveProperty('service_role');
  });

  it('bloqueia login até a confirmação informada pelo Supabase', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({
      name: 'Pessoa Pendente',
      email,
      password: 'senha1234',
      role: 'patient',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'senha1234' });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe('Confirme seu e-mail antes de entrar.');
  });

  it('permite login após confirmação, preservando o perfil Prisma', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({
      name: 'Nutricionista Teste',
      email,
      password: 'senha1234',
      role: 'nutricionista',
    });
    app.locals.supabaseAuthClient.mock.confirmEmail(email);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'senha1234' });

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toMatch(/^test-access-/);
    expect(response.body.refreshToken).toMatch(/^test-refresh-/);
    expect(response.body.user).toMatchObject({
      email,
      role: 'NUTRITIONIST',
    });
  });

  it('associa perfil legado por e-mail sem alterar ID, papel ou relações', async () => {
    const email = uniqueEmail();
    const legacy = await app.locals.prisma.user.create({
      data: {
        id: 'legacy-user-id',
        name: 'Perfil Nutricionista Existente',
        email,
        profile: 'NUTRITIONIST',
        passwordHash: 'hash-legado',
      },
    });

    const signup = await request(app).post('/api/auth/register').send({
      name: 'Nome diferente enviado',
      email,
      password: 'senha1234',
      role: 'patient',
    });
    const authId = app.locals.supabaseAuthClient.mock.usersByEmail.get(email).user.id;

    expect(signup.statusCode).toBe(202);
    expect(legacy.id).toBe('legacy-user-id');
    expect(
      await app.locals.prisma.user.findUnique({ where: { id: legacy.id } }),
    ).toMatchObject({
      id: legacy.id,
      authUserId: authId,
      name: 'Perfil Nutricionista Existente',
      profile: 'NUTRITIONIST',
      passwordHash: '',
    });

    app.locals.supabaseAuthClient.mock.confirmEmail(email);
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'senha1234' });
    expect(login.statusCode).toBe(200);
    expect(login.body.user).toMatchObject({
      id: legacy.id,
      role: 'NUTRITIONIST',
    });
  });

  it('rejeita credenciais incorretas e e-mails inválidos no login', async () => {
    const email = uniqueEmail();
    await request(app).post('/api/auth/register').send({
      name: 'Pessoa Confirmada',
      email,
      password: 'senha1234',
      role: 'patient',
    });
    app.locals.supabaseAuthClient.mock.confirmEmail(email);

    const invalidCredentials = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'senha-errada' });
    const invalidEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'invalido', password: 'senha1234' });

    expect(invalidCredentials.statusCode).toBe(401);
    expect(invalidEmail.statusCode).toBe(400);
  });

  it('solicita recuperação com redirect configurado e resposta que evita enumeração', async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post('/api/auth/password-reset')
      .send({ email });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
      'Se houver uma conta associada a esse endereço, enviaremos as instruções de recuperação.',
    );
    expect(app.locals.supabaseAuthClient.mock.resetRequests).toEqual([
      {
        email,
        options: { redirectTo: 'http://127.0.0.1:3000/reset-password' },
      },
    ]);
  });

  it('usa a origem HTTPS da aplicação ao solicitar recuperação em domínio customizado', async () => {
    const email = uniqueEmail();
    const response = await request(app)
      .post('/api/auth/password-reset')
      .set('Origin', 'https://nutriflowconsultorio.online')
      .set('Host', 'nutriflowconsultorio.online')
      .set('x-forwarded-proto', 'https')
      .send({ email });

    expect(response.statusCode).toBe(200);
    expect(app.locals.supabaseAuthClient.mock.resetRequests[0].options.redirectTo)
      .toBe('https://nutriflowconsultorio.online/reset-password');
  });

  it('rejeita e-mail inválido na recuperação e permite reenviar confirmação com resposta genérica', async () => {
    const invalid = await request(app)
      .post('/api/auth/password-reset')
      .send({ email: 'nao-e-email' });
    const resend = await request(app)
      .post('/api/auth/resend-confirmation')
      .send({ email: uniqueEmail() });

    expect(invalid.statusCode).toBe(400);
    expect(resend.statusCode).toBe(200);
    expect(resend.body.message).toContain('Se houver uma conta pendente');
    expect(app.locals.supabaseAuthClient.mock.confirmationRequests[0].options.emailRedirectTo)
      .toBe('http://127.0.0.1:3000/auth/confirm');
  });

  it('encerra a sessão Supabase e bloqueia o token revogado', async () => {
    const account = await require('./helpers').createUserWithRole(app, 'PATIENT');
    const before = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${account.token}`);
    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${account.token}`);
    const after = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${account.token}`);

    expect(before.statusCode).toBe(200);
    expect(logout.statusCode).toBe(200);
    expect(after.statusCode).toBe(401);
  });

  it('rejeita perfil sem sessão válida e mantém logout idempotente', async () => {
    const noSession = await request(app).get('/api/auth/me');
    const logout = await request(app).post('/api/auth/logout');

    expect(noSession.statusCode).toBe(401);
    expect(logout.statusCode).toBe(200);
  });
});
