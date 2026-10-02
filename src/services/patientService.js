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

	async getLinkedPatients(nutritionistId) {
		const profiles = await this.profileRepository.findPatientsByNutritionistId(
			nutritionistId,
		);

		return {
			patients: profiles.map(({ user, ...profile }) => ({
				id: user.id,
				name: user.name,
				email: user.email,
				age: profile.age,
				weight: profile.weight,
				height: profile.height,
				objective: profile.objective,
				restrictions: profile.restrictions,
			})),
		};
	}

	async linkPatient(nutritionistId, payload) {
		const patientEmail = normalizeEmail(payload.patientEmail);

		if (!patientEmail) {
			throw new AppError('Informe o e-mail do paciente.', 400);
		}

		const patient = await this.userRepository.findByEmail(patientEmail);

		if (!patient || patient.profile !== ROLES.PATIENT) {
			throw new AppError('Paciente nao encontrado.', 404);
		}

		const age = Number(payload.age);

		if (!Number.isInteger(age) || age < 0) {
			throw new AppError('Idade invalida.', 400);
		}

		const objective = String(payload.objective || '').trim();

		if (!objective) {
			throw new AppError('Informe o objetivo do paciente.', 400);
		}

		const restrictions = String(payload.restrictions || '').trim() || null;

		const patientProfile = await this.profileRepository.updatePatientProfile(
			patient.id,
			{ nutritionistId, age, objective, restrictions },
		);

		return {
			message: 'Paciente vinculado com sucesso.',
			patient: {
				id: patient.id,
				name: patient.name,
				email: patient.email,
			},
			patientProfile,
		};
	}
}

module.exports = {
	PatientService,
};
