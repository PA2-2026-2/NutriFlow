const { AppError } = require('../errors/appError');
const { normalizeRole, toRoleLabel } = require('../constants/roles');
const { isValidEmail, normalizePhone } = require('../utils/validators');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function normalizeText(value) {
	return String(value || '').trim();
}

function formatDate(date) {
	const instance = new Date(date);

	if (Number.isNaN(instance.getTime())) {
		return '';
	}

	return new Intl.DateTimeFormat('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(instance);
}

function toManagedUser(user) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: normalizeRole(user.profile),
		profile: toRoleLabel(user.profile),
		isActive: user.isActive,
		phone: user.phone || null,
		profilePhotoUrl: user.profilePhotoUrl || null,
		createdAt: formatDate(user.createdAt),
	};
}

class AdminService {
	constructor(adminRepository, photoStorage) {
		this.adminRepository = adminRepository;
		this.photoStorage = photoStorage;
	}

	
	
	async getUsers(filters = {}) {
		const hasRoleFilter = String(filters.role ?? '').trim() !== '';
		const role = hasRoleFilter ? normalizeRole(filters.role) : '';

		if (hasRoleFilter && !role) {
			throw new AppError(
				'Perfil invalido. Use PATIENT, NUTRITIONIST ou ADMIN.',
				400,
			);
		}

		const users = await this.adminRepository.findUsers({
			search: filters.search,
			role,
		});

		return { users: users.map(toManagedUser) };
	}

	
	async updateUser(userId, payload) {
		const name = normalizeText(payload.name);
		const email = normalizeEmail(payload.email);

		if (!name || !email) {
			throw new AppError('Informe nome e e-mail.', 400);
		}

		if (!isValidEmail(email)) {
			throw new AppError('Informe um e-mail valido.', 400);
		}

		const data = { name, email };

		if (payload.phone !== undefined) {
			const phone = normalizePhone(payload.phone);

			if (!phone.valid) {
				throw new AppError(
					'Telefone invalido. Informe DDD + numero (10 a 13 digitos).',
					400,
				);
			}

			data.phone = phone.value;
		}

		const user = await this.adminRepository.findUserById(userId);

		if (!user) {
			throw new AppError('Usuario nao encontrado.', 404);
		}

		if (email !== user.email) {
			const existing = await this.adminRepository.findUserByEmail(email);

			if (existing) {
				throw new AppError('Ja existe uma conta com este e-mail.', 409);
			}
		}

		const updated = await this.adminRepository.updateUser(userId, data);

		return {
			message: 'Usuario atualizado com sucesso.',
			user: toManagedUser(updated),
		};
	}

	
	
	async updateUserStatus(userId, payload, currentAdminId) {
		if (typeof payload.isActive !== 'boolean') {
			throw new AppError('Informe isActive como verdadeiro ou falso.', 400);
		}

		const user = await this.adminRepository.findUserById(userId);

		if (!user) {
			throw new AppError('Usuario nao encontrado.', 404);
		}

		if (user.id === currentAdminId && !payload.isActive) {
			throw new AppError(
				'O administrador logado nao pode bloquear a propria conta.',
				400,
			);
		}

		const updated = await this.adminRepository.updateUserStatus(
			userId,
			payload.isActive,
		);

		return {
			message: payload.isActive
				? 'Usuario reativado com sucesso.'
				: 'Usuario bloqueado com sucesso.',
			user: toManagedUser(updated),
		};
	}

	async deleteUser(userId, currentAdminId) {
		const user = await this.adminRepository.findUserById(userId);

		if (!user) {
			throw new AppError('Usuario nao encontrado.', 404);
		}

		if (user.id === currentAdminId) {
			throw new AppError(
				'O administrador logado nao pode remover a propria conta.',
				400,
			);
		}

		await this.adminRepository.deleteUser(userId);

		
		if (this.photoStorage) {
			await this.photoStorage.remove(user.profilePhotoUrl).catch(() => {});
		}

		return { message: 'Usuario removido com sucesso.' };
	}
}

module.exports = {
	AdminService,
};
