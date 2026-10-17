const request = require('supertest');
const { createApp } = require('../src/app');
const {
	createUserWithRole,
	cleanupTestUsers,
	bearer,
} = require('./helpers');

describe('POST /chat/messages', () => {
	let app;

	beforeAll(() => {
		app = createApp();
	});

	afterAll(async () => {
		await cleanupTestUsers(app);
		await app.stop();
	});

	async function link(patient, nutritionist) {
		await app.locals.prisma.patientProfile.create({
			data: {
				userId: patient.user.id,
				nutritionistId: nutritionist.user.id,
			},
		});
	}

	it('permite que o paciente envie mensagem ao nutricionista vinculado e persiste os dados', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);

		const response = await request(app)
			.post('/chat/messages')
			.set(bearer(patient.token))
			.send({ recipientId: nutritionist.user.id, content: '  Olá, nutricionista.  ' });

		expect(response.statusCode).toBe(201);
		expect(response.body.message).toMatchObject({
			senderId: patient.user.id,
			recipientId: nutritionist.user.id,
			content: 'Olá, nutricionista.',
			status: 'UNREAD',
			readAt: null,
		});
		expect(response.body.message.id).toEqual(expect.any(String));
		expect(Number.isNaN(Date.parse(response.body.message.createdAt))).toBe(false);

		const stored = await app.locals.prisma.chatMessage.findUnique({
			where: { id: response.body.message.id },
		});
		expect(stored.senderId).toBe(patient.user.id);
	});

	it('permite que o nutricionista responda ao paciente vinculado', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);

		const response = await request(app)
			.post('/api/chat/messages')
			.set(bearer(nutritionist.token))
			.send({ recipientId: patient.user.id, content: 'Vamos conversar.' });

		expect(response.statusCode).toBe(201);
		expect(response.body.message).toMatchObject({
			senderId: nutritionist.user.id,
			recipientId: patient.user.id,
			content: 'Vamos conversar.',
		});
	});

	it('carrega a conversa somente para participantes e marca mensagens recebidas como lidas', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);
		const sent = await request(app)
			.post('/api/chat/messages')
			.set(bearer(patient.token))
			.send({ recipientId: nutritionist.user.id, content: 'Mensagem para leitura.' });

		const response = await request(app)
			.get(`/api/chat/messages?recipientId=${patient.user.id}`)
			.set(bearer(nutritionist.token));

		expect(response.statusCode).toBe(200);
		expect(response.body.conversation.messages).toEqual(expect.arrayContaining([
			expect.objectContaining({
				id: sent.body.message.id,
				content: 'Mensagem para leitura.',
				status: 'READ',
				senderRole: 'PATIENT',
			}),
		]));
		expect(response.body.conversation.patient.id).toBe(patient.user.id);
		expect(response.body.conversation.patient.pendingMessages).toBe(1);
	});

	it('mantem os caminhos usados pelo painel antigo do paciente', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);

		const sent = await request(app)
			.post('/api/patient/messages')
			.set(bearer(patient.token))
			.send({ content: 'Mensagem pelo caminho legado.' });
		const history = await request(app)
			.get('/api/patient/chat')
			.set(bearer(patient.token));

		expect(sent.statusCode).toBe(201);
		expect(sent.body.message).toMatchObject({
			senderId: patient.user.id,
			recipientId: nutritionist.user.id,
			content: 'Mensagem pelo caminho legado.',
		});
		expect(history.statusCode).toBe(200);
		expect(history.body.chat.messages).toEqual(expect.arrayContaining([
			expect.objectContaining({ content: 'Mensagem pelo caminho legado.' }),
		]));
	});

	it('lista conversas vinculadas com ultima mensagem e contagem de nao lidas', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);
		await request(app)
			.post('/api/chat/messages')
			.set(bearer(patient.token))
			.send({ recipientId: nutritionist.user.id, content: 'Preciso de uma orientacao.' });

		const response = await request(app)
			.get('/chat/conversations')
			.set(bearer(nutritionist.token));

		expect(response.statusCode).toBe(200);
		expect(response.body.conversations).toEqual(expect.arrayContaining([
			expect.objectContaining({
				id: patient.user.id,
				patient: expect.objectContaining({ id: patient.user.id }),
				lastMessage: expect.objectContaining({ content: 'Preciso de uma orientacao.' }),
				unreadCount: 1,
			}),
		]));
	});

	it('retorna historico paginado em ordem cronologica e bloqueia nao participantes', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		const otherNutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);
		const older = new Date('2026-01-01T10:00:00.000Z');
		const newer = new Date('2026-01-01T10:01:00.000Z');
		const firstMessage = await app.locals.prisma.chatMessage.create({
			data: {
				senderId: patient.user.id,
				recipientId: nutritionist.user.id,
				content: 'Primeira',
				createdAt: older,
			},
		});
		const secondMessage = await app.locals.prisma.chatMessage.create({
			data: {
				senderId: nutritionist.user.id,
				recipientId: patient.user.id,
				content: 'Segunda',
				createdAt: newer,
			},
		});

		const response = await request(app)
			.get(`/api/chat/conversations/${patient.user.id}/messages?page=1&limit=2`)
			.set(bearer(nutritionist.token));
		const firstPage = await request(app)
			.get(`/api/chat/conversations/${patient.user.id}/messages?page=1&limit=1`)
			.set(bearer(nutritionist.token));
		const forbidden = await request(app)
			.get(`/api/chat/conversations/${patient.user.id}/messages`)
			.set(bearer(otherNutritionist.token));

		expect(response.statusCode).toBe(200);
		expect(response.body.messages.map((message) => message.id)).toEqual([firstMessage.id, secondMessage.id]);
		expect(response.body.pagination).toMatchObject({ page: 1, limit: 2, total: 2, totalPages: 1 });
		expect(firstPage.body.messages.map((message) => message.id)).toEqual([secondMessage.id]);
		expect(forbidden.statusCode).toBe(403);
		expect(firstMessage.id).not.toBe(secondMessage.id);
	});

	it('exige autenticação', async () => {
		const response = await request(app)
			.post('/chat/messages')
			.send({ recipientId: 'qualquer-id', content: 'Olá' });

		expect(response.statusCode).toBe(401);
	});

	it('rejeita destinatário sem vínculo ativo', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');

		const response = await request(app)
			.post('/chat/messages')
			.set(bearer(patient.token))
			.send({ recipientId: nutritionist.user.id, content: 'Olá' });

		expect(response.statusCode).toBe(403);
	});

	it('retorna 404 quando o destinatário não existe', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');

		const response = await request(app)
			.post('/chat/messages')
			.set(bearer(patient.token))
			.send({ recipientId: 'destinatario-inexistente', content: 'Olá' });

		expect(response.statusCode).toBe(404);
	});

	it.each([
		[{ recipientId: 'recipient', content: '   ' }],
		[{ recipientId: 'recipient', content: 'a'.repeat(2001) }],
		[{ recipientId: 'recipient', content: 'Olá', senderId: 'outro-usuario' }],
		[{ content: 'Olá' }],
	])('rejeita payload inválido antes de gravar', async (payload) => {
		const patient = await createUserWithRole(app, 'PATIENT');

		const response = await request(app)
			.post('/chat/messages')
			.set(bearer(patient.token))
			.send(payload);

		expect(response.statusCode).toBe(400);
	});

	it('impede envio para o próprio usuário', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');

		const response = await request(app)
			.post('/chat/messages')
			.set(bearer(patient.token))
			.send({ recipientId: patient.user.id, content: 'Olá' });

		expect(response.statusCode).toBe(400);
	});
});