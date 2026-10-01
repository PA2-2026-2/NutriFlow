const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const {
  ROLES,
  PUBLIC_ROUTES,
  PROTECTED_ROUTES,
  getAllowedRoles,
} = require('../src/constants/permissions');
const { createUserWithRole, cleanupTestUsers, bearer } = require('./helpers');


const SAMPLE_ID = '00000000-0000-0000-0000-000000000000';
const ALL_ROLES = Object.values(ROLES);

function callRoute(app, routeKey) {
  const [method, route] = routeKey.split(' ');
  return request(app)[method.toLowerCase()](route.replace(':userId', SAMPLE_ID));
}

describe('matriz de permissoes', () => {
  let app;
  const accounts = {};

  beforeAll(async () => {
    app = createApp();

    for (const role of ALL_ROLES) {
      accounts[role] = await createUserWithRole(app, role);
    }
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('deve estar documentada em docs/PERMISSIONS.md (todas as rotas)', () => {
    const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'PERMISSIONS.md'), 'utf8');

    for (const routeKey of [...PUBLIC_ROUTES, ...Object.keys(PROTECTED_ROUTES)]) {
      expect(doc).toContain(`\`${routeKey}\``);
    }
  });

  it('deve falhar ao pedir permissao de rota nao declarada', () => {
    expect(() => getAllowedRoles('GET /api/rota-inexistente')).toThrow();
  });

  it('deve manter as rotas de admin exclusivas do perfil ADMIN', () => {
    const adminRoutes = Object.keys(PROTECTED_ROUTES).filter((key) => key.includes('/api/admin/'));

    expect(adminRoutes.length).toBeGreaterThan(0);

    for (const key of adminRoutes) {
      expect(getAllowedRoles(key)).toEqual([ROLES.ADMIN]);
    }
  });

  describe.each(Object.keys(PROTECTED_ROUTES))('%s', (routeKey) => {
    const allowed = PROTECTED_ROUTES[routeKey];

    it('retorna 401 sem token', async () => {
      const response = await callRoute(app, routeKey);
      expect(response.statusCode).toBe(401);
    });

    it('retorna 401 com token invalido', async () => {
      const response = await callRoute(app, routeKey).set(bearer('token.invalido'));
      expect(response.statusCode).toBe(401);
    });

    for (const role of ALL_ROLES) {
      if (allowed.includes(role)) {
        it(`permite ${role} (nao retorna 401/403)`, async () => {
          const response = await callRoute(app, routeKey).set(bearer(accounts[role].token));

          expect(response.statusCode).not.toBe(401);
          expect(response.statusCode).not.toBe(403);
        });
      } else {
        it(`nega ${role} com 403`, async () => {
          const response = await callRoute(app, routeKey).set(bearer(accounts[role].token));

          expect(response.statusCode).toBe(403);
        });
      }
    }
  });

  describe('rotas publicas', () => {
    it('GET /health responde sem token', async () => {
      const response = await request(app).get('/health');
      expect(response.statusCode).toBe(200);
    });

    it('POST /api/auth/logout responde 200 sem token', async () => {
      const response = await request(app).post('/api/auth/logout');
      expect(response.statusCode).toBe(200);
    });
  });

  describe('sessao', () => {
    it('token revogado pelo logout nao acessa mais rotas protegidas', async () => {
      const account = await createUserWithRole(app, 'PATIENT');

      const before = await request(app).get('/api/users/me').set(bearer(account.token));
      expect(before.statusCode).toBe(200);

      const logout = await request(app).post('/api/auth/logout').set(bearer(account.token));
      expect(logout.statusCode).toBe(200);

      const after = await request(app).get('/api/users/me').set(bearer(account.token));
      expect(after.statusCode).toBe(401);
    });

    it('a autorizacao usa o perfil atual do banco, nao o gravado no token', async () => {
      const account = await createUserWithRole(app, 'ADMIN');

      const asAdmin = await request(app).get('/api/admin/users').set(bearer(account.token));
      expect(asAdmin.statusCode).toBe(200);

      await app.locals.prisma.user.update({
        where: { id: account.user.id },
        data: { profile: ROLES.PATIENT },
      });

      const demoted = await request(app).get('/api/admin/users').set(bearer(account.token));
      expect(demoted.statusCode).toBe(403);
    });
  });
});
