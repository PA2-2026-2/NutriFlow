class AppointmentRepository {
	constructor(prisma) {
		this.prisma = prisma;
	}

	findOverlapping({ patientId, nutritionistId, startAt, endAt, excludeId }) {
		const where = {
			status: { not: 'CANCELADA' },
			startAt: { lt: endAt },
			endAt: { gt: startAt },
			...(excludeId ? { id: { not: excludeId } } : {}),
		};

		return Promise.all([
			this.prisma.appointment.findFirst({
				where: { ...where, patientId },
				select: { id: true },
			}),
			this.prisma.appointment.findFirst({
				where: { ...where, nutritionistId },
				select: { id: true },
			}),
		]);
	}

	create(data) {
		return this.prisma.appointment.create({ data });
	}

	listForPatient(patientId, filters) {
		return this.prisma.appointment.findMany({
			where: { patientId, ...filters },
			orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
		});
	}

	listForNutritionist(nutritionistId, filters) {
		return this.prisma.appointment.findMany({
			where: { nutritionistId, ...filters },
			orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
		});
	}

	findByIdAndNutritionistId(id, nutritionistId) {
		return this.prisma.appointment.findFirst({
			where: { id, nutritionistId },
		});
	}

	update(id, data) {
		return this.prisma.appointment.update({
			where: { id },
			data,
		});
	}
}

module.exports = { AppointmentRepository };
