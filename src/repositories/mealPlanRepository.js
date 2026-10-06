class MealPlanRepository {
	constructor(prisma) {
		this.prisma = prisma;
	}

	async listFoods() {
		const { DEFAULT_FOODS } = require('../data/foodCatalog');
		await Promise.all(DEFAULT_FOODS.map((food) => this.prisma.food.upsert({
			where: { id: food.id },
			create: food,
			update: {},
		})));

		return this.prisma.food.findMany({ orderBy: { name: 'asc' } });
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
