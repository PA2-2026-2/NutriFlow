class PatientController {
	constructor(patientService) {
		this.patientService = patientService;
	}

	async setNutritionist(request, response) {
		const result = await this.patientService.setNutritionist(
			request.user.sub,
			request.body || {},
		);
		response.status(200).json(result);
	}

	linkNutritionist(request, response) {
		return this.setNutritionist(request, response);
	}
}

module.exports = {
	PatientController,
};
