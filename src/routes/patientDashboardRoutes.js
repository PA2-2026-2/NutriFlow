const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createPatientDashboardRoutes(controller, chatController, challengeController, authenticate) {
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
	router.get(
		'/challenges',
		authorize('GET /api/patient/challenges'),
		asyncHandler(challengeController.listForPatient.bind(challengeController)),
	);
	router.post(
		'/challenges/:challengeId/enroll',
		authorize('POST /api/patient/challenges/:challengeId/enroll'),
		asyncHandler(challengeController.enroll.bind(challengeController)),
	);
	router.get(
		'/challenges/:challengeId/checkins',
		authorize('GET /api/patient/challenges/:challengeId/checkins'),
		asyncHandler(challengeController.getCheckIns.bind(challengeController)),
	);
	router.post(
		'/challenges/:challengeId/checkins',
		authorize('POST /api/patient/challenges/:challengeId/checkins'),
		asyncHandler(challengeController.createCheckIn.bind(challengeController)),
	);
	router.patch(
		'/challenges/:challengeId/complete',
		authorize('PATCH /api/patient/challenges/:challengeId/complete'),
		asyncHandler(challengeController.complete.bind(challengeController)),
	);

	return router;
}

module.exports = { createPatientDashboardRoutes };
