class UserRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findByEmail(email) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findById(id) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findByAuthUserId(authUserId) {
    return this.prisma.user.findUnique({
      where: { authUserId },
    });
  }

  create(data) {
    return this.prisma.user.create({
      data,
    });
  }

  findAll({ role } = {}) {
    return this.prisma.user.findMany({
      where: role ? { profile: role } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  update(id, data) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  linkAuthUser(id, authUserId) {
    return this.prisma.user.update({
      where: { id },
      data: {
        authUserId,
        passwordHash: '',
      },
    });
  }

  setActive(id, isActive) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
  }

  updatePhoto(id, profilePhotoUrl) {
    return this.prisma.user.update({
      where: { id },
      data: { profilePhotoUrl },
    });
  }

  delete(id) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  countActiveByRole(role) {
    return this.prisma.user.count({
      where: { profile: role, isActive: true },
    });
  }
}

module.exports = {
  UserRepository,
};
