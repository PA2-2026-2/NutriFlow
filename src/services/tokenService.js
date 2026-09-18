const crypto = require('crypto');

class TokenService {
	constructor(secret) {
		this.secret = secret;
	}

	create(user) {
		const payload = Buffer.from(
			JSON.stringify({
				sub: user.id,
				email: user.email,
				profile: user.profile,
				exp: Date.now() + 1000 * 60 * 60 * 24,
			}),
			'utf-8',
		).toString('base64url');

		const signature = crypto
			.createHmac('sha256', this.secret)
			.update(payload)
			.digest('base64url');

		return `${payload}.${signature}`;
	}

	verify(token) {
		const [payload, signature] = String(token || '').split('.');

		if (!payload || !signature) {
			return null;
		}

		const expectedSignature = crypto
			.createHmac('sha256', this.secret)
			.update(payload)
			.digest('base64url');

		const signatureBuffer = Buffer.from(signature);
		const expectedBuffer = Buffer.from(expectedSignature);

		if (signatureBuffer.length !== expectedBuffer.length) {
			return null;
		}

		if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
			return null;
		}

		try {
			const decoded = JSON.parse(
				Buffer.from(payload, 'base64url').toString('utf-8'),
			);

			if (!decoded.exp || decoded.exp < Date.now()) {
				return null;
			}

			return decoded;
		} catch (error) {
			return null;
		}
	}
}

module.exports = {
	TokenService,
};
