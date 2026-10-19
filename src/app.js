const express = require('express');
const path = require('path');

const { config } = require('./config');
const { createPrismaClient } = require('./infra/database');
const { errorHandler } = require('./middlewares/errorHandler');
const { createAuthMiddleware } = require('./middlewares/authMiddleware');

const { AuthController } = require('./controllers/authController');
const { AdminController } = require('./controllers/adminController');
const { UserController } = require('./controllers/userController');
const { PatientController } = require('./controllers/patientController');
const { PatientDashboardController } = require('./controllers/patientDashboardController');
const { MealPlanController } = require('./controllers/mealPlanController');
const { ChatController } = require('./controllers/chatController');
const { UserRepository } = require('./repositories/userRepository');
const { AdminRepository } = require('./repositories/adminRepository');
const { ProfileRepository } = require('./repositories/profileRepository');
const { PatientDashboardRepository } = require('./repositories/patientDashboardRepository');
const { MealPlanRepository } = require('./repositories/mealPlanRepository');
const { ChatRepository } = require('./repositories/chatRepository');

const { AuthService } = require('./services/authService');
const { AdminService } = require('./services/adminService');
const { UserService } = require('./services/userService');
const { PatientService } = require('./services/patientService');
const { PatientDashboardService } = require('./services/patientDashboardService');
const { MealPlanService } = require('./services/mealPlanService');
const { ChatService } = require('./services/chatService');
const { SessionService } = require('./services/sessionService');
const { PasswordService } = require('./services/passwordService');
const { TokenService } = require('./services/tokenService');

const { createAuthRoutes } = require('./routes/authRoutes');
const { createAdminRoutes } = require('./routes/adminRoutes');
const { createUserRoutes } = require('./routes/userRoutes');
const { createPatientRoutes } = require('./routes/patientRoutes');
const { createPatientDashboardRoutes } = require('./routes/patientDashboardRoutes');
const { createNutritionistRoutes } = require('./routes/nutritionistRoutes');
const { createChatRoutes } = require('./routes/chatRoutes');
const { PhotoStorage } = require('./infra/photoStorage');

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
  ['/dashboard.html', '/dashboard.html'],
  ['/dashboard-nutricionista', '/dashboard-nutricionista.html'],
  ['/dashboard-nutricionista/', '/dashboard-nutricionista.html'],
  ['/dashboard-nutricionista.html', '/dashboard-nutricionista.html'],
  ['/dashboard-admin', '/dashboard-admin.html'],
  ['/dashboard-admin/', '/dashboard-admin.html'],
  ['/Nutricionista/dashboard-nutricionista.html', '/dashboard-nutricionista.html'],
  ['/Nutricionista/dashboard-nutricionista.js', '/dashboard-nutricionista.js'],
  ['/nutricionista/dashboard-nutricionista.html', '/dashboard-nutricionista.html'],
  ['/nutricionista/dashboard-nutricionista.js', '/dashboard-nutricionista.js'],
]);

function createCorsMiddleware(appConfig) {
  const allowedOrigins = new Set(appConfig.corsAllowedOrigins || []);

  function isSameOrigin(origin, requestOrigin) {
    try {
      return new URL(origin).origin === new URL(requestOrigin).origin;
    } catch {
      return false;
    }
  }

  return (request, response, next) => {
    const origin = request.headers.origin;
    const isDevelopment = appConfig.nodeEnv !== 'production';
    const forwardedProtocol = request.get('x-forwarded-proto')
      ?.split(',')[0]
      .trim();
    const requestProtocol = forwardedProtocol || request.protocol;
    const requestHost = request.get('host');
    const requestOrigin = requestHost
      ? `${requestProtocol}://${requestHost}`
      : '';

    response.setHeader('Vary', 'Origin');

    if (origin) {
      if (isDevelopment) {
        response.setHeader('Access-Control-Allow-Origin', '*');
      } else if (
        allowedOrigins.has(origin) ||
        (requestOrigin && isSameOrigin(origin, requestOrigin))
      ) {
        response.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        return response.status(403).json({ message: 'Origem não autorizada.' });
      }
    }

    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    );

    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );

    if (request.method === 'OPTIONS') {
      return response.status(204).end();
    }

    next();
  };
}

function frontendAliases(frontendDir) {
  return (request, response, next) => {
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

    if (request.path === '/dashboard/' || request.path === '/dashboard-nutricionista/') {
      return response.redirect(308, `${request.path.slice(0, -1)}${query}`);
    }

    if (
      request.path === '/dashboard.html' ||
      (alias === '/dashboard-nutricionista.html' &&
        request.path !== '/dashboard-nutricionista')
    ) {
      const cleanPath =
        request.path === '/dashboard.html' ? '/dashboard' : '/dashboard-nutricionista';
      return response.redirect(308, `${cleanPath}${query}`);
    }

    if (alias === '/dashboard.html' || alias === '/dashboard-nutricionista.html') {
      return response.sendFile(path.join(frontendDir, alias.slice(1)));
    }

    return response.redirect(302, `${alias}${query}`);
  };
}

function createDependencies(appConfig, overrides = {}) {
  const prisma =
    overrides.prisma ||
    createPrismaClient(appConfig.databaseUrl);

  const repository = new UserRepository(prisma);
  const profileRepository = new ProfileRepository(prisma);
  const passwordService = new PasswordService();
  const tokenService = new TokenService(appConfig.tokenSecret);

  const sessionService = new SessionService();

  const authService = new AuthService(
    repository,
    passwordService,
    tokenService,
    sessionService
  );

  const photoStorage =
    overrides.photoStorage ||
    new PhotoStorage({
      uploadsDir: appConfig.uploadsDir,
      enabled: appConfig.photoStorageProvider === 'local',
    });

  const adminService = new AdminService(
    new AdminRepository(prisma),
    photoStorage
  );

  const userService = new UserService(repository, photoStorage, {
    maxPhotoBytes: appConfig.maxPhotoSizeBytes,
    profileRepository,
  });

  const patientService = new PatientService(profileRepository, repository);
  const patientDashboardService = new PatientDashboardService(
    new PatientDashboardRepository(prisma),
  );
  const mealPlanService = new MealPlanService(
    new MealPlanRepository(prisma),
    profileRepository,
  );
  const chatService = new ChatService(new ChatRepository(prisma));

  return {
    prisma,
    authController: new AuthController(authService),
    adminController: new AdminController(adminService),
    userController: new UserController(userService),
    patientController: new PatientController(patientService),
    patientDashboardController: new PatientDashboardController(patientDashboardService),
    mealPlanController: new MealPlanController(mealPlanService),
    chatController: new ChatController(chatService),
    authenticate: createAuthMiddleware(
      tokenService,
      sessionService,
      repository
    ),
  };
}

function createApp(options = {}) {
  const appConfig = {
    ...config,
    ...(options.config || {}),
  };

  const {
    prisma,
    authController,
    adminController,
    userController,
    patientController,
    patientDashboardController,
    mealPlanController,
    chatController,
    authenticate,
  } = createDependencies(appConfig, options);

  const app = express();
  const frontendDir = appConfig.frontendDir;

  app.disable('x-powered-by');
  app.locals.config = appConfig;
  app.locals.prisma = prisma;

  app.use(createCorsMiddleware(appConfig));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  app.get('/health', async (request, response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;

      response.json({
        status: 'OK',
        environment: appConfig.nodeEnv || 'development',
        database: 'connected',
      });
    } catch (error) {
      console.error('Verificação de saúde: banco indisponível.', {
        name: error.name || 'Error',
        code: error.code || 'UNKNOWN',
      });

      response.status(503).json({
        status: 'ERROR',
        environment: appConfig.nodeEnv || 'development',
        database: 'disconnected',
      });
    }
  });

  app.use(
    '/api/auth',
    createAuthRoutes(authController, authenticate)
  );

  app.use(
    '/api/admin',
    createAdminRoutes(adminController, authenticate)
  );

  app.use(
    '/api/users',
    createUserRoutes(userController, authenticate, {
      maxPhotoBytes: appConfig.maxPhotoSizeBytes,
    })
  );

  app.use(
    '/api/patients',
    createPatientRoutes(patientController, authenticate)
  );

  app.use(
    '/api/patient',
    createPatientDashboardRoutes(patientDashboardController, chatController, authenticate)
  );

  app.use(
    '/api/nutritionist',
    createNutritionistRoutes(patientController, mealPlanController, authenticate)
  );

  app.use(
    '/chat',
    createChatRoutes(chatController, authenticate, '/chat')
  );

  app.use(
    '/api/chat',
    createChatRoutes(chatController, authenticate, '/api/chat')
  );

  if (appConfig.photoStorageProvider === 'local') {
    app.use(
      '/uploads',
      express.static(appConfig.uploadsDir, {
        index: false,
        setHeaders: (response) => {
          response.setHeader('X-Content-Type-Options', 'nosniff');
        },
      })
    );
  }

  app.use(frontendAliases(frontendDir));
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