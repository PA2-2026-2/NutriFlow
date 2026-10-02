class ProfileRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findPatientByUserId(userId) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
    });
  }

  findPatientsByNutritionistId(nutritionistId) {
    return this.prisma.patientProfile.findMany({
      where: { nutritionistId },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createPatientProfile(data) {
    return this.prisma.patientProfile.create({
      data,
    });
  }

  updatePatientProfile(userId, data) {
    return this.prisma.patientProfile.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        ...data,
      },
    });
  }
}

module.exports = {
  ProfileRepository,
};