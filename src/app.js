const express = require('express');
const path = require('path');

const { config } = require('./config');
const { createPrismaClient } = require('./infra/database');
const { errorHandler } = require('./middlewares/errorHandler');

const { AuthController } = require('./controllers/authController');
const { UserRepository } = require('./repositories/userRepository');

const { AuthService } = require('./services/authService');
const { PasswordService } = require('./services/passwordService');
const { TokenService } = require('./services/tokenService');

const { createAuthRoutes } = require('./routes/authRoutes');

const FRONTEND_ROUTE_ALIASES = new Map([
  ['/home', '/index.html'],
  ['/home/', '/index.html'],
  ['/home/index.html', '/index.html'],
  ['/home/styles.css', '/styles.css'],
  ['/home/scripts.js', '/scripts.js'],
  ['/home/api.js', '/api.js'],
  ['/home/ui.js', '/ui.js'],
  ['/dashboard', '/dashboard.html'],
  ['/dashboard/', '/dashboard.html'],
  ['/dashboard-nutricionista', '/dashboard-nutricionista.html'],
  ['/dashboard-nutricionista/', '/dashboard-nutricionista.html'],
  ['/dashboard-admin', '/dashboard-admin.html'],
  ['/dashboard-admin/', '/dashboard-admin.html'],
  ['/Nutricionista/dashboard-nutricionista.html', '/dashboard-nutricionista.html'],
  ['/Nutricionista/dashboard-nutricionista.js', '/dashboard-nutricionista.js'],
  ['/nutricionista/dashboard-nutricionista.html', '/dashboard-nutricionista.html'],
  ['/nutricionista/dashboard-nutricionista.js', '/dashboard-nutricionista.js'],
]);

function cors(request, response, next) {
  response.setHeader(
    'Access-Control-Allow-Origin',
    request.headers.origin || '*'
  );

  response.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PATCH,DELETE,OPTIONS'
  );

  response.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  response.setHeader('Vary', 'Origin');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  next();
}

function frontendAliases(request, response, next) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return next();
  }

  const alias = FRONTEND_ROUTE_ALIASES.get(request.path);

  if (!alias) {
    return next();
  }

  const query = request.originalUrl.includes('?')
    ? request.originalUrl.slice(request.originalUrl.indexOf('?'))
    : '';

  response.redirect(302, `${alias}${query}`);
}

function createDependencies(appConfig, overrides = {}) {
  const prisma =
    overrides.prisma ||
    createPrismaClient(appConfig.databaseUrl);

  const repository = new UserRepository(prisma);
  const passwordService = new PasswordService();
  const tokenService = new TokenService(appConfig.tokenSecret);

  const authService = new AuthService(
    repository,
    passwordService,
    tokenService
  );

  return {
    prisma,
    authController: new AuthController(authService),
  };
}

function createApp(options = {}) {
  const appConfig = {
    ...config,
    ...(options.config || {}),
  };

  const { prisma, authController } =
    createDependencies(appConfig, options);

  const app = express();
  const frontendDir = appConfig.frontendDir;

  app.disable('x-powered-by');
  app.locals.config = appConfig;
  app.locals.prisma = prisma;

  app.use(cors);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', async (request, response, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      response.json({
        status: 'OK',
        environment: appConfig.nodeEnv || 'development',
        database: 'connected',
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(
    '/api/auth',
    createAuthRoutes(authController)
  );

  app.use(frontendAliases);
  app.use(express.static(frontendDir));

  app.get('/', (request, response) => {
    response.sendFile(
      path.join(frontendDir, 'index.html')
    );
  });

  app.use('/api', (request, response) => {
    response.status(404).json({
      message: 'Rota da API nao encontrada.',
    });
  });

  app.use((request, response) => {
    response.status(404).json({
      message: 'Recurso nao encontrado.',
    });
  });

  app.use(errorHandler);

  app.start = (
    port = appConfig.port,
    host = appConfig.host
  ) => {
    const server = app.listen(port, host, () => {
      console.log(
        `NutriFlow rodando em http://${host}:${port}`
      );
    });

    app.locals.server = server;
    return server;
  };

  app.stop = () =>
    new Promise((resolve, reject) => {
      const closeDatabase = () =>
        prisma.$disconnect()
          .then(resolve)
          .catch(reject);

      if (!app.locals.server) {
        return closeDatabase();
      }

      app.locals.server.close((error) => {
        if (error) {
          return reject(error);
        }

        closeDatabase();
      });
    });

  return app;
}

module.exports = { createApp };
