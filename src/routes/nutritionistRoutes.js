const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createNutritionistRoutes(patientController, authenticate) {
	const router = express.Router();

	router.get(
		'/patients',
		authenticate,
		authorize('GET /api/nutritionist/patients'),
		asyncHandler(patientController.getLinkedPatients.bind(patientController)),
	);

	router.post(
		'/link-patient',
		authenticate,
		authorize('POST /api/nutritionist/link-patient'),
		asyncHandler(patientController.linkPatient.bind(patientController)),
	);

	return router;
}

module.exports = {
	createNutritionistRoutes,
};