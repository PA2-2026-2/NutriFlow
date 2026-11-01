class ChallengeRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  listForNutritionist(nutritionistId) {
    return this.prisma.challenge.findMany({
      where: {
        nutritionistId,
        isActive: true,
      },
      include: {
        participants: {
          include: {
            patient: {
              select: { id: true, name: true, email: true },
            },
            checkIns: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listForPatient(nutritionistId) {
    return this.prisma.challenge.findMany({
      where: {
        nutritionistId,
        isActive: true,
      },
      include: {
        participants: {
          include: {
            patient: {
              select: { id: true, name: true, email: true },
            },
            checkIns: true,
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  findById(id) {
    return this.prisma.challenge.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            patient: {
              select: { id: true, name: true, email: true },
            },
            checkIns: true,
          },
        },
      },
    });
  }

  create(data) {
    return this.prisma.challenge.create({
      data,
      include: {
        participants: {
          include: {
            patient: {
              select: { id: true, name: true, email: true },
            },
            checkIns: true,
          },
        },
      },
    });
  }

  update(id, data) {
    return this.prisma.challenge.update({
      where: { id },
      data,
      include: {
        participants: {
          include: {
            patient: {
              select: { id: true, name: true, email: true },
            },
            checkIns: true,
          },
        },
      },
    });
  }

  findParticipant(challengeId, patientId) {
    return this.prisma.challengeParticipant.findUnique({
      where: {
        challengeId_patientId: {
          challengeId,
          patientId,
        },
      },
      include: {
        patient: {
          select: { id: true, name: true, email: true },
        },
        checkIns: {
          orderBy: { checkInDate: 'asc' },
        },
      },
    });
  }

  createParticipant(data) {
    return this.prisma.challengeParticipant.create({
      data,
      include: {
        patient: {
          select: { id: true, name: true, email: true },
        },
        checkIns: true,
      },
    });
  }

  updateParticipant(id, data) {
    return this.prisma.challengeParticipant.update({
      where: { id },
      data,
      include: {
        patient: {
          select: { id: true, name: true, email: true },
        },
        checkIns: true,
      },
    });
  }

  countParticipants(challengeId) {
    return this.prisma.challengeParticipant.count({
      where: { challengeId },
    });
  }

  countCheckIns(challengeId) {
    return this.prisma.challengeCheckIn.count({
      where: {
        participation: {
          challengeId,
        },
      },
    });
  }

  findCheckInByParticipationAndDate(participationId, checkInDate) {
    return this.prisma.challengeCheckIn.findUnique({
      where: {
        participationId_checkInDate: {
          participationId,
          checkInDate,
        },
      },
    });
  }

  createCheckIn(data) {
    return this.prisma.challengeCheckIn.create({
      data,
      include: {
        participation: {
          include: {
            patient: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });
  }

  listCheckInsForParticipation(participationId) {
    return this.prisma.challengeCheckIn.findMany({
      where: { participationId },
      orderBy: { checkInDate: 'asc' },
    });
  }
}

module.exports = {
  ChallengeRepository,
};
