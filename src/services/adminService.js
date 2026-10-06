const { AppError } = require('../errors/appError');
const { normalizeRole, toRoleLabel } = require('../constants/roles');
const { isValidEmail, normalizePhone } = require('../utils/validators');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function normalizeText(value) {
	return String(value || '').trim();
}

function foodIdFromName(name) {
	const base = name
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
	const uniqueSuffix = require('crypto').randomBytes(4).toString('hex');
	return `${base || 'alimento'}-${uniqueSuffix}`;
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

	async getSummary() {
		const [groups, foodMetrics] = await Promise.all([
			this.adminRepository.getUserSummary(),
			this.adminRepository.getFoodMetrics(),
		]);
		const summary = {
			total_users: 0,
			total_patients: 0,
			total_nutritionists: 0,
			total_admins: 0,
			active_users: 0,
			blocked_users: 0,
			total_foods: foodMetrics.totalFoods,
			food_logs_today: foodMetrics.foodLogsToday,
			active_meal_plans: foodMetrics.activeMealPlans,
			average_food_calories: foodMetrics.averageFoodCalories,
			food_catalog_available: true,
			food_logs_available: true,
			meal_plans_available: true,
		};

		for (const group of groups) {
			const count = group._count._all;
			summary.total_users += count;

			if (group.isActive) {
				summary.active_users += count;
			} else {
				summary.blocked_users += count;
			}

			if (group.profile === 'PATIENT') {
				summary.total_patients += count;
			} else if (group.profile === 'NUTRITIONIST') {
				summary.total_nutritionists += count;
			} else if (group.profile === 'ADMIN') {
				summary.total_admins += count;
			}
		}

		return { summary };
	}

	async listFoods() {
		const foods = await this.adminRepository.listFoods();
		return { foods };
	}

	async createFood(payload) {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			throw new AppError('Informe os dados do alimento.', 400);
		}
		const name = normalizeText(payload.name);
		if (name.length < 2 || name.length > 100) {
			throw new AppError('O nome do alimento deve ter de 2 a 100 caracteres.', 400);
		}

		const nutrientValues = {};
		for (const field of ['calories', 'protein', 'carbs', 'fat']) {
			const value = payload[field];
			const max = field === 'calories' ? null : 100;
			if (
				typeof value !== 'number' ||
				!Number.isFinite(value) ||
				value < 0 ||
				(max !== null && value > max)
			) {
				throw new AppError(
					field === 'calories'
						? 'calories deve ser um numero maior ou igual a 0 por 100g.'
						: `${field} deve ser um numero entre 0 e ${max} por 100g.`,
					400,
				);
			}
			nutrientValues[field] = value;
		}

		const existingFood = await this.adminRepository.findFoodByName(name);
		if (existingFood?.isAvailable) {
			throw new AppError('Ja existe um alimento ativo com esse nome.', 409);
		}
		if (existingFood) {
			const food = await this.adminRepository.restoreFood(existingFood.id, {
				name,
				...nutrientValues,
			});
			return {
				message: 'Alimento reativado no catalogo com sucesso.',
				food,
			};
		}

		try {
			const food = await this.adminRepository.createFood({
				id: foodIdFromName(name),
				name,
				...nutrientValues,
			});
			return { message: 'Alimento cadastrado com sucesso.', food };
		} catch (error) {
			if (error.code === 'P2002') {
				throw new AppError('Ja existe um alimento com esse nome ou identificador.', 409);
			}
			throw error;
		}
	}

	async deleteFood(foodId) {
		const result = await this.adminRepository.deleteFood(foodId);
		if (!result) {
			throw new AppError('Alimento nao encontrado.', 404);
		}
		return {
			message: 'Alimento removido do catalogo e dos planos alimentares.',
			food: result.deletedFood,
			affectedPlanCount: result.affectedPlanCount,
			deletedPlanCount: result.deletedPlanCount,
		};
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
