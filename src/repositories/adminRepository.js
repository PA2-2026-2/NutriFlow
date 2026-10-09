const { ensureDefaultFoods } = require('../infra/foodCatalog');

class AdminRepository {
  constructor(prisma) {
    this.prisma = prisma;
  }

  async listFoods() {
    await ensureDefaultFoods(this.prisma);

    return this.prisma.food.findMany({
      where: { isAvailable: true },
      orderBy: { name: 'asc' },
    });
  }

  createFood(data) {
    return this.prisma.food.create({ data });
  }

  restoreFood(foodId, data) {
    return this.prisma.food.update({
      where: { id: foodId },
      data: { ...data, isAvailable: true },
    });
  }

  async deleteFood(foodId) {
    const food = await this.prisma.food.findUnique({
      where: { id: foodId },
      include: { mealPlanItems: { select: { mealPlanId: true } } },
    });
    if (!food) {
      return null;
    }

    const affectedPlanIds = [...new Set(food.mealPlanItems.map((item) => item.mealPlanId))];
    let deletedPlanCount = 0;

    await this.prisma.$transaction(async (transaction) => {
      await transaction.mealPlanItem.deleteMany({ where: { foodId } });

      for (const mealPlanId of affectedPlanIds) {
        const remainingItems = await transaction.mealPlanItem.findMany({
          where: { mealPlanId },
          include: { food: true },
        });

        if (remainingItems.length === 0) {
          await transaction.mealPlan.delete({ where: { id: mealPlanId } });
          deletedPlanCount += 1;
          continue;
        }

        const totals = remainingItems.reduce((result, item) => {
          const factor = item.quantity / 100;
          result.calories += item.food.calories * factor;
          result.protein += item.food.protein * factor;
          result.carbs += item.food.carbs * factor;
          result.fats += item.food.fat * factor;
          return result;
        }, { calories: 0, protein: 0, carbs: 0, fats: 0 });

        await transaction.mealPlan.update({
          where: { id: mealPlanId },
          data: totals,
        });
      }

      await transaction.food.update({
        where: { id: foodId },
        data: { isAvailable: false },
      });
    });

    return {
      deletedFood: { ...food, isAvailable: false },
      affectedPlanCount: affectedPlanIds.length,
      deletedPlanCount,
    };
  }

  async getFoodMetrics() {
    await this.listFoods();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const [totalFoods, foodLogsToday, activeMealPlans, foodCalories] = await Promise.all([
      this.prisma.food.count({ where: { isAvailable: true } }),
      this.prisma.patientMealEntry.count({
        where: { loggedAt: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      this.prisma.mealPlan.count({
        where: {
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
      this.prisma.food.aggregate({
        where: { isAvailable: true },
        _avg: { calories: true },
      }),
    ]);

    return {
      totalFoods,
      foodLogsToday,
      activeMealPlans,
      averageFoodCalories: foodCalories._avg.calories || 0,
    };
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

  findFoodByName(name) {
    return this.prisma.food.findMany({
      select: { id: true, name: true, isAvailable: true },
    }).then((foods) => foods.find(
      (food) => food.name.trim().toLocaleLowerCase('pt-BR') === name.trim().toLocaleLowerCase('pt-BR'),
    ) || null);
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