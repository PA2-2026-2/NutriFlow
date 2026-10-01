






require('dotenv/config');

const { createPrismaClient } = require('../src/infra/database');
const { PasswordService } = require('../src/services/passwordService');
const { config } = require('../src/config');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const name = String(process.env.ADMIN_NAME || 'Administrador').trim();

  if (!email || password.length < 8) {
    throw new Error(
      'Defina ADMIN_EMAIL e ADMIN_PASSWORD (minimo 8 caracteres) para criar o administrador.',
    );
  }

  const prisma = createPrismaClient(config.databaseUrl);

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      console.log(`Ja existe um usuario com o e-mail ${email} (perfil ${existing.profile}). Nada foi alterado.`);
      return;
    }

    await prisma.user.create({
      data: {
        name,
        email,
        profile: 'ADMIN',
        passwordHash: new PasswordService().hash(password),
      },
    });

    console.log(`Administrador criado: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
