






require('dotenv/config');

const { createPrismaClient } = require('../src/infra/database');
const { config } = require('../src/config');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const id = String(process.env.ADMIN_USER_ID || '').trim();
  const name = String(process.env.ADMIN_NAME || 'Administrador').trim();

  if (!email || !id) {
    throw new Error(
      'Defina ADMIN_EMAIL e ADMIN_USER_ID de uma conta já criada e confirmada no Supabase Auth.',
    );
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('ADMIN_USER_ID deve ser o UUID da conta Supabase.');
  }

  const prisma = createPrismaClient(config.databaseUrl);

  try {
    const [existingId, existingEmail] = await Promise.all([
      prisma.user.findUnique({ where: { id } }),
      prisma.user.findUnique({ where: { email } }),
    ]);

    if (existingId || existingEmail) {
      if (
        existingId?.id === id &&
        existingId.email === email &&
        existingId.profile === 'ADMIN'
      ) {
        console.log('O perfil administrador já está associado à conta Supabase. Nada foi alterado.');
        return;
      }

      throw new Error(
        'Já existe um perfil com esse UUID ou e-mail, mas ele não corresponde à conta ADMIN solicitada. Nenhum dado foi alterado.',
      );
    }

    await prisma.user.create({
      data: {
        id,
        name,
        email,
        profile: 'ADMIN',
        passwordHash: '',
      },
    });

    console.log(`Perfil administrador associado ao usuário Supabase ${id}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
