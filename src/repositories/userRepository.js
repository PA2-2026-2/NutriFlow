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
}

module.exports = {
  UserRepository,
};