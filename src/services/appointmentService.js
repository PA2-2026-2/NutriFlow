const { AppError } = require('../errors/appError');

const APPOINTMENT_STATUSES = new Set([
	'AGENDADA',
	'CONFIRMADA',
	'CANCELADA',
	'CONCLUIDA',
]);
const ALLOWED_STATUS_TRANSITIONS = {
	AGENDADA: new Set(['CONFIRMADA', 'CANCELADA']),
	CONFIRMADA: new Set(['CANCELADA', 'CONCLUIDA']),
	CANCELADA: new Set(),
	CONCLUIDA: new Set(),
};
const CREATE_FIELDS = new Set(['patientId', 'startAt', 'endAt', 'description']);
const UPDATE_FIELDS = new Set(['status', 'startAt', 'endAt', 'description']);
const DATE_TIME_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

function assertPayload(payload, allowedFields, label) {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new AppError(`Informe os dados ${label} da consulta.`, 400);
	}

	const unsupportedField = Object.keys(payload).find((field) => !allowedFields.has(field));
	if (unsupportedField) {
		throw new AppError(`O campo "${unsupportedField}" nao pode ser alterado.`, 400);
	}
}

function parseDateTime(value, fieldName) {
	const parts = typeof value === 'string' ? value.match(DATE_TIME_PATTERN) : null;
	if (!parts) {
		throw new AppError(`Informe ${fieldName} em formato ISO 8601 com fuso horario.`, 400);
	}

	const [, year, month, day, hour, minute, second = '0', offsetHour = '0', offsetMinute = '0'] =
		parts;
	const numericYear = Number(year);
	const numericMonth = Number(month);
	const isLeapYear =
		numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
	const daysInMonth = [
		31,
		isLeapYear ? 29 : 28,
		31,
		30,
		31,
		30,
		31,
		31,
		30,
		31,
		30,
		31,
	][numericMonth - 1];
	if (
		numericMonth < 1 ||
		numericMonth > 12 ||
		Number(day) < 1 ||
		Number(day) > daysInMonth ||
		Number(hour) > 23 ||
		Number(minute) > 59 ||
		Number(second) > 59 ||
		Number(offsetHour) > 23 ||
		Number(offsetMinute) > 59
	) {
		throw new AppError(`Informe uma data valida para ${fieldName}.`, 400);
	}

	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) {
		throw new AppError(`Informe uma data valida para ${fieldName}.`, 400);
	}
	return date;
}

function validateInterval(startAt, endAt) {
	if (endAt <= startAt) {
		throw new AppError('O termino deve ser posterior ao inicio da consulta.', 400);
	}
	if (startAt <= new Date()) {
		throw new AppError('Nao e permitido agendar uma consulta no passado.', 400);
	}
}

function parseFilters(query) {
	const filters = {};
	if (query.status !== undefined) {
		if (typeof query.status !== 'string' || !APPOINTMENT_STATUSES.has(query.status)) {
			throw new AppError('Informe um status de consulta valido.', 400);
		}
		filters.status = query.status;
	}

	const from = query.from === undefined ? undefined : parseDateTime(query.from, 'from');
	const to = query.to === undefined ? undefined : parseDateTime(query.to, 'to');
	if (from && to && to < from) {
		throw new AppError('O fim do intervalo deve ser posterior ao inicio.', 400);
	}
	if (from || to) {
		filters.startAt = {
			...(from ? { gte: from } : {}),
			...(to ? { lte: to } : {}),
		};
	}
	return filters;
}

function isScheduleConstraintError(error) {
	const details = `${error?.message || ''} ${JSON.stringify(error?.meta || {})}`;
	return details.includes('23P01') ||
		(error?.code === 'P2004' &&
			(details.includes('Appointment_') || details.includes('exclusion constraint')));
}

function presentAppointment(appointment) {
	return {
		id: appointment.id,
		patientId: appointment.patientId,
		nutritionistId: appointment.nutritionistId,
		startAt: appointment.startAt,
		endAt: appointment.endAt,
		status: appointment.status,
		description: appointment.description || '',
		createdAt: appointment.createdAt,
		updatedAt: appointment.updatedAt,
	};
}

class AppointmentService {
	constructor(repository, profileRepository) {
		this.repository = repository;
		this.profileRepository = profileRepository;
	}

	async create(nutritionistId, payload) {
		assertPayload(payload, CREATE_FIELDS, 'de criacao');
		const patientId = typeof payload.patientId === 'string' ? payload.patientId.trim() : '';
		if (!patientId) {
			throw new AppError('Informe o paciente da consulta.', 400);
		}

		const patientProfile = await this.profileRepository.findPatientWithUserByUserId(patientId);
		if (!patientProfile || patientProfile.user.profile !== 'PATIENT') {
			throw new AppError('Paciente nao encontrado.', 404);
		}
		if (patientProfile.nutritionistId !== nutritionistId) {
			throw new AppError('Este paciente nao esta vinculado ao nutricionista.', 403);
		}

		const startAt = parseDateTime(payload.startAt, 'inicio');
		const endAt = parseDateTime(payload.endAt, 'termino');
		validateInterval(startAt, endAt);
		const description = this.validateDescription(payload.description);

		await this.assertAvailable({ patientId, nutritionistId, startAt, endAt });
		try {
			const appointment = await this.repository.create({
				patientId,
				nutritionistId,
				startAt,
				endAt,
				description,
				status: 'AGENDADA',
			});
			return { appointment: presentAppointment(appointment) };
		} catch (error) {
			if (isScheduleConstraintError(error)) {
				throw new AppError('Conflito de horario com outra consulta.', 409);
			}
			throw error;
		}
	}

	async list(userId, role, query) {
		const filters = parseFilters(query);
		let appointments;
		if (role === 'PATIENT') {
			appointments = await this.repository.listForPatient(userId, filters);
		} else if (role === 'NUTRITIONIST') {
			appointments = await this.repository.listForNutritionist(userId, filters);
		} else {
			throw new AppError('Voce nao tem permissao para acessar este recurso.', 403);
		}
		return { appointments: appointments.map(presentAppointment) };
	}

	async update(nutritionistId, id, payload) {
		assertPayload(payload, UPDATE_FIELDS, 'de atualizacao');
		if (Object.keys(payload).length === 0) {
			throw new AppError('Informe ao menos um campo para atualizar.', 400);
		}

		const current = await this.repository.findByIdAndNutritionistId(id, nutritionistId);
		if (!current) {
			throw new AppError('Consulta nao encontrada.', 404);
		}

		const data = {};
		const hasStartAt = Object.hasOwn(payload, 'startAt');
		const hasEndAt = Object.hasOwn(payload, 'endAt');
		if (hasStartAt !== hasEndAt) {
			throw new AppError('Informe inicio e termino juntos ao remarcar a consulta.', 400);
		}

		if (payload.status !== undefined) {
			if (!['CONFIRMADA', 'CANCELADA', 'CONCLUIDA'].includes(payload.status)) {
				throw new AppError('Informe um status permitido para atualizacao.', 400);
			}
			if (
				payload.status !== current.status &&
				!ALLOWED_STATUS_TRANSITIONS[current.status]?.has(payload.status)
			) {
				throw new AppError('A transicao de status da consulta nao e permitida.', 400);
			}
			data.status = payload.status;
		}

		if (hasStartAt) {
			if (['CANCELADA', 'CONCLUIDA'].includes(current.status)) {
				throw new AppError('Consultas canceladas ou concluidas nao podem ser remarcadas.', 400);
			}
			const startAt = parseDateTime(payload.startAt, 'inicio');
			const endAt = parseDateTime(payload.endAt, 'termino');
			validateInterval(startAt, endAt);
			data.startAt = startAt;
			data.endAt = endAt;

			if ((data.status || current.status) !== 'CANCELADA') {
				await this.assertAvailable({
					patientId: current.patientId,
					nutritionistId: current.nutritionistId,
					startAt,
					endAt,
					excludeId: current.id,
				});
			}
		}

		if (Object.hasOwn(payload, 'description')) {
			data.description = this.validateDescription(payload.description);
		}

		try {
			const appointment = await this.repository.update(current.id, data);
			return { appointment: presentAppointment(appointment) };
		} catch (error) {
			if (isScheduleConstraintError(error)) {
				throw new AppError('Conflito de horario com outra consulta.', 409);
			}
			throw error;
		}
	}

	async assertAvailable(criteria) {
		const [patientConflict, nutritionistConflict] =
			await this.repository.findOverlapping(criteria);
		if (patientConflict || nutritionistConflict) {
			throw new AppError('Conflito de horario com outra consulta.', 409);
		}
	}

	validateDescription(value) {
		if (value === undefined || value === null || value === '') {
			return null;
		}
		if (typeof value !== 'string' || value.trim().length > 1000) {
			throw new AppError('A descricao deve ter ate 1000 caracteres.', 400);
		}
		return value.trim() || null;
	}
}

module.exports = { AppointmentService };
