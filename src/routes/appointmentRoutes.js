const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createAppointmentRoutes(controller, authenticate) {
	const router = express.Router();

	router.get(
		'/',
		authenticate,
		authorize('GET /api/appointments'),
		asyncHandler(controller.list.bind(controller)),
	);
	router.post(
		'/',
		authenticate,
		authorize('POST /api/appointments'),
		asyncHandler(controller.create.bind(controller)),
	);
	router.put(
		'/:id',
		authenticate,
		authorize('PUT /api/appointments/:id'),
		asyncHandler(controller.update.bind(controller)),
	);

	return router;
}

module.exports = { createAppointmentRoutes };
