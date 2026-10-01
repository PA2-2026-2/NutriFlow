const crypto = require('crypto');

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24;


class SessionService {
  constructor() {
    this.revokedTokens = new Map();
  }

  fingerprint(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  revoke(token, expiresAt) {
    this.purgeExpired();

    const expiration = Number(expiresAt) || Date.now() + DEFAULT_TTL_MS;
    this.revokedTokens.set(this.fingerprint(token), expiration);
  }

  isRevoked(token) {
    const key = this.fingerprint(token);
    const expiration = this.revokedTokens.get(key);

    if (expiration === undefined) {
      return false;
    }

    if (expiration < Date.now()) {
      this.revokedTokens.delete(key);
      return false;
    }

    return true;
  }

  purgeExpired() {
    const now = Date.now();

    for (const [key, expiration] of this.revokedTokens) {
      if (expiration < now) {
        this.revokedTokens.delete(key);
      }
    }
  }
}

module.exports = {
  SessionService,
};
