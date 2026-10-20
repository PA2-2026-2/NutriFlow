const { extractToken } = require('../middlewares/authMiddleware');

class AuthController {
	constructor(authService) {
		this.authService = authService;
	}

	async register(request, response) {
		const result = await this.authService.register(request.body || {});
		response.status(202).json(result);
	}

	async login(request, response) {
		const result = await this.authService.login(request.body || {});
		response.status(200).json(result);
	}

	async requestPasswordReset(request, response) {
		const result = await this.authService.requestPasswordReset(request.body || {});
		response.status(200).json(result);
	}

	async resendConfirmation(request, response) {
		const result = await this.authService.resendConfirmation(request.body || {});
		response.status(200).json(result);
	}

	config(request, response) {
		response.status(200).json(this.authService.getPublicConfig());
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
