const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createPatientRoutes(patientController, authenticate) {
	const router = express.Router();

	router.post(
		'/me/nutritionist',
		authenticate,
		authorize('POST /api/patients/me/nutritionist'),
		asyncHandler(patientController.setNutritionist.bind(patientController)),
	);

	return router;
}

module.exports = {
	createPatientRoutes,
};
