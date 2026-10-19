const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const databaseFilename = `test-${process.pid}-${crypto.randomUUID()}.db`;
const databasePath = path.join(root, 'prisma', databaseFilename);
const databaseUrl = `file:./${databaseFilename}`;
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: databaseUrl,
};
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const jestCli = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');

function runNode(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    return false;
  }

  return true;
}

try {
  if (!runNode(prismaCli, [
    'db',
    'push',
    '--schema=prisma/schema.sqlite.prisma',
    '--skip-generate',
  ])) {
    process.exitCode = process.exitCode || 1;
  } else {
    runNode(jestCli, [
      '--runInBand',
      '--setupFilesAfterEnv=./tests/cleanup.js',
      ...process.argv.slice(2),
    ]);
  }
} catch (error) {
  console.error(`Não foi possível executar os testes (${error.code || error.name}).`);
  process.exitCode = 1;
} finally {
  for (const suffix of ['', '-journal', '-shm', '-wal']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
}
