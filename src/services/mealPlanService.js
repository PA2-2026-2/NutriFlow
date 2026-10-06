const { AppError } = require('../errors/appError');

const MEAL_TIMES = new Set([
	'Cafe da manha',
	'Lanche da manha',
	'Almoco',
	'Lanche da tarde',
	'Jantar',
	'Ceia',
]);

function presentMealPlan(plan) {
	return {
		id: plan.id,
		patientId: plan.patientId,
		patient: plan.patient.name,
		title: plan.title,
		notes: plan.notes || '',
		calories: Math.round(plan.calories),
		protein: Math.round(plan.protein),
		carbs: Math.round(plan.carbs),
		fats: Math.round(plan.fats),
		startDate: plan.startDate,
		endDate: plan.endDate,
		items: plan.items.map((item) => ({
			id: item.id,
			foodId: item.foodId,
			foodName: item.food.name,
			quantity: item.quantity,
			mealTime: item.mealTime,
		})),
	};
}

class MealPlanService {
	constructor(repository, profileRepository) {
		this.repository = repository;
		this.profileRepository = profileRepository;
	}

	listFoods() {
		return this.repository.listFoods();
	}

	async listForNutritionist(nutritionistId) {
		const plans = await this.repository.listForNutritionist(nutritionistId);
		return { mealPlans: plans.map(presentMealPlan) };
	}

	async create(nutritionistId, payload) {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			throw new AppError('Informe os dados do plano alimentar.', 400);
		}

		const patientId = String(payload.patientId || '').trim();
		if (!patientId) {
			throw new AppError('Selecione um paciente para o plano.', 400);
		}

		const profile = await this.profileRepository.findPatientByUserId(patientId);
		if (!profile) {
			throw new AppError('Paciente nao encontrado.', 404);
		}
		if (profile.nutritionistId !== nutritionistId) {
			throw new AppError('Este paciente nao esta vinculado ao nutricionista.', 403);
		}

		const title = typeof payload.title === 'string' ? payload.title.trim() : '';
		if (!title || title.length > 120) {
			throw new AppError('Informe um titulo de ate 120 caracteres.', 400);
		}

		if (!Array.isArray(payload.items) || payload.items.length === 0) {
			throw new AppError('Adicione pelo menos um alimento ao plano.', 400);
		}

		if (payload.items.length > 100) {
			throw new AppError('O plano nao pode ter mais de 100 itens.', 400);
		}

		const foods = await this.repository.listFoods();
		const foodsById = new Map(foods.map((food) => [food.id, food]));
		const items = payload.items.map((item) => {
			if (!item || typeof item !== 'object' || Array.isArray(item)) {
				throw new AppError('Item de alimento invalido.', 400);
			}
			const food = foodsById.get(item.foodId);
			if (!food) {
				throw new AppError('Alimento nao encontrado na base.', 400);
			}
			if (
				typeof item.quantity !== 'number' ||
				!Number.isFinite(item.quantity) ||
				item.quantity < 1 ||
				item.quantity > 2000
			) {
				throw new AppError('A quantidade deve estar entre 1 e 2000 gramas.', 400);
			}
			if (!MEAL_TIMES.has(item.mealTime)) {
				throw new AppError('Selecione um horario de refeicao valido.', 400);
			}

			return { food, quantity: item.quantity, mealTime: item.mealTime };
		});

		const totals = items.reduce((result, item) => {
			const factor = item.quantity / 100;
			result.calories += item.food.calories * factor;
			result.protein += item.food.protein * factor;
			result.carbs += item.food.carbs * factor;
			result.fats += item.food.fat * factor;
			return result;
		}, { calories: 0, protein: 0, carbs: 0, fats: 0 });

		const now = new Date();
		const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
		if (notes.length > 2000) {
			throw new AppError('As observacoes nao podem exceder 2000 caracteres.', 400);
		}

		const plan = await this.repository.create(nutritionistId, {
			patientId,
			title,
			notes: notes || null,
			...totals,
			startDate: now,
			endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
			items: {
				create: items.map(({ food, quantity, mealTime }) => ({
					foodId: food.id,
					quantity,
					mealTime,
				})),
			},
		});

		return { mealPlan: presentMealPlan(plan) };
	}
}

module.exports = { MealPlanService };
