const { AppError } = require('../errors/appError');

function extractToken(request) {
  const header = request.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function createAuthMiddleware(tokenService, tokenBlacklistService) {
  return function authenticate(request, response, next) {
    const token = extractToken(request);

    if (!token) {
      next(new AppError('Token de acesso nao informado.', 401));
      return;
    }

    if (tokenBlacklistService.isRevoked(token)) {
      next(new AppError('Sessao encerrada. Faca login novamente.', 401));
      return;
    }

    const payload = tokenService.verify(token);

    if (!payload) {
      next(new AppError('Token de acesso invalido ou expirado.', 401));
      return;
    }

    request.user = payload;
    request.token = token;
    next();
  };
}

function requireRole(...allowedRoles) {
  return function authorize(request, response, next) {
    if (!request.user) {
      next(new AppError('Token de acesso nao informado.', 401));
      return;
    }

    if (!allowedRoles.includes(request.user.profile)) {
      next(new AppError('Voce nao tem permissao para acessar este recurso.', 403));
      return;
    }

    next();
  };
}

module.exports = {
  extractToken,
  createAuthMiddleware,
  requireRole,
};