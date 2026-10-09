const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createPatientRoutes(patientController, authenticate) {
	const router = express.Router();
	router.use(authenticate);
	router.post(
		'/me/nutritionist',
		authorize('POST /api/patients/me/nutritionist'),
		asyncHandler(patientController.linkNutritionist.bind(patientController)),
	);
	router.post(
		'/:id/measurements',
		authorize('POST /api/patients/:id/measurements'),
		asyncHandler(patientController.recordMeasurement.bind(patientController)),
	);
	router.get(
		'/:id/measurements',
		authorize('GET /api/patients/:id/measurements'),
		asyncHandler(patientController.getMeasurements.bind(patientController)),
	);
	return router;
}

module.exports = {
	createPatientRoutes,
};
