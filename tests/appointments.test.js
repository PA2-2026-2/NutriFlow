const request = require('supertest');
const { createApp } = require('../src/app');
const {
	createUserWithRole,
	cleanupTestUsers,
	bearer,
} = require('./helpers');

const DAY = 24 * 60 * 60 * 1000;

describe('agendamento de consultas', () => {
	let app;

	beforeAll(() => {
		app = createApp();
	});

	afterAll(async () => {
		await cleanupTestUsers(app);
		await app.stop();
	});

	async function createLinkedAccounts() {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await app.locals.prisma.patientProfile.upsert({
			where: { userId: patient.user.id },
			create: {
				userId: patient.user.id,
				nutritionistId: nutritionist.user.id,
			},
			update: { nutritionistId: nutritionist.user.id },
		});
		return { patient, nutritionist };
	}

	function interval(hoursFromNow = 24, durationMinutes = 45) {
		const start = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
		start.setMilliseconds(0);
		const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
		return { startAt: start.toISOString(), endAt: end.toISOString() };
	}

	function createPayload(patient, times = interval()) {
		return {
			patientId: patient.user.id,
			...times,
			description: 'Consulta de acompanhamento',
		};
	}

	async function createAppointment(nutritionist, patient, times = interval()) {
		return request(app)
			.post('/api/appointments')
			.set(bearer(nutritionist.token))
			.send(createPayload(patient, times));
	}

	async function insertAppointment(patientId, nutritionistId, times, status = 'AGENDADA') {
		return app.locals.prisma.appointment.create({
			data: {
				patientId,
				nutritionistId,
				startAt: new Date(times.startAt),
				endAt: new Date(times.endAt),
				status,
			},
		});
	}

	it('cria consulta para paciente vinculado e define status inicial no servidor', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const response = await createAppointment(nutritionist, patient);

		expect(response.statusCode).toBe(201);
		expect(response.body.appointment).toMatchObject({
			patientId: patient.user.id,
			nutritionistId: nutritionist.user.id,
			status: 'AGENDADA',
			description: 'Consulta de acompanhamento',
		});
	});

	it('rejeita campos obrigatorios ausentes e status definido pelo cliente', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const noPatient = await request(app)
			.post('/api/appointments')
			.set(bearer(nutritionist.token))
			.send(interval());
		const noStart = await request(app)
			.post('/api/appointments')
			.set(bearer(nutritionist.token))
			.send({ patientId: patient.user.id, endAt: interval().endAt });
		const noEnd = await request(app)
			.post('/api/appointments')
			.set(bearer(nutritionist.token))
			.send({ patientId: patient.user.id, startAt: interval().startAt });
		const clientStatus = await request(app)
			.post('/api/appointments')
			.set(bearer(nutritionist.token))
			.send({ ...createPayload(patient), status: 'CONFIRMADA' });

		expect(noPatient.statusCode).toBe(400);
		expect(noStart.statusCode).toBe(400);
		expect(noEnd.statusCode).toBe(400);
		expect(clientStatus.statusCode).toBe(400);
	});

	it('rejeita data malformada e data passada', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const invalidDate = await createAppointment(nutritionist, patient, {
			startAt: 'nao-e-data',
			endAt: interval().endAt,
		});
		const impossibleDate = await createAppointment(nutritionist, patient, {
			startAt: '2027-02-30T12:00:00Z',
			endAt: '2027-02-30T13:00:00Z',
		});
		const noTimezone = await createAppointment(nutritionist, patient, {
			startAt: '2027-02-28T12:00:00',
			endAt: '2027-02-28T13:00:00Z',
		});
		const past = new Date(Date.now() - DAY).toISOString();
		const pastDate = await createAppointment(nutritionist, patient, {
			startAt: past,
			endAt: new Date(new Date(past).getTime() + 30 * 60 * 1000).toISOString(),
		});

		expect(invalidDate.statusCode).toBe(400);
		expect(impossibleDate.statusCode).toBe(400);
		expect(noTimezone.statusCode).toBe(400);
		expect(pastDate.statusCode).toBe(400);
	});

	it('rejeita término igual ou anterior ao início', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const startAt = interval().startAt;
		const equal = await createAppointment(nutritionist, patient, {
			startAt,
			endAt: startAt,
		});
		const earlier = await createAppointment(nutritionist, patient, {
			startAt,
			endAt: new Date(new Date(startAt).getTime() - 60 * 1000).toISOString(),
		});

		expect(equal.statusCode).toBe(400);
		expect(earlier.statusCode).toBe(400);
	});

	it('rejeita sobreposição na agenda do nutricionista', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const anotherPatient = await createUserWithRole(app, 'PATIENT');
		await app.locals.prisma.patientProfile.create({
			data: {
				userId: anotherPatient.user.id,
				nutritionistId: nutritionist.user.id,
			},
		});
		const times = interval();
		expect((await createAppointment(nutritionist, patient, times)).statusCode).toBe(201);

		const overlapping = await createAppointment(nutritionist, anotherPatient, {
			startAt: new Date(new Date(times.startAt).getTime() + 10 * 60 * 1000).toISOString(),
			endAt: new Date(new Date(times.endAt).getTime() + 10 * 60 * 1000).toISOString(),
		});
		expect(overlapping.statusCode).toBe(409);
	});

	it('rejeita sobreposição na agenda do paciente', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		const times = interval();
		await insertAppointment(patient.user.id, otherNutritionist.user.id, times);

		const overlapping = await createAppointment(nutritionist, patient, times);
		expect(overlapping.statusCode).toBe(409);
	});

	it('permite consultas consecutivas sem sobreposição', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const first = interval();
		expect((await createAppointment(nutritionist, patient, first)).statusCode).toBe(201);

		const second = await createAppointment(nutritionist, patient, {
			startAt: first.endAt,
			endAt: new Date(new Date(first.endAt).getTime() + 45 * 60 * 1000).toISOString(),
		});
		expect(second.statusCode).toBe(201);
	});

	it('lista somente consultas próprias para paciente e nutricionista autenticados', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const unrelated = await createLinkedAccounts();
		const own = await createAppointment(nutritionist, patient);
		const other = await createAppointment(unrelated.nutritionist, unrelated.patient);
		expect(own.statusCode).toBe(201);
		expect(other.statusCode).toBe(201);

		const patientList = await request(app)
			.get(`/api/appointments?patientId=${unrelated.patient.user.id}`)
			.set(bearer(patient.token));
		const nutritionistList = await request(app)
			.get(`/api/appointments?nutritionistId=${unrelated.nutritionist.user.id}`)
			.set(bearer(nutritionist.token));

		expect(patientList.statusCode).toBe(200);
		expect(patientList.body.appointments.map((item) => item.id))
			.toEqual([own.body.appointment.id]);
		expect(nutritionistList.statusCode).toBe(200);
		expect(nutritionistList.body.appointments.map((item) => item.id))
			.toEqual([own.body.appointment.id]);
	});

	it('aplica filtros de status e intervalo de datas na listagem', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const firstTimes = interval(24);
		const secondTimes = interval(48);
		const thirdTimes = interval(72);
		const first = await createAppointment(nutritionist, patient, firstTimes);
		const second = await createAppointment(nutritionist, patient, secondTimes);
		const third = await createAppointment(nutritionist, patient, thirdTimes);

		await request(app)
			.put(`/api/appointments/${second.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send({ status: 'CONFIRMADA' });

		const statusFilter = await request(app)
			.get('/api/appointments?status=CONFIRMADA')
			.set(bearer(patient.token));
		const dateFilter = await request(app)
			.get(`/api/appointments?from=${encodeURIComponent(secondTimes.startAt)}&to=${encodeURIComponent(thirdTimes.startAt)}`)
			.set(bearer(patient.token));

		expect(statusFilter.statusCode).toBe(200);
		expect(statusFilter.body.appointments.map((item) => item.id))
			.toEqual([second.body.appointment.id]);
		expect(dateFilter.statusCode).toBe(200);
		expect(dateFilter.body.appointments.map((item) => item.id))
			.toEqual([second.body.appointment.id, third.body.appointment.id]);
		expect(first.body.appointment.id).not.toBe(second.body.appointment.id);
	});

	it('impede paciente de criar ou atualizar consultas', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const created = await createAppointment(nutritionist, patient);
		const createByPatient = await request(app)
			.post('/api/appointments')
			.set(bearer(patient.token))
			.send(createPayload(patient));
		const updateByPatient = await request(app)
			.put(`/api/appointments/${created.body.appointment.id}`)
			.set(bearer(patient.token))
			.send({ status: 'CANCELADA' });

		expect(createByPatient.statusCode).toBe(403);
		expect(updateByPatient.statusCode).toBe(403);
	});

	it('permite transições para CONFIRMADA, CANCELADA e CONCLUIDA conforme o estado atual', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const toComplete = await createAppointment(nutritionist, patient, interval(24));
		const confirmed = await request(app)
			.put(`/api/appointments/${toComplete.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send({ status: 'CONFIRMADA' });
		const completed = await request(app)
			.put(`/api/appointments/${toComplete.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send({ status: 'CONCLUIDA' });

		const toCancel = await createAppointment(nutritionist, patient, interval(26));
		const cancelled = await request(app)
			.put(`/api/appointments/${toCancel.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send({ status: 'CANCELADA' });

		expect(confirmed.body.appointment.status).toBe('CONFIRMADA');
		expect(completed.body.appointment.status).toBe('CONCLUIDA');
		expect(cancelled.body.appointment.status).toBe('CANCELADA');
		const invalidTransition = await request(app)
			.put(`/api/appointments/${toComplete.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send({ status: 'AGENDADA' });
		expect(invalidTransition.statusCode).toBe(400);
	});

	it('remarca consulta e preserva campos não enviados', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const created = await createAppointment(nutritionist, patient, interval(24));
		const newTimes = interval(48);
		const updated = await request(app)
			.put(`/api/appointments/${created.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send(newTimes);

		expect(updated.statusCode).toBe(200);
		expect(updated.body.appointment).toMatchObject({
			id: created.body.appointment.id,
			patientId: patient.user.id,
			nutritionistId: nutritionist.user.id,
			status: 'AGENDADA',
			startAt: newTimes.startAt,
			endAt: newTimes.endAt,
			description: 'Consulta de acompanhamento',
		});
	});

	it('rejeita remarcação conflitante e exclui a própria consulta da verificação', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const anotherPatient = await createUserWithRole(app, 'PATIENT');
		await app.locals.prisma.patientProfile.create({
			data: {
				userId: anotherPatient.user.id,
				nutritionistId: nutritionist.user.id,
			},
		});
		const firstTimes = interval(24);
		const secondTimes = interval(48);
		const first = await createAppointment(nutritionist, patient, firstTimes);
		const second = await createAppointment(nutritionist, anotherPatient, secondTimes);

		const sameInterval = await request(app)
			.put(`/api/appointments/${first.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send(firstTimes);
		const conflict = await request(app)
			.put(`/api/appointments/${first.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send(secondTimes);

		expect(sameInterval.statusCode).toBe(200);
		expect(conflict.statusCode).toBe(409);
	});

	it('não permite nutricionista alterar consulta de outro nutricionista', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		const created = await createAppointment(nutritionist, patient);
		const response = await request(app)
			.put(`/api/appointments/${created.body.appointment.id}`)
			.set(bearer(otherNutritionist.token))
			.send({ status: 'CONFIRMADA' });

		expect(response.statusCode).toBe(404);
	});

	it('retorna 404 para consulta inexistente', async () => {
		const { nutritionist } = await createLinkedAccounts();
		const response = await request(app)
			.put('/api/appointments/id-inexistente')
			.set(bearer(nutritionist.token))
			.send({ status: 'CONFIRMADA' });
		expect(response.statusCode).toBe(404);
	});

	it('não considera consulta cancelada como bloqueio de horário', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const times = interval();
		await insertAppointment(patient.user.id, nutritionist.user.id, times, 'CANCELADA');

		const response = await createAppointment(nutritionist, patient, times);
		expect(response.statusCode).toBe(201);
	});

	it('rejeita alteração de identificadores e remarcação incompleta', async () => {
		const { patient, nutritionist } = await createLinkedAccounts();
		const created = await createAppointment(nutritionist, patient);
		const idChange = await request(app)
			.put(`/api/appointments/${created.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send({ patientId: 'outro-paciente' });
		const partialReschedule = await request(app)
			.put(`/api/appointments/${created.body.appointment.id}`)
			.set(bearer(nutritionist.token))
			.send({ startAt: interval(48).startAt });

		expect(idChange.statusCode).toBe(400);
		expect(partialReschedule.statusCode).toBe(400);
	});
});
