const { AppError } = require('../errors/appError');
const { getAllowedRoles } = require('../constants/permissions');

function extractToken(request) {
  const header = request.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}


function createAuthMiddleware(tokenService, tokenBlacklistService, userRepository) {
  return async function authenticate(request, response, next) {
    try {
      const token = extractToken(request);

      if (!token) {
        throw new AppError('Token de acesso nao informado.', 401);
      }

      if (tokenBlacklistService.isRevoked(token)) {
        throw new AppError('DEBUG_BLACKLIST', 401);
      }

      const payload = tokenService.verify(token);

      if (!payload) {
        throw new AppError('DEBUG_TOKEN_INVALIDO', 401);
      }

      const user = await userRepository.findById(payload.sub);

      if (!user) {
        throw new AppError('DEBUG_USUARIO_NAO_ENCONTRADO', 401);
      }

      if (!user.isActive) {
        throw new AppError(
          'Sua conta esta bloqueada. Procure o administrador da plataforma.',
          403,
        );
      }

      request.user = {
        sub: user.id,
        email: user.email,
        profile: user.profile,
      };
      request.token = token;
      next();
    } catch (error) {
      next(error);
    }
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


function authorize(routeKey) {
  return requireRole(...getAllowedRoles(routeKey));
}

module.exports = {
  extractToken,
  createAuthMiddleware,
  requireRole,
  authorize,
};
