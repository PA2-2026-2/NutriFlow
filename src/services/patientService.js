const { AppError } = require('../errors/appError');
const { normalizeRole, ROLES } = require('../constants/roles');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

class PatientService {
	constructor(profileRepository, userRepository) {
		this.profileRepository = profileRepository;
		this.userRepository = userRepository;
	}

	setNutritionist(patientId, { nutritionistEmail } = {}) {
		return this.linkNutritionist(patientId, nutritionistEmail);
	}

	async linkNutritionist(patientId, nutritionistEmail) {
		const email = normalizeEmail(nutritionistEmail);
		if (!email) {
			throw new AppError('Informe o e-mail do nutricionista responsavel.', 400);
		}

		const nutritionist = await this.userRepository.findByEmail(email);
		if (!nutritionist || normalizeRole(nutritionist.profile) !== ROLES.NUTRITIONIST) {
			throw new AppError('Nutricionista nao encontrado.', 404);
		}

		if (!nutritionist.isActive) {
			throw new AppError('Este nutricionista esta inativo no momento.', 403);
		}

		const patientProfile = await this.profileRepository.linkNutritionist(
			patientId,
			nutritionist.id,
		);

		return {
			message: 'Vinculo com o nutricionista realizado com sucesso.',
			nutritionist: {
				id: nutritionist.id,
				name: nutritionist.name,
				email: nutritionist.email,
			},
			patientProfile: {
				id: patientProfile.id,
				nutritionistId: patientProfile.nutritionistId,
			},
		};
	}
}

module.exports = {
	PatientService,
};
