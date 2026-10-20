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


function createAuthMiddleware(supabaseAuthClient, userRepository) {
  return async function authenticate(request, response, next) {
    try {
      const token = extractToken(request);

      if (!token) {
        throw new AppError('Token de acesso nao informado.', 401);
      }

      if (!supabaseAuthClient) {
        throw new AppError('Autenticação indisponível. Configure o Supabase Auth.', 503);
      }

      const { data, error } = await supabaseAuthClient.auth.getUser(token);
      if (error) {
        if ([401, 403].includes(error.status)) {
          throw new AppError('Token invalido ou expirado.', 401);
        }

        throw new AppError('Não foi possível validar a sessão. Tente novamente.', 503);
      }

      const authUser = data?.user;
      if (!authUser?.id || !authUser.email_confirmed_at) {
        throw new AppError('Confirme seu e-mail antes de acessar esta área.', 401);
      }

      const user =
        (await userRepository.findByAuthUserId(authUser.id)) ||
        (await userRepository.findById(authUser.id));

      if (!user) {
        throw new AppError('Perfil NutriFlow não encontrado para esta conta.', 401);
      }

      if (String(user.email).toLowerCase() !== String(authUser.email || '').toLowerCase()) {
        throw new AppError('Sessão inválida. Faça login novamente.', 401);
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
