const { AppError } = require('../errors/appError');
const { normalizeRole, ROLES } = require('../constants/roles');

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

const MEASUREMENT_FIELDS = Object.freeze({
	weightKg: { min: 1, max: 500, required: true },
	heightCm: { min: 30, max: 300, required: true },
	bodyFatPercent: { min: 1, max: 75 },
	neckCircumferenceCm: { min: 5, max: 100 },
	chestCircumferenceCm: { min: 20, max: 250 },
	waistCircumferenceCm: { min: 20, max: 250 },
	hipCircumferenceCm: { min: 20, max: 250 },
	armCircumferenceCm: { min: 5, max: 100 },
	thighCircumferenceCm: { min: 10, max: 150 },
	calfCircumferenceCm: { min: 5, max: 100 },
	tricepsSkinfoldMm: { min: 1, max: 100 },
	bicepsSkinfoldMm: { min: 1, max: 100 },
	subscapularSkinfoldMm: { min: 1, max: 100 },
	suprailiacSkinfoldMm: { min: 1, max: 100 },
	abdominalSkinfoldMm: { min: 1, max: 100 },
	thighSkinfoldMm: { min: 1, max: 100 },
	calfSkinfoldMm: { min: 1, max: 100 },
});

const MEASUREMENT_LABELS = Object.freeze({
	weightKg: 'Peso',
	heightCm: 'Altura',
	bodyFatPercent: 'Gordura corporal',
	neckCircumferenceCm: 'Pescoço',
	chestCircumferenceCm: 'Tórax',
	waistCircumferenceCm: 'Cintura',
	hipCircumferenceCm: 'Quadril',
	armCircumferenceCm: 'Braço',
	thighCircumferenceCm: 'Coxa',
	calfCircumferenceCm: 'Panturrilha',
	tricepsSkinfoldMm: 'Dobra tricipital',
	bicepsSkinfoldMm: 'Dobra bicipital',
	subscapularSkinfoldMm: 'Dobra subescapular',
	suprailiacSkinfoldMm: 'Dobra supra-ilíaca',
	abdominalSkinfoldMm: 'Dobra abdominal',
	thighSkinfoldMm: 'Dobra da coxa',
	calfSkinfoldMm: 'Dobra da panturrilha',
});

function formatMeasurementValue(field, value) {
	const unit = field.endsWith('SkinfoldMm')
		? 'mm'
		: field === 'weightKg'
			? 'kg'
			: field === 'bodyFatPercent'
				? '%'
				: 'cm';

	return `${value} ${unit}`;
}

function presentMeasurement(measurement) {
	const items = Object.entries(MEASUREMENT_LABELS)
		.filter(([field]) => measurement[field] !== null && measurement[field] !== undefined)
		.map(([field, label]) => ({
			label,
			value: measurement[field],
			valueLabel: formatMeasurementValue(field, measurement[field]),
		}));
	const dateLabel = new Date(measurement.recordedAt).toLocaleDateString('pt-BR');

	if (measurement.notes) {
		items.push({
			label: 'Observações',
			value: measurement.notes,
			valueLabel: measurement.notes,
		});
	}

	return {
		id: measurement.id,
		date: measurement.recordedAt,
		dateLabel,
		items,
	};
}

function validateMeasurementPayload(payload, { partial = false } = {}) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new AppError('Informe os dados das medidas em um objeto.', 400);
	}

	const unknownFields = Object.keys(payload).filter(
		(field) => !Object.hasOwn(MEASUREMENT_FIELDS, field) && field !== 'notes',
	);

	if (unknownFields.length) {
		throw new AppError(`Campo de medida nao reconhecido: ${unknownFields[0]}.`, 400);
	}

	if (partial && Object.keys(payload).length === 0) {
		throw new AppError('Informe ao menos um campo para atualizar.', 400);
	}

	const data = {};

	for (const [field, rules] of Object.entries(MEASUREMENT_FIELDS)) {
		if (!Object.hasOwn(payload, field)) {
			if (!partial && rules.required) {
				throw new AppError(`Informe o campo ${field}.`, 400);
			}
			if (!partial) {
				data[field] = null;
			}
			continue;
		}

		const value = payload[field];
		if (value === null && !rules.required) {
			data[field] = null;
			continue;
		}

		if (
			typeof value !== 'number' ||
			!Number.isFinite(value) ||
			value < rules.min ||
			value > rules.max
		) {
			throw new AppError(
				`${field} deve ser um numero entre ${rules.min} e ${rules.max}.`,
				400,
			);
		}

		data[field] = value;
	}

	if (Object.hasOwn(payload, 'notes')) {
		if (payload.notes === null) {
			data.notes = null;
		} else if (typeof payload.notes !== 'string' || payload.notes.length > 2000) {
			throw new AppError('As observacoes devem ser um texto de ate 2000 caracteres.', 400);
		} else {
			data.notes = payload.notes.trim() || null;
		}
	} else if (!partial) {
		data.notes = null;
	}

	return data;
}

class PatientService {
	constructor(profileRepository, userRepository) {
		this.profileRepository = profileRepository;
		this.userRepository = userRepository;
	}

	setNutritionist(patientId, { nutritionistEmail, age, objective, restrictions } = {}) {
		return this.linkNutritionist(patientId, nutritionistEmail, {
			age,
			objective,
			restrictions,
		});
	}

	async linkNutritionist(patientId, nutritionistEmail, profileData = {}) {
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

		const profileUpdates = {};
		if (profileData.age !== undefined && profileData.age !== '') {
			const age = Number(profileData.age);
			if (!Number.isInteger(age) || age < 13 || age > 120) {
				throw new AppError('A idade deve ser um numero inteiro entre 13 e 120.', 400);
			}
			profileUpdates.age = age;
		}
		if (profileData.objective !== undefined) {
			const objective = typeof profileData.objective === 'string'
				? profileData.objective.trim()
				: '';
			if (objective.length > 120) {
				throw new AppError('O objetivo deve ter ate 120 caracteres.', 400);
			}
			profileUpdates.objective = objective || null;
		}
		if (profileData.restrictions !== undefined) {
			const restrictions = typeof profileData.restrictions === 'string'
				? profileData.restrictions.trim()
				: '';
			if (restrictions.length > 500) {
				throw new AppError('As restricoes devem ter ate 500 caracteres.', 400);
			}
			profileUpdates.restrictions = restrictions || null;
		}

		const patientProfile = await this.profileRepository.linkNutritionist(
			patientId,
			nutritionist.id,
			profileUpdates,
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
			patients: profiles.map(({ user, measurements = [], ...profile }) => {
				const entries = measurements.map(presentMeasurement);
				const latest = entries[0];

				return {
					id: user.id,
					name: user.name,
					email: user.email,
					age: profile.age,
					weight: latest?.items.find((item) => item.label === MEASUREMENT_LABELS.weightKg)?.value
						?? profile.weight,
					height: latest?.items.find((item) => item.label === MEASUREMENT_LABELS.heightCm)?.value
						?? profile.height,
					bodyFat: latest?.items.find((item) => item.label === MEASUREMENT_LABELS.bodyFatPercent)?.value
						?? null,
					objective: profile.objective,
					restrictions: profile.restrictions,
					weightEntries: entries
						.filter((entry) => entry.items.some((item) => item.label === MEASUREMENT_LABELS.weightKg))
						.map((entry) => ({
							weight: entry.items.find((item) => item.label === MEASUREMENT_LABELS.weightKg).value,
							date: entry.dateLabel,
						})),
					bodyMeasurements: {
						latest: latest?.items || [],
						history: entries.map(({ id, date, dateLabel, items }) => ({
							id,
							date,
							dateLabel,
							items,
						})),
					},
				};
			}),
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

	async recordMeasurement(nutritionistId, patientId, payload) {
		const patientProfile = await this.profileRepository.findPatientByUserId(patientId);

		if (!patientProfile) {
			throw new AppError('Paciente nao encontrado.', 404);
		}

		if (patientProfile.nutritionistId !== nutritionistId) {
			throw new AppError('Este paciente nao esta vinculado ao nutricionista.', 403);
		}

		const data = validateMeasurementPayload(payload);
		return this.profileRepository.createMeasurement(patientProfile.id, data);
	}

	async updateMeasurement(nutritionistId, patientId, measurementId, payload, options = {}) {
		const patientProfile = await this.getMeasurementPatientProfile(nutritionistId, patientId);
		const data = validateMeasurementPayload(payload, options);
		const result = await this.profileRepository.updateMeasurement(
			patientProfile.id,
			measurementId,
			data,
		);

		if (result.count === 0) {
			throw new AppError('Medida nao encontrada.', 404);
		}

		const measurement = await this.profileRepository.findMeasurementByIdAndPatientProfileId(
			measurementId,
			patientProfile.id,
		);
		if (!measurement) {
			throw new AppError('Medida nao encontrada.', 404);
		}

		return measurement;
	}

	async deleteMeasurement(nutritionistId, patientId, measurementId) {
		const patientProfile = await this.getMeasurementPatientProfile(nutritionistId, patientId);
		const result = await this.profileRepository.deleteMeasurement(
			patientProfile.id,
			measurementId,
		);

		if (result === 0) {
			throw new AppError('Medida nao encontrada.', 404);
		}

		return { message: 'Medida removida com sucesso.' };
	}

	async getMeasurementPatientProfile(nutritionistId, patientId) {
		const patientProfile = await this.profileRepository.findPatientByUserId(patientId);

		if (!patientProfile) {
			throw new AppError('Paciente nao encontrado.', 404);
		}

		if (patientProfile.nutritionistId !== nutritionistId) {
			throw new AppError('Este paciente nao esta vinculado ao nutricionista.', 403);
		}

		return patientProfile;
	}

	async getMeasurements(requesterId, requesterRole, patientId) {
		if (requesterRole === ROLES.PATIENT && requesterId !== patientId) {
			throw new AppError('Voce so pode consultar suas proprias medidas.', 403);
		}

		const patientProfile = await this.profileRepository.findPatientByUserId(patientId);
		if (!patientProfile) {
			if (requesterRole === ROLES.PATIENT) {
				return { measurements: [] };
			}
			throw new AppError('Paciente nao encontrado.', 404);
		}

		if (
			requesterRole === ROLES.NUTRITIONIST &&
			patientProfile.nutritionistId !== requesterId
		) {
			throw new AppError('Este paciente nao esta vinculado ao nutricionista.', 403);
		}

		return {
			measurements: await this.profileRepository.findMeasurementsByPatientProfileId(
				patientProfile.id,
			),
		};
	}
}

module.exports = {
	PatientService,
};
