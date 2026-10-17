class ChatController {
	constructor(chatService) {
		this.chatService = chatService;
	}

	async sendMessage(request, response) {
		const message = await this.chatService.sendMessage(
			request.user.sub,
			request.body,
		);
		response.status(201).json({ message });
	}

	async getMessages(request, response) {
		const result = await this.chatService.getConversation(
			request.user.sub,
			request.query.recipientId,
		);
		response.status(200).json(result);
	}

	async listConversations(request, response) {
		const conversations = await this.chatService.listConversations(request.user.sub);
		response.status(200).json({ conversations });
	}

	async getConversationMessages(request, response) {
		const result = await this.chatService.getConversationMessages(
			request.user.sub,
			request.params.conversationId,
			request.query,
		);
		response.status(200).json(result);
	}

	async getPatientChat(request, response) {
		const result = await this.chatService.getPatientConversation(request.user.sub);
		response.status(200).json({ chat: result.chat });
	}

	async sendPatientMessage(request, response) {
		const message = await this.chatService.sendPatientMessage(
			request.user.sub,
			request.body,
		);
		response.status(201).json({ message });
	}
}

module.exports = { ChatController };