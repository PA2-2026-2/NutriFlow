class ChatRepository {
	constructor(prisma) {
		this.prisma = prisma;
	}

	findUserById(id) {
		return this.prisma.user.findUnique({
			where: { id },
			select: { id: true, name: true, profile: true, isActive: true },
		});
	}

	findActiveLink(firstUserId, secondUserId) {
		return this.prisma.patientProfile.findFirst({
			where: {
				OR: [
					{ userId: firstUserId, nutritionistId: secondUserId },
					{ userId: secondUserId, nutritionistId: firstUserId },
				],
			},
			include: {
				user: { select: { id: true, name: true, profile: true, isActive: true } },
				nutritionist: { select: { id: true, name: true, profile: true, isActive: true } },
			},
		});
	}

	findPatientProfile(userId) {
		return this.prisma.patientProfile.findUnique({
			where: { userId },
			select: { nutritionistId: true },
		});
	}

	findLinkedPatients(nutritionistId) {
		return this.prisma.patientProfile.findMany({
			where: {
				nutritionistId,
				user: { isActive: true },
			},
			include: {
				user: { select: { id: true, name: true, email: true, profilePhotoUrl: true } },
			},
			orderBy: { user: { name: 'asc' } },
		});
	}

	findLatestMessage(firstUserId, secondUserId) {
		return this.prisma.chatMessage.findFirst({
			where: {
				OR: [
					{ senderId: firstUserId, recipientId: secondUserId },
					{ senderId: secondUserId, recipientId: firstUserId },
				],
			},
			select: {
				id: true,
				senderId: true,
				recipientId: true,
				content: true,
				type: true,
				audioMimeType: true,
				audioDurationSeconds: true,
				transcript: true,
				status: true,
				createdAt: true,
				readAt: true,
				sender: { select: { name: true, profile: true } },
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		});
	}

	countConversationMessages(firstUserId, secondUserId) {
		return this.prisma.chatMessage.count({
			where: {
				OR: [
					{ senderId: firstUserId, recipientId: secondUserId },
					{ senderId: secondUserId, recipientId: firstUserId },
				],
			},
		});
	}

	findConversationMessagesPage(firstUserId, secondUserId, skip, take) {
		return this.prisma.chatMessage.findMany({
			where: {
				OR: [
					{ senderId: firstUserId, recipientId: secondUserId },
					{ senderId: secondUserId, recipientId: firstUserId },
				],
			},
			select: {
				id: true,
				senderId: true,
				recipientId: true,
				content: true,
				type: true,
				audioMimeType: true,
				audioDurationSeconds: true,
				transcript: true,
				status: true,
				createdAt: true,
				readAt: true,
				sender: { select: { name: true, profile: true } },
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			skip,
			take,
		});
	}

	findConversationMessages(firstUserId, secondUserId) {
		return this.prisma.chatMessage.findMany({
			where: {
				OR: [
					{ senderId: firstUserId, recipientId: secondUserId },
					{ senderId: secondUserId, recipientId: firstUserId },
				],
			},
			select: {
				id: true,
				senderId: true,
				recipientId: true,
				content: true,
				type: true,
				audioMimeType: true,
				audioDurationSeconds: true,
				transcript: true,
				status: true,
				createdAt: true,
				readAt: true,
				sender: { select: { name: true, profile: true } },
			},
			orderBy: { createdAt: 'asc' },
		});
	}

	countUnreadMessages(senderId, recipientId) {
		return this.prisma.chatMessage.count({
			where: { senderId, recipientId, status: 'UNREAD' },
		});
	}

	markMessagesRead(senderId, recipientId, readAt) {
		return this.prisma.chatMessage.updateMany({
			where: { senderId, recipientId, status: 'UNREAD' },
			data: { status: 'READ', readAt },
		});
	}

	createMessage(data) {
		return this.prisma.chatMessage.create({
			data,
			select: {
				id: true,
				senderId: true,
				recipientId: true,
				content: true,
				type: true,
				audioMimeType: true,
				audioDurationSeconds: true,
				transcript: true,
				status: true,
				createdAt: true,
				readAt: true,
			},
		});
	}

	findMessageAudio(id) {
		return this.prisma.chatMessage.findUnique({
			where: { id },
			select: {
				senderId: true,
				recipientId: true,
				audioData: true,
				audioMimeType: true,
			},
		});
	}
}

module.exports = { ChatRepository };