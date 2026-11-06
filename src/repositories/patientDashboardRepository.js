const { ensureDefaultFoods } = require('../infra/foodCatalog');

class PatientDashboardRepository {
	constructor(prisma) {
		this.prisma = prisma;
	}

	findDashboardData(userId) {
		return this.prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				name: true,
				email: true,
				profile: true,
				patientProfile: {
					select: {
						age: true,
						weight: true,
						height: true,
						objective: true,
						restrictions: true,
						nutritionistId: true,
						nutritionist: {
							select: { id: true, name: true, email: true },
						},
						measurements: {
							orderBy: { recordedAt: 'asc' },
							select: {
								id: true,
								recordedAt: true,
								weightKg: true,
								heightCm: true,
								bodyFatPercent: true,
								notes: true,
								neckCircumferenceCm: true,
								chestCircumferenceCm: true,
								waistCircumferenceCm: true,
								hipCircumferenceCm: true,
								armCircumferenceCm: true,
								thighCircumferenceCm: true,
								calfCircumferenceCm: true,
								tricepsSkinfoldMm: true,
								bicepsSkinfoldMm: true,
								subscapularSkinfoldMm: true,
								suprailiacSkinfoldMm: true,
								abdominalSkinfoldMm: true,
								thighSkinfoldMm: true,
								calfSkinfoldMm: true,
							},
						},
					},
				},
				mealEntries: {
					orderBy: { loggedAt: 'desc' },
					take: 90,
					select: {
						id: true,
						loggedAt: true,
						mealType: true,
						title: true,
						description: true,
						calories: true,
						protein: true,
						carbs: true,
						fats: true,
						fiber: true,
						waterMl: true,
					},
				},
				weightEntries: {
					orderBy: { recordedAt: 'asc' },
					select: { weightKg: true, recordedAt: true, note: true },
				},
				mealPlansAsPatient: {
					where: { endDate: { gte: new Date() } },
					select: {
						title: true,
						notes: true,
						calories: true,
						protein: true,
						carbs: true,
						fats: true,
						items: {
							select: {
								quantity: true,
								mealTime: true,
								food: { select: { name: true } },
							},
						},
					},
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