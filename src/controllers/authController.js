const { extractToken } = require('../middlewares/authMiddleware');

class AuthController {
	constructor(authService) {
		this.authService = authService;
	}

	async register(request, response) {
		const result = await this.authService.register(request.body || {});
		response.status(201).json(result);
	}

	async login(request, response) {
		const result = await this.authService.login(request.body || {});
		response.status(200).json(result);
	}

	async logout(request, response) {
		const token = request.token || extractToken(request);
		const result = await this.authService.logout(token);
		response.status(200).json(result);
	}

	async me(request, response) {
		const result = await this.authService.me(request.user.sub);
		response.status(200).json(result);
	}
}

module.exports = {
	AuthController,
};
