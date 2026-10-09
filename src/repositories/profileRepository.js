class ProfileRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findPatientByUserId(userId) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
    });
  }

  createMeasurement(patientProfileId, data) {
    return this.prisma.patientMeasurement.create({
      data: {
        patientProfileId,
        ...data,
      },
    });
  }

  findMeasurementByIdAndPatientProfileId(id, patientProfileId) {
    return this.prisma.patientMeasurement.findFirst({
      where: { id, patientProfileId },
    });
  }

  updateMeasurement(patientProfileId, id, data) {
    return this.prisma.patientMeasurement.update({
      where: { id, patientProfileId },
      data,
    });
  }

  deleteMeasurement(patientProfileId, id) {
    return this.prisma.patientMeasurement.deleteMany({
      where: { id, patientProfileId },
    }).then(({ count }) => count);
  }

  findMeasurementsByPatientProfileId(patientProfileId) {
    return this.prisma.patientMeasurement.findMany({
      where: { patientProfileId },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    });
  }

  findPatientWithNutritionistByUserId(userId) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
      include: {
        nutritionist: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  findPatientsByNutritionistId(nutritionistId) {
    return this.prisma.patientProfile.findMany({
      where: { nutritionistId },
      include: {
        user: true,
        measurements: {
          orderBy: { recordedAt: 'desc' },
        },
      },
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

  linkNutritionist(userId, nutritionistId, profileData = {}) {
    return this.prisma.patientProfile.upsert({
      where: { userId },
      update: {
        nutritionistId,
        ...profileData,
      },
      create: {
        userId,
        nutritionistId,
        ...profileData,
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