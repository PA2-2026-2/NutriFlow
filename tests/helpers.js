const request = require('supertest');
const { PasswordService } = require('../src/services/passwordService');

const PASSWORD = 'senha1234';
const TEST_EMAIL_DOMAIN = '@sprint2.nutriflow.test';

let counter = 0;

function uniqueEmail(label = 'user') {
  counter += 1;
  return `${label}-${Date.now()}-${counter}${TEST_EMAIL_DOMAIN}`;
}


async function createUserWithRole(app, role, overrides = {}) {
  const prisma = app.locals.prisma;
  const email = overrides.email || uniqueEmail(role.toLowerCase());

  const user = await prisma.user.create({
    data: {
      name: overrides.name || `Teste ${role}`,
      email,
      profile: role,
      passwordHash: new PasswordService().hash(PASSWORD),
      ...(overrides.data || {}),
    },
  });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD });

  if (!login.body.token) {
    throw new Error(JSON.stringify(login.body));
  }

  return { user, email, token: login.body.token };
}


async function cleanupTestUsers(app) {
  await app.locals.prisma.user.deleteMany({
    where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
  });
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = {
  PASSWORD,
  TEST_EMAIL_DOMAIN,
  uniqueEmail,
  createUserWithRole,
  cleanupTestUsers,
  bearer,
};
