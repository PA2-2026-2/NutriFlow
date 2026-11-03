class NutritionistApprovalRepository {
	constructor(prisma) {
		this.prisma = prisma;
	}

	findByUserId(userId) {
		return this.prisma.nutritionistApprovalRequest.findUnique({
			where: { userId },
		});
	}

	upsertPending(userId) {
		return this.prisma.nutritionistApprovalRequest.upsert({
			where: { userId },
			create: { userId, status: 'PENDING' },
			update: {},
		});
	}

	listPending() {
		return this.prisma.nutritionistApprovalRequest.findMany({
			where: { status: 'PENDING' },
			include: {
				user: {
					select: { id: true, name: true, email: true, createdAt: true },
				},
			},
			orderBy: { createdAt: 'asc' },
		});
	}

	findById(id) {
		return this.prisma.nutritionistApprovalRequest.findUnique({
			where: { id },
			include: {
				user: {
					select: { id: true, name: true, email: true, createdAt: true },
				},
			},
		});
	}

	updatePending(id, data) {
		return this.prisma.nutritionistApprovalRequest.updateMany({
			where: { id, status: 'PENDING' },
			data,
		});
	}
}

module.exports = { NutritionistApprovalRepository };
