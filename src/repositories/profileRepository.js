class ProfileRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findPatientByUserId(userId) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
    });
  }

  findPatientWithUserByUserId(userId) {
    return this.prisma.patientProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, profile: true },
        },
      },
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
    return this.prisma.patientMeasurement.updateMany({
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
      select: {
        id: true,
        recordedAt: true,
        notes: true,
        weightKg: true,
        heightCm: true,
        bodyFatPercent: true,
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
      select: {
        age: true,
        weight: true,
        height: true,
        objective: true,
        restrictions: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        measurements: {
          orderBy: { recordedAt: 'desc' },
          select: {
            id: true,
            recordedAt: true,
            notes: true,
            weightKg: true,
            heightCm: true,
            bodyFatPercent: true,
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