class AdminRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  findUsers({ search, role } = {}) {
    const term = String(search || '').trim();

    return this.prisma.user.findMany({
      where: {
        ...(role ? { profile: role } : {}),
        ...(term
          ? {
              OR: [
                { name: { contains: term } },
                { email: { contains: term } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  getUserSummary() {
    return this.prisma.user.groupBy({
      by: ['profile', 'isActive'],
      _count: { _all: true },
    });
  }

  findUserById(userId) {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  findUserByEmail(email) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  updateUser(userId, data) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  updateUserStatus(userId, isActive) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  deleteUser(userId) {
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }
}

module.exports = {
  AdminRepository,
};