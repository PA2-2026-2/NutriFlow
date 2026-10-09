const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createPatientDashboardRoutes(controller, authenticate) {
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

	return router;
}

module.exports = { createPatientDashboardRoutes };
