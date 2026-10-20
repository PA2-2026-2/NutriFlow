const { ensureDefaultFoods } = require('../infra/foodCatalog');

class PatientDashboardRepository {
	constructor(prisma) {
		this.prisma = prisma;
	}

	findDashboardData(userId) {
		return this.prisma.user.findUnique({
			where: { id: userId },
			include: {
				patientProfile: {
					include: {
						nutritionist: {
							select: { id: true, name: true, email: true },
						},
						measurements: { orderBy: { recordedAt: 'asc' } },
					},
				},
				mealEntries: { orderBy: { loggedAt: 'desc' }, take: 90 },
				weightEntries: { orderBy: { recordedAt: 'asc' } },
				mealPlansAsPatient: {
					where: { endDate: { gte: new Date() } },
					include: { items: { include: { food: true } } },
					orderBy: { createdAt: 'desc' },
				},
			},
		});
	}

	findPatientProfile(userId) {
		return this.prisma.patientProfile.findUnique({ where: { userId } });
	}

	createMealEntry(userId, data) {
		return this.prisma.patientMealEntry.create({
			data: { userId, ...data },
		});
	}

	createWeightEntry(userId, data) {
		return this.prisma.patientWeightEntry.create({
			data: { userId, ...data },
		});
	}

	async listFoods() {
		await ensureDefaultFoods(this.prisma);
		return this.prisma.food.findMany({
			where: { isAvailable: true },
			orderBy: { name: 'asc' },
		});
	}
}

module.exports = { PatientDashboardRepository };