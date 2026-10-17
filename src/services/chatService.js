const { AppError } = require('../errors/appError');
const { ROLES } = require('../constants/roles');

const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_FIELDS = new Set(['recipientId', 'content']);

class ChatService {
	constructor(repository) {
		this.repository = repository;
	}

	async getAuthorizedPair(userId, recipientId) {
		const recipient = await this.repository.findUserById(recipientId);
		if (!recipient) {
			throw new AppError('Destinatario nao encontrado.', 404);
		}

		const link = await this.repository.findActiveLink(userId, recipientId);
		const validPair = link
			&& link.user.profile === ROLES.PATIENT
			&& link.nutritionist?.profile === ROLES.NUTRITIONIST
			&& link.user.isActive
			&& link.nutritionist.isActive
			&& ((userId === link.user.id && recipientId === link.nutritionist.id)
				|| (userId === link.nutritionist.id && recipientId === link.user.id));

		if (!validPair) {
			throw new AppError('Nao existe vinculo ativo com este destinatario.', 403);
		}

		return { recipient, link };
	}

	async sendMessage(senderId, payload) {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			throw new AppError('Informe os dados da mensagem em um objeto.', 400);
		}

		const unexpectedField = Object.keys(payload).find((field) => !MESSAGE_FIELDS.has(field));
		if (unexpectedField) {
			throw new AppError(`Campo nao reconhecido: ${unexpectedField}.`, 400);
		}

		if (typeof payload.recipientId !== 'string' || !payload.recipientId.trim()) {
			throw new AppError('Informe o destinatario da mensagem.', 400);
		}

		if (typeof payload.content !== 'string') {
			throw new AppError('O conteudo da mensagem deve ser um texto.', 400);
		}

		const content = payload.content.trim();
		if (!content) {
			throw new AppError('A mensagem nao pode estar vazia.', 400);
		}
		if (content.length > MAX_MESSAGE_LENGTH) {
			throw new AppError(`A mensagem deve ter ate ${MAX_MESSAGE_LENGTH} caracteres.`, 400);
		}

		const recipientId = payload.recipientId.trim();
		if (recipientId === senderId) {
			throw new AppError('Nao e permitido enviar mensagem para si mesmo.', 400);
		}

		await this.getAuthorizedPair(senderId, recipientId);

		return this.repository.createMessage({
			senderId,
			recipientId,
			content,
			status: 'UNREAD',
			createdAt: new Date(),
		});
	}

	async getPatientConversation(patientId) {
		const profile = await this.repository.findPatientProfile(patientId);
		if (!profile?.nutritionistId) {
			return {
				chat: {
					responseTimeLabel: 'Sem nutricionista vinculada',
					quickReplies: [],
					messages: [],
				},
				conversation: { patient: null, messages: [] },
			};
		}

		return this.getConversation(patientId, profile.nutritionistId);
	}

	async listConversations(userId) {
		const user = await this.repository.findUserById(userId);
		if (!user || !user.isActive) {
			throw new AppError('Usuario nao encontrado ou inativo.', 403);
		}

		let patientProfiles;
		if (user.profile === ROLES.NUTRITIONIST) {
			patientProfiles = await this.repository.findLinkedPatients(userId);
		} else if (user.profile === ROLES.PATIENT) {
			const profile = await this.repository.findPatientProfile(userId);
			patientProfiles = profile?.nutritionistId
				? [{ user: user, nutritionistId: profile.nutritionistId }]
				: [];
		} else {
			throw new AppError('Voce nao tem permissao para acessar conversas.', 403);
		}

		return Promise.all(patientProfiles.map(async (profile) => {
			const patient = profile.user;
			const nutritionistId = profile.nutritionistId || userId;
			const [latestMessage, unreadCount] = await Promise.all([
				this.repository.findLatestMessage(patient.id, nutritionistId),
				this.repository.countUnreadMessages(
					user.profile === ROLES.NUTRITIONIST ? patient.id : nutritionistId,
					userId,
				),
			]);

			return {
				id: patient.id,
				patient: {
					id: patient.id,
					name: patient.name,
					email: patient.email,
					profilePhotoUrl: patient.profilePhotoUrl || null,
				},
				lastMessage: latestMessage ? this.presentMessage(latestMessage) : null,
				unreadCount,
			};
		}));
	}

	async getConversationMessages(userId, conversationId, query = {}) {
		if (typeof conversationId !== 'string' || !conversationId.trim()) {
			throw new AppError('Informe uma conversa valida.', 400);
		}
		const currentUser = await this.repository.findUserById(userId);
		if (!currentUser || ![ROLES.PATIENT, ROLES.NUTRITIONIST].includes(currentUser.profile)) {
			throw new AppError('Voce nao tem permissao para acessar conversas.', 403);
		}

		const patientId = conversationId.trim();
		let nutritionistId;
		if (currentUser.profile === ROLES.NUTRITIONIST) {
			nutritionistId = userId;
		} else {
			if (patientId !== userId) {
				throw new AppError('Conversa nao encontrada.', 403);
			}
			const patientProfile = await this.repository.findPatientProfile(userId);
			nutritionistId = patientProfile?.nutritionistId;
		}
		if (!nutritionistId) {
			throw new AppError('Conversa nao encontrada.', 403);
		}
		await this.getAuthorizedPair(userId, currentUser.profile === ROLES.NUTRITIONIST ? patientId : nutritionistId);

		const page = query.page === undefined ? 1 : Number(query.page);
		const limit = query.limit === undefined ? 50 : Number(query.limit);
		if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
			throw new AppError('Paginacao invalida. Use page >= 1 e limit entre 1 e 100.', 400);
		}

		const [total, unreadCount] = await Promise.all([
			this.repository.countConversationMessages(patientId, nutritionistId),
			this.repository.countUnreadMessages(
				currentUser.profile === ROLES.NUTRITIONIST ? patientId : nutritionistId,
				userId,
			),
		]);
		await this.repository.markMessagesRead(
			currentUser.profile === ROLES.NUTRITIONIST ? patientId : nutritionistId,
			userId,
			new Date(),
		);

		const pageCount = Math.max(1, Math.ceil(total / limit));
		const safePage = Math.min(page, pageCount);
		const records = await this.repository.findConversationMessagesPage(
			patientId,
			nutritionistId,
			(safePage - 1) * limit,
			limit,
		);

		return {
			conversationId: patientId,
			messages: records.reverse().map((message) => this.presentMessage(message)),
			pagination: { page: safePage, limit, total, totalPages: pageCount },
			unreadCount,
		};
	}

	presentMessage(message) {
		return {
			id: message.id,
			senderId: message.senderId,
			recipientId: message.recipientId,
			content: message.content,
			status: message.status,
			readAt: message.readAt,
			createdAt: message.createdAt,
			senderRole: message.sender.profile,
			senderName: message.sender.name,
			timeLabel: new Intl.DateTimeFormat('pt-BR', {
				hour: '2-digit',
				minute: '2-digit',
			}).format(message.createdAt),
		};
	}

	async sendPatientMessage(patientId, payload) {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			throw new AppError('Informe os dados da mensagem em um objeto.', 400);
		}
		if (Object.keys(payload).some((field) => field !== 'content')) {
			throw new AppError('Campo nao reconhecido no envio da mensagem.', 400);
		}

		const profile = await this.repository.findPatientProfile(patientId);
		if (!profile?.nutritionistId) {
			throw new AppError('Conecte sua conta a um nutricionista antes de usar o chat.', 403);
		}

		return this.sendMessage(patientId, {
			recipientId: profile.nutritionistId,
			content: payload.content,
		});
	}

	async getConversation(userId, recipientId) {
		if (typeof recipientId !== 'string' || !recipientId.trim()) {
			throw new AppError('Informe o destinatario da conversa.', 400);
		}

		recipientId = recipientId.trim();
		if (recipientId === userId) {
			throw new AppError('Nao e permitido acessar uma conversa consigo mesmo.', 400);
		}

		const { link } = await this.getAuthorizedPair(userId, recipientId);
		const pendingMessages = await this.repository.countUnreadMessages(recipientId, userId);
		await this.repository.markMessagesRead(recipientId, userId, new Date());
		const records = await this.repository.findConversationMessages(userId, recipientId);
		const messages = records.map((message) => ({
			id: message.id,
			senderId: message.senderId,
			recipientId: message.recipientId,
			content: message.content,
			status: message.status,
			readAt: message.readAt,
			createdAt: message.createdAt,
			senderRole: message.sender.profile,
			senderName: message.sender.name,
			timeLabel: new Intl.DateTimeFormat('pt-BR', {
				hour: '2-digit',
				minute: '2-digit',
			}).format(message.createdAt),
			pending: message.sender.profile === ROLES.PATIENT && message.status === 'UNREAD',
		}));
		const latestMessage = records[records.length - 1];
		const patient = link.user.id === userId ? link.nutritionist : link.user;
		const conversation = {
			patient: {
				id: patient.id,
				name: patient.name,
				pendingMessages,
				latestMessageTime: latestMessage
					? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(latestMessage.createdAt)
					: '',
			},
			messages,
		};

		return {
			conversation,
			chat: {
				responseTimeLabel: messages.length ? 'Conversa ativa' : 'Sem mensagens',
				quickReplies: [],
				messages,
			},
		};
	}
}

module.exports = { ChatService, MAX_MESSAGE_LENGTH };