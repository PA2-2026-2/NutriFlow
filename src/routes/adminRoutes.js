const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createAdminRoutes(adminController, authenticate) {
	const router = express.Router();

	router.use(authenticate);

	router.get('/summary', authorize('GET /api/admin/summary'), asyncHandler(adminController.getSummary.bind(adminController)));
	router.get('/foods', authorize('GET /api/admin/foods'), asyncHandler(adminController.listFoods.bind(adminController)));
	router.post('/foods', authorize('POST /api/admin/foods'), asyncHandler(adminController.createFood.bind(adminController)));
	router.delete('/foods/:foodId', authorize('DELETE /api/admin/foods/:foodId'), asyncHandler(adminController.deleteFood.bind(adminController)));
	router.get('/users', authorize('GET /api/admin/users'), asyncHandler(adminController.getUsers.bind(adminController)));
	router.put('/users/:userId', authorize('PUT /api/admin/users/:userId'), asyncHandler(adminController.updateUser.bind(adminController)));
	router.patch('/users/:userId/status', authorize('PATCH /api/admin/users/:userId/status'), asyncHandler(adminController.updateUserStatus.bind(adminController)));
	router.delete('/users/:userId', authorize('DELETE /api/admin/users/:userId'), asyncHandler(adminController.deleteUser.bind(adminController)));

	return router;
}

module.exports = {
	createAdminRoutes,
};
