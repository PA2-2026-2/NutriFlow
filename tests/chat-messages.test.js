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

	it('permite enviar e reproduzir áudio somente para participantes da conversa', async () => {
			const patient = await createUserWithRole(app, 'PATIENT');
			const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
			const otherPatient = await createUserWithRole(app, 'PATIENT');
			await link(patient, nutritionist);
			const audioBase64 = Buffer.from('audio de teste').toString('base64');

			const sent = await request(app)
				.post('/api/chat/messages')
				.set(bearer(patient.token))
				.send({
					recipientId: nutritionist.user.id,
					audioBase64,
					audioMimeType: 'audio/webm;codecs=opus',
					audioDurationSeconds: 3,
				});
			const history = await request(app)
				.get(`/api/chat/conversations/${patient.user.id}/messages`)
				.set(bearer(nutritionist.token));
			const playback = await request(app)
				.get(`/api/chat/messages/${sent.body.message.id}/audio`)
				.set(bearer(nutritionist.token));
			const forbidden = await request(app)
				.get(`/api/chat/messages/${sent.body.message.id}/audio`)
				.set(bearer(otherPatient.token));

			expect(sent.statusCode).toBe(201);
			expect(sent.body.message).toMatchObject({
				content: '',
				type: 'AUDIO',
				audioMimeType: 'audio/webm',
				audioDurationSeconds: 3,
				status: 'UNREAD',
			});
			expect(history.body.messages[0]).toMatchObject({
				type: 'AUDIO',
				audioDurationSeconds: 3,
			});
			expect(history.body.messages[0]).not.toHaveProperty('audioBase64');
			expect(playback.statusCode).toBe(200);
			expect(playback.body).toEqual({
				audioBase64,
				audioMimeType: 'audio/webm',
			});
			expect(forbidden.statusCode).toBe(403);
	});

	it('rejeita áudio vazio, grande ou com metadados inválidos', async () => {
			const patient = await createUserWithRole(app, 'PATIENT');
			const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
			await link(patient, nutritionist);

			const invalidMessages = [
				{ audioBase64: '', audioMimeType: 'audio/webm', audioDurationSeconds: 2 },
				{ audioBase64: Buffer.alloc(512 * 1024 + 1).toString('base64'), audioMimeType: 'audio/webm', audioDurationSeconds: 2 },
				{ audioBase64: Buffer.from('audio').toString('base64'), audioMimeType: 'text/plain', audioDurationSeconds: 2 },
				{ audioBase64: Buffer.from('audio').toString('base64'), audioMimeType: 'audio/webm', audioDurationSeconds: 121 },
			];

			for (const payload of invalidMessages) {
				const response = await request(app)
					.post('/api/chat/messages')
					.set(bearer(patient.token))
					.send({ recipientId: nutritionist.user.id, ...payload });
				expect(response.statusCode).toBe(400);
			}
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

	it('lista conversa sem mensagens sem consultar colunas inexistentes nem falhar', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);

		const response = await request(app)
			.get('/api/chat/conversations')
			.set(bearer(nutritionist.token));

		expect(response.statusCode).toBe(200);
		expect(response.body.conversations).toEqual([
			expect.objectContaining({
				id: patient.user.id,
				lastMessage: null,
				unreadCount: 0,
			}),
		]);
	});

	it('retorna erro interno genérico se a consulta de conversas falhar com P2022', async () => {
		const patient = await createUserWithRole(app, 'PATIENT');
		const nutritionist = await createUserWithRole(app, 'NUTRITIONIST');
		await link(patient, nutritionist);
		const prismaError = Object.assign(
			new Error('The column ChatMessage.type does not exist'),
			{ code: 'P2022' },
		);
		const querySpy = jest.spyOn(app.locals.prisma.chatMessage, 'findFirst')
			.mockRejectedValue(prismaError);
		const errorLogSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

		try {
			const response = await request(app)
				.get('/api/chat/conversations')
				.set(bearer(nutritionist.token));

			expect(response.statusCode).toBe(500);
			expect(response.body).toEqual({ message: 'Erro interno do servidor.' });
			expect(response.body.message).not.toContain('ChatMessage.type');
		} finally {
			querySpy.mockRestore();
			errorLogSpy.mockRestore();
		}
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