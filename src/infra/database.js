const fs = require('fs');
const path = require('path');

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error('A URL do banco não é SQLite.');
  }

  const filePath = databaseUrl.slice(5);

  if (/^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('/')) {
    return filePath;
  }

  return path.resolve(process.cwd(), 'prisma', filePath);
}

function ensureDatabaseDirectory(databaseUrl) {
  const databasePath = resolveSqlitePath(databaseUrl);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
}

function createPrismaClient(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL não está configurada.');
  }

  const isSqlite = databaseUrl.startsWith('file:');

  if (isSqlite) {
    ensureDatabaseDirectory(databaseUrl);
  } else if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
    throw new Error('DATABASE_URL deve usar SQLite ou PostgreSQL.');
  }

  const { PrismaClient } = isSqlite
    ? require('../../prisma/generated/sqlite')
    : require('@prisma/client');

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

module.exports = {
  createPrismaClient,
  resolveSqlitePath,
};
