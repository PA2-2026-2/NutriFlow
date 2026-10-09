const { ensureDefaultFoods } = require('../infra/foodCatalog');

class MealPlanRepository {
	constructor(prisma) {
		this.prisma = prisma;
	}

	async listFoods() {
		await ensureDefaultFoods(this.prisma);

		return this.prisma.food.findMany({
			where: { isAvailable: true },
			orderBy: { name: 'asc' },
		});
	}

	listForNutritionist(nutritionistId) {
		return this.prisma.mealPlan.findMany({
			where: { nutritionistId },
			include: {
				patient: { select: { id: true, name: true } },
				items: { include: { food: true } },
			},
			orderBy: { createdAt: 'desc' },
		});
	}

	create(nutritionistId, data) {
		return this.prisma.mealPlan.create({
			data: {
				...data,
				nutritionistId,
			},
			include: {
				patient: { select: { id: true, name: true } },
				items: { include: { food: true } },
			},
		});
	}
}

module.exports = { MealPlanRepository };
