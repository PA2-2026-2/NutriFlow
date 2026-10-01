const express = require('express');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { authorize } = require('../middlewares/authMiddleware');

function createAuthRoutes(authController, authenticate) {
	const router = express.Router();

	router.post(
		'/register',
		asyncHandler(authController.register.bind(authController)),
	);

	router.post(
		'/login',
		asyncHandler(authController.login.bind(authController)),
	);

	router.post(
		'/logout',
		asyncHandler(authController.logout.bind(authController)),
	);

	router.get(
		'/me',
		authenticate,
		authorize('GET /api/auth/me'),
		asyncHandler(authController.me.bind(authController)),
	);

	return router;
}

module.exports = {
	createAuthRoutes,
};
