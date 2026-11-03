const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createNutritionistRoutes(
	patientController,
	mealPlanController,
	challengeController,
	authenticate,
	routePrefix = '/api/nutritionist',
) {
	const router = express.Router();
	router.use(authenticate);

	router.get(
		'/patients',
		authorize(`GET ${routePrefix}/patients`),
		asyncHandler(patientController.getLinkedPatients.bind(patientController)),
	);

	router.post(
		'/link-patient',
		authorize(`POST ${routePrefix}/link-patient`),
		asyncHandler(patientController.linkPatient.bind(patientController)),
	);

	router.get(
		'/foods',
		authorize(`GET ${routePrefix}/foods`),
		asyncHandler(mealPlanController.listFoods.bind(mealPlanController)),
	);

	router.get(
		'/meal-plans',
		authorize(`GET ${routePrefix}/meal-plans`),
		asyncHandler(mealPlanController.list.bind(mealPlanController)),
	);

	router.post(
		'/meal-plans',
		authorize(`POST ${routePrefix}/meal-plans`),
		asyncHandler(mealPlanController.create.bind(mealPlanController)),
	);

	router.get(
		'/challenges',
		authorize(`GET ${routePrefix}/challenges`),
		asyncHandler(challengeController.list.bind(challengeController)),
	);

	router.post(
		'/challenges',
		authorize(`POST ${routePrefix}/challenges`),
		asyncHandler(challengeController.create.bind(challengeController)),
	);

	router.put(
		'/challenges/:challengeId',
		authorize(`PUT ${routePrefix}/challenges/:challengeId`),
		asyncHandler(challengeController.update.bind(challengeController)),
	);

	router.patch(
		'/challenges/:challengeId',
		authorize(`PATCH ${routePrefix}/challenges/:challengeId`),
		asyncHandler(challengeController.update.bind(challengeController)),
	);

	router.delete(
		'/challenges/:challengeId',
		authorize(`DELETE ${routePrefix}/challenges/:challengeId`),
		asyncHandler(challengeController.remove.bind(challengeController)),
	);

	router.post(
		'/challenges/:challengeId/participants',
		authorize(`POST ${routePrefix}/challenges/:challengeId/participants`),
		asyncHandler(challengeController.addParticipant.bind(challengeController)),
	);

	return router;
}

module.exports = {
	createNutritionistRoutes,
};