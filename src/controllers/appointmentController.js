class AppointmentController {
	constructor(appointmentService) {
		this.appointmentService = appointmentService;
	}

	async list(request, response) {
		const result = await this.appointmentService.list(
			request.user.sub,
			request.user.profile,
			request.query,
		);
		response.status(200).json(result);
	}

	async create(request, response) {
		const result = await this.appointmentService.create(
			request.user.sub,
			request.body,
		);
		response.status(201).json(result);
	}

	async update(request, response) {
		const result = await this.appointmentService.update(
			request.user.sub,
			request.params.id,
			request.body,
		);
		response.status(200).json(result);
	}
}

module.exports = { AppointmentController };
