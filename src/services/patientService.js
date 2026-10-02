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
