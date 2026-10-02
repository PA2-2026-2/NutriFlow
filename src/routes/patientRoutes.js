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
	return router;
}

module.exports = {
	createPatientRoutes,
};
