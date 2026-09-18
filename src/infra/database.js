const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl.startsWith('file:')) {
    throw new Error('DATABASE_URL invalida. Use o formato file:./caminho/do/banco.db');
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
  ensureDatabaseDirectory(databaseUrl);

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
