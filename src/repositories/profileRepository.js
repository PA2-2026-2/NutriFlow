class ProfileRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findPatientByUserId(userId) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
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

  linkNutritionist(userId, nutritionistId) {
    return this.prisma.patientProfile.upsert({
      where: { userId },
      update: {
        nutritionistId,
      },
      create: {
        userId,
        nutritionistId,
      },
      include: {
        nutritionist: true,
      },
    });
  }
}

module.exports = {
  ProfileRepository,
};