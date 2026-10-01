const { AppError } = require('../errors/appError');
const { ROLES } = require('../constants/roles');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

class PatientService {
	constructor(profileRepository, userRepository) {
		this.profileRepository = profileRepository;
		this.userRepository = userRepository;
	}

	async setNutritionist(patientId, payload) {
		const nutritionistEmail = normalizeEmail(payload.nutritionistEmail);

		if (!nutritionistEmail) {
			throw new AppError('Informe o e-mail do nutricionista.', 400);
		}

		const nutritionist = await this.userRepository.findByEmail(nutritionistEmail);

		if (!nutritionist || nutritionist.profile !== ROLES.NUTRITIONIST) {
			throw new AppError('Nutricionista nao encontrado.', 404);
		}

		const patientProfile = await this.profileRepository.updatePatientProfile(
			patientId,
			{ nutritionistId: nutritionist.id },
		);

		return {
			message: 'Nutricionista vinculado com sucesso.',
			nutritionist: {
				id: nutritionist.id,
				email: nutritionist.email,
			},
			patientProfile,
		};
	}
}

module.exports = {
	PatientService,
};
