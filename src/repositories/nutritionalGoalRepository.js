class NutritionalGoalRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listForNutritionist(nutritionistId, { patientId, category } = {}) {
    return this.prisma.nutritionalGoal.findMany({
      where: {
        nutritionistId,
        ...(patientId ? { patientId } : {}),
        ...(category ? { category } : {}),
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        progressEntries: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  listForPatient(patientId) {
    return this.prisma.nutritionalGoal.findMany({
      where: { patientId },
      include: {
        nutritionist: { select: { id: true, name: true } },
        progressEntries: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  findForNutritionist(id, nutritionistId) {
    return this.prisma.nutritionalGoal.findFirst({
      where: { id, nutritionistId },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        progressEntries: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  findForPatient(id, patientId) {
    return this.prisma.nutritionalGoal.findFirst({
      where: { id, patientId },
      include: {
        nutritionist: { select: { id: true, name: true } },
        progressEntries: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  create(data) {
    return this.prisma.nutritionalGoal.create({
      data,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        progressEntries: {
          include: { recordedBy: { select: { id: true, name: true } } },
        },
      },
    });
  }

  update(id, data) {
    return this.prisma.nutritionalGoal.update({
      where: { id },
      data,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        progressEntries: {
          include: { recordedBy: { select: { id: true, name: true } } },
          orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }

  createProgressAndComplete(goalId, data, complete) {
    return this.prisma.$transaction(async (transaction) => {
      const activeGoal = await transaction.nutritionalGoal.updateMany({
        where: { id: goalId, status: 'ACTIVE' },
        data: {
          status: complete ? 'COMPLETED' : 'ACTIVE',
          updatedAt: data.recordedAt,
        },
      });
      if (activeGoal.count !== 1) return null;

      const latestProgress = await transaction.nutritionalGoalProgress.findFirst({
        where: { goalId },
        orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
        select: { recordedAt: true },
      });
      const recordedAt = latestProgress
        ? new Date(Math.max(data.recordedAt.getTime(), latestProgress.recordedAt.getTime() + 1))
        : data.recordedAt;
      const progress = await transaction.nutritionalGoalProgress.create({
        data: { goalId, ...data, recordedAt },
        include: { recordedBy: { select: { id: true, name: true } } },
      });
      return progress;
    });
  }
}

module.exports = { NutritionalGoalRepository };
