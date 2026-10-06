const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createNutritionistRoutes(patientController, mealPlanController, authenticate) {
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

	router.get(
		'/foods',
		authenticate,
		authorize('GET /api/nutritionist/foods'),
		asyncHandler(mealPlanController.listFoods.bind(mealPlanController)),
	);

	router.get(
		'/meal-plans',
		authenticate,
		authorize('GET /api/nutritionist/meal-plans'),
		asyncHandler(mealPlanController.list.bind(mealPlanController)),
	);

	router.post(
		'/meal-plans',
		authenticate,
		authorize('POST /api/nutritionist/meal-plans'),
		asyncHandler(mealPlanController.create.bind(mealPlanController)),
	);

	return router;
}

module.exports = {
	createNutritionistRoutes,
};