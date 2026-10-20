class MealPlanController {
	constructor(mealPlanService) {
		this.mealPlanService = mealPlanService;
	}

	async listFoods(request, response) {
		const foods = await this.mealPlanService.listFoods();
		response.status(200).json({ foods });
	}

	async list(request, response) {
		const result = await this.mealPlanService.listForNutritionist(request.user.sub);
		response.status(200).json(result);
	}

	async create(request, response) {
		const result = await this.mealPlanService.create(
			request.user.sub,
			request.body || {},
		);
		response.status(201).json(result);
	}
}

module.exports = { MealPlanController };
