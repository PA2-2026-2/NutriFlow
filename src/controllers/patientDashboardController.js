class PatientDashboardController {
	constructor(patientDashboardService) {
		this.patientDashboardService = patientDashboardService;
	}

	async getDashboard(request, response) {
		const result = await this.patientDashboardService.getDashboard(request.user.sub);
		response.status(200).json(result);
	}

	async createMeal(request, response) {
		const result = await this.patientDashboardService.createMeal(
			request.user.sub,
			request.body || {},
		);
		response.status(201).json(result);
	}

	async createWeight(request, response) {
		const result = await this.patientDashboardService.createWeight(
			request.user.sub,
			request.body || {},
		);
		response.status(201).json(result);
	}
}

module.exports = { PatientDashboardController };