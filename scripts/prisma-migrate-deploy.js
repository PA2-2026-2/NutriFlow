const path = require('path');
const { spawn } = require('child_process');

const root = path.join(__dirname, '..');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');
const retryDelaysMs = [2000, 4000, 6000, 8000];

function runMigration() {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [
			prismaCli,
			'migrate',
			'deploy',
			'--schema=prisma/schema.prisma',
		], {
			cwd: root,
			env: process.env,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';

		child.stdout.on('data', (chunk) => {
			stdout += chunk;
			process.stdout.write(chunk);
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
			process.stderr.write(chunk);
		});
		child.on('error', (error) => {
			resolve({ status: 1, stdout, stderr: `${stderr}${error.message}` });
		});
		child.on('close', (status) => {
			resolve({ status: status ?? 1, stdout, stderr });
		});
	});
}

function isAdvisoryLockTimeout(result) {
	const output = `${result.stdout}\n${result.stderr}`;
	return result.status !== 0
		&& /P1002/.test(output)
		&& /advisory lock/i.test(output);
}

function wait(milliseconds) {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function deployMigrations(run = runMigration, sleep = wait) {
	for (let attempt = 0; ; attempt += 1) {
		const result = await run();
		if (result.status === 0 || !isAdvisoryLockTimeout(result)) {
			return result.status;
		}

		const delay = retryDelaysMs[attempt];
		if (delay === undefined) return result.status;

		console.warn(
			`Prisma migrate deploy timed out acquiring the database advisory lock. `
			+ `Retrying in ${delay / 1000}s (${attempt + 1}/${retryDelaysMs.length}).`,
		);
		await sleep(delay);
	}
}

if (require.main === module) {
	deployMigrations().then((status) => {
		process.exitCode = status;
	}).catch((error) => {
		console.error(`Prisma migrate deploy could not run (${error.code || error.name}).`);
		process.exitCode = 1;
	});
}

module.exports = { deployMigrations };
