const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createChatRoutes(chatController, authenticate, routePrefix) {
	const router = express.Router();
	router.get(
		'/conversations',
		authenticate,
		authorize(`GET ${routePrefix}/conversations`),
		asyncHandler(chatController.listConversations.bind(chatController)),
	);
	router.get(
		'/conversations/:conversationId/messages',
		authenticate,
		authorize(`GET ${routePrefix}/conversations/:conversationId/messages`),
		asyncHandler(chatController.getConversationMessages.bind(chatController)),
	);
	router.get(
		'/messages',
		authenticate,
		authorize(`GET ${routePrefix}/messages`),
		asyncHandler(chatController.getMessages.bind(chatController)),
	);
	router.get(
		'/messages/:messageId/audio',
		authenticate,
		authorize(`GET ${routePrefix}/messages/:messageId/audio`),
		asyncHandler(chatController.getMessageAudio.bind(chatController)),
	);
	router.post(
		'/messages',
		authenticate,
		authorize(`POST ${routePrefix}/messages`),
		asyncHandler(chatController.sendMessage.bind(chatController)),
	);
	return router;
}

module.exports = { createChatRoutes };