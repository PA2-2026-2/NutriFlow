const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createNutritionistRoutes(patientController, mealPlanController, challengeController, authenticate) {
	const router = express.Router();
	router.use(authenticate);

	router.get(
		'/patients',
		authorize('GET /api/nutritionist/patients'),
		asyncHandler(patientController.getLinkedPatients.bind(patientController)),
	);

	router.post(
		'/link-patient',
		authorize('POST /api/nutritionist/link-patient'),
		asyncHandler(patientController.linkPatient.bind(patientController)),
	);

	router.get(
		'/foods',
		authorize('GET /api/nutritionist/foods'),
		asyncHandler(mealPlanController.listFoods.bind(mealPlanController)),
	);

	router.get(
		'/meal-plans',
		authorize('GET /api/nutritionist/meal-plans'),
		asyncHandler(mealPlanController.list.bind(mealPlanController)),
	);

	router.post(
		'/meal-plans',
		authorize('POST /api/nutritionist/meal-plans'),
		asyncHandler(mealPlanController.create.bind(mealPlanController)),
	);

	router.get(
		'/challenges',
		authorize('GET /api/nutritionist/challenges'),
		asyncHandler(challengeController.list.bind(challengeController)),
	);

	router.post(
		'/challenges',
		authorize('POST /api/nutritionist/challenges'),
		asyncHandler(challengeController.create.bind(challengeController)),
	);

	router.put(
		'/challenges/:challengeId',
		authorize('PUT /api/nutritionist/challenges/:challengeId'),
		asyncHandler(challengeController.update.bind(challengeController)),
	);

	router.patch(
		'/challenges/:challengeId',
		authorize('PATCH /api/nutritionist/challenges/:challengeId'),
		asyncHandler(challengeController.update.bind(challengeController)),
	);

	router.delete(
		'/challenges/:challengeId',
		authorize('DELETE /api/nutritionist/challenges/:challengeId'),
		asyncHandler(challengeController.remove.bind(challengeController)),
	);

	router.post(
		'/challenges/:challengeId/participants',
		authorize('POST /api/nutritionist/challenges/:challengeId/participants'),
		asyncHandler(challengeController.addParticipant.bind(challengeController)),
	);

	return router;
}

module.exports = {
	createNutritionistRoutes,
};