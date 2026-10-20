const fs = require('fs');
const { resolveSqlitePath } = require('../src/infra/database');

const modelNames = [
  'user',
  'food',
  'patientProfile',
  'patientMeasurement',
  'mealPlan',
  'mealPlanItem',
  'patientMealEntry',
  'patientWeightEntry',
  'chatMessage',
];
const execute = process.argv.includes('--execute');

function getClients() {
  const sourceUrl = process.env.SOURCE_DATABASE_URL || '';
  const targetUrl = process.env.DATABASE_URL || '';

  if (!sourceUrl.startsWith('file:')) {
    throw new Error('SOURCE_DATABASE_URL deve apontar para o banco SQLite de origem.');
  }

  if (!/^postgres(?:ql)?:\/\//i.test(targetUrl)) {
    throw new Error('DATABASE_URL deve apontar para o PostgreSQL de destino.');
  }

  const sourcePath = resolveSqlitePath(sourceUrl);

  if (!fs.existsSync(sourcePath)) {
    throw new Error('O arquivo SQLite de origem não existe.');
  }

  const { PrismaClient: SqlitePrismaClient } = require('../prisma/generated/sqlite');
  const { PrismaClient: PostgresPrismaClient } = require('@prisma/client');

  return {
    source: new SqlitePrismaClient({ datasources: { db: { url: sourceUrl } } }),
    target: new PostgresPrismaClient({ datasources: { db: { url: targetUrl } } }),
  };
}

async function readSourceRows(source) {
  const rowsByModel = {};
  const counts = {};

  for (const modelName of modelNames) {
    const model = source[modelName];
    const rows = await model.findMany();
    const count = await model.count();

    if (rows.length !== count) {
      throw new Error(`A leitura da tabela ${modelName} retornou contagens inconsistentes.`);
    }

    rowsByModel[modelName] = rows;
    counts[modelName] = count;
  }

  return { rowsByModel, counts };
}

async function verifyEmptyTarget(target) {
  const counts = {};

  for (const modelName of modelNames) {
    counts[modelName] = await target[modelName].count();
  }

  if (Object.values(counts).some((count) => count !== 0)) {
    throw new Error('O banco PostgreSQL de destino não está vazio; nenhuma linha foi alterada.');
  }
}

async function insertInBatches(model, rows) {
  for (let offset = 0; offset < rows.length; offset += 500) {
    await model.createMany({
      data: rows.slice(offset, offset + 500),
    });
  }
}

async function migrate() {
  const { source, target } = getClients();

  try {
    await source.$connect();
    await target.$connect();

    const { rowsByModel, counts } = await readSourceRows(source);
    await verifyEmptyTarget(target);

    console.log(`Linhas de origem verificadas por tabela: ${JSON.stringify(counts)}`);

    if (!execute) {
      console.log('Simulação concluída; use --execute após preparar e autorizar o destino vazio.');
      return;
    }

    await target.$transaction(async (transaction) => {
      for (const modelName of modelNames) {
        await insertInBatches(transaction[modelName], rowsByModel[modelName]);
      }

      for (const modelName of modelNames) {
        const actual = await transaction[modelName].count();

        if (actual !== counts[modelName]) {
          throw new Error(`A validação da tabela ${modelName} não corresponde à origem.`);
        }
      }
    }, {
      maxWait: 10000,
      timeout: 120000,
    });

    console.log('Migração concluída; as contagens de todas as tabelas foram verificadas.');
  } finally {
    await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
  }
}

migrate().catch((error) => {
  const code = error.code || error.name || 'UnknownError';
  console.error(`Migração interrompida (${code}). Nenhum detalhe de conexão ou dado pessoal foi exibido.`);
  process.exitCode = 1;
});
