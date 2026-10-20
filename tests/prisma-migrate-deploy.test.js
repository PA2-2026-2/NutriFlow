const { deployMigrations } = require('../scripts/prisma-migrate-deploy');

describe('deploy de migrations Prisma', () => {
	it('repete após timeout do advisory lock e termina quando o lock é liberado', async () => {
		const run = jest.fn()
			.mockResolvedValueOnce({
				status: 1,
				stderr: 'Error: P1002 Timed out trying to acquire a postgres advisory lock',
			})
			.mockResolvedValueOnce({
				status: 1,
				stderr: 'Error: P1002 Timed out trying to acquire a postgres advisory lock',
			})
			.mockResolvedValueOnce({ status: 0, stdout: 'All migrations have been applied.' });
		const sleep = jest.fn().mockResolvedValue(undefined);

		await expect(deployMigrations(run, sleep)).resolves.toBe(0);

		expect(run).toHaveBeenCalledTimes(3);
		expect(sleep.mock.calls).toEqual([[2000], [4000]]);
	});

	it('não repete erros que não sejam timeout do advisory lock', async () => {
		const run = jest.fn().mockResolvedValue({
			status: 1,
			stderr: 'Error: P3009 migration failed',
		});
		const sleep = jest.fn();

		await expect(deployMigrations(run, sleep)).resolves.toBe(1);

		expect(run).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it('retorna erro após esgotar os retries para timeout do advisory lock', async () => {
		const run = jest.fn().mockResolvedValue({
			status: 1,
			stderr: 'Error: P1002 Timed out trying to acquire a postgres advisory lock',
		});
		const sleep = jest.fn().mockResolvedValue(undefined);

		await expect(deployMigrations(run, sleep)).resolves.toBe(1);

		expect(run).toHaveBeenCalledTimes(5);
		expect(sleep).toHaveBeenCalledTimes(4);
	});
});
