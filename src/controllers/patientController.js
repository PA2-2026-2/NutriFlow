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

	async getLinkedPatients(request, response) {
		const result = await this.patientService.getLinkedPatients(
			request.user.sub,
		);
		response.status(200).json(result);
	}

	async linkPatient(request, response) {
		const result = await this.patientService.linkPatient(
			request.user.sub,
			request.body || {},
		);
		response.status(200).json(result);
	}
}

module.exports = {
	PatientController,
};
