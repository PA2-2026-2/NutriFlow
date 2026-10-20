const { DEFAULT_FOODS } = require('../data/foodCatalog');

const initializationByPrismaClient = new WeakMap();

function ensureDefaultFoods(prisma) {
	let initialization = initializationByPrismaClient.get(prisma);

	if (!initialization) {
		initialization = Promise.all(DEFAULT_FOODS.map((food) => prisma.food.upsert({
			where: { id: food.id },
			create: food,
			update: {},
		}))).catch((error) => {
			initializationByPrismaClient.delete(prisma);
			throw error;
		});
		initializationByPrismaClient.set(prisma, initialization);
	}

	return initialization;
}

module.exports = { ensureDefaultFoods };
