const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createPatientDashboardRoutes(controller, chatController, authenticate) {
	const router = express.Router();
	router.use(authenticate);

	router.get(
		'/dashboard',
		authorize('GET /api/patient/dashboard'),
		asyncHandler(controller.getDashboard.bind(controller)),
	);
	router.post(
		'/meals',
		authorize('POST /api/patient/meals'),
		asyncHandler(controller.createMeal.bind(controller)),
	);
	router.post(
		'/weights',
		authorize('POST /api/patient/weights'),
		asyncHandler(controller.createWeight.bind(controller)),
	);
	router.get(
		'/chat',
		authorize('GET /api/patient/chat'),
		asyncHandler(chatController.getPatientChat.bind(chatController)),
	);
	router.post(
		'/messages',
		authorize('POST /api/patient/messages'),
		asyncHandler(chatController.sendPatientMessage.bind(chatController)),
	);

	return router;
}

module.exports = { createPatientDashboardRoutes };
