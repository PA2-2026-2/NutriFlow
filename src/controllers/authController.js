const { extractToken } = require('../middlewares/authMiddleware');

function getSameOrigin(request) {
	const origin = request.get('origin');
	const host = request.get('host');
	const protocol = request.get('x-forwarded-proto')
		?.split(',')[0]
		.trim() || request.protocol;

	if (!origin || !host || !['http', 'https'].includes(protocol)) {
		return null;
	}

	try {
		const parsedOrigin = new URL(origin);
		const requestOrigin = new URL(`${protocol}://${host}`).origin;
		return parsedOrigin.origin === requestOrigin ? parsedOrigin.origin : null;
	} catch {
		return null;
	}
}

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
		const result = await this.authService.requestPasswordReset(
			request.body || {},
			getSameOrigin(request),
		);
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
