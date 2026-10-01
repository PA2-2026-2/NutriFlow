const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createAdminRoutes(adminController, authenticate) {
	const router = express.Router();

	router.use(authenticate);

	router.get('/users', authorize('GET /api/admin/users'), asyncHandler(adminController.getUsers.bind(adminController)));
	router.put('/users/:userId', authorize('PUT /api/admin/users/:userId'), asyncHandler(adminController.updateUser.bind(adminController)));
	router.patch('/users/:userId/status', authorize('PATCH /api/admin/users/:userId/status'), asyncHandler(adminController.updateUserStatus.bind(adminController)));
	router.delete('/users/:userId', authorize('DELETE /api/admin/users/:userId'), asyncHandler(adminController.deleteUser.bind(adminController)));

	return router;
}

module.exports = {
	createAdminRoutes,
};
