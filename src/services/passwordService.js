const crypto = require('crypto');

class PasswordService {
	hash(password, salt = crypto.randomBytes(16).toString('hex')) {
		const hash = crypto.scryptSync(password, salt, 64).toString('hex');
		return `${salt}:${hash}`;
	}

	verify(password, storedPassword) {
		const [salt, originalHash] = String(storedPassword || '').split(':');

		if (!salt || !originalHash) {
			return false;
		}

		const candidateHash = crypto.scryptSync(password, salt, 64).toString('hex');
		const originalBuffer = Buffer.from(originalHash, 'hex');
		const candidateBuffer = Buffer.from(candidateHash, 'hex');

		if (originalBuffer.length !== candidateBuffer.length) {
			return false;
		}

		return crypto.timingSafeEqual(originalBuffer, candidateBuffer);
	}
}

module.exports = {
	PasswordService,
};
