const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createPatientRoutes(patientController, challengeController, authenticate) {
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
	router.put(
		'/:id/measurements/:measurementId',
		authorize('PUT /api/patients/:id/measurements/:measurementId'),
		asyncHandler(patientController.updateMeasurement.bind(patientController)),
	);
	router.patch(
		'/:id/measurements/:measurementId',
		authorize('PATCH /api/patients/:id/measurements/:measurementId'),
		asyncHandler(patientController.updateMeasurement.bind(patientController)),
	);
	router.delete(
		'/:id/measurements/:measurementId',
		authorize('DELETE /api/patients/:id/measurements/:measurementId'),
		asyncHandler(patientController.deleteMeasurement.bind(patientController)),
	);
	router.get(
		'/:id/measurements',
		authorize('GET /api/patients/:id/measurements'),
		asyncHandler(patientController.getMeasurements.bind(patientController)),
	);
	router.get(
		'/challenges',
		authorize('GET /api/patients/challenges'),
		asyncHandler(challengeController.listForPatient.bind(challengeController)),
	);
	router.post(
		'/challenges/:challengeId/enroll',
		authorize('POST /api/patients/challenges/:challengeId/enroll'),
		asyncHandler(challengeController.enroll.bind(challengeController)),
	);
	router.get(
		'/challenges/:challengeId/checkins',
		authorize('GET /api/patients/challenges/:challengeId/checkins'),
		asyncHandler(challengeController.getCheckIns.bind(challengeController)),
	);
	router.post(
		'/challenges/:challengeId/checkins',
		authorize('POST /api/patients/challenges/:challengeId/checkins'),
		asyncHandler(challengeController.createCheckIn.bind(challengeController)),
	);
	return router;
}

module.exports = {
	createPatientRoutes,
};
