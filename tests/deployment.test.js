const request = require('supertest');
const { createApp } = require('../src/app');
const { PhotoStorage } = require('../src/infra/photoStorage');
const { AppError } = require('../src/errors/appError');

describe('configuração de produção', () => {
  const app = createApp({
    config: {
      nodeEnv: 'production',
      corsAllowedOrigins: ['https://app.example.test'],
      photoStorageProvider: 'disabled',
    },
  });

  it('permite somente origens configuradas no CORS', async () => {
    const denied = await request(app)
      .get('/missing')
      .set('Origin', 'https://untrusted.example.test');
    const allowed = await request(app)
      .get('/missing')
      .set('Origin', 'https://app.example.test');

    expect(denied.statusCode).toBe(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    expect(allowed.statusCode).toBe(404);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://app.example.test',
    );
  });

  it('permite o próprio origin em produção sem exigir allowlist explícita', async () => {
    const sameOriginApp = createApp({
      config: {
        nodeEnv: 'production',
        corsAllowedOrigins: [],
        photoStorageProvider: 'disabled',
      },
    });
    const response = await request(sameOriginApp)
      .get('/missing')
      .set('Host', 'app.example.test')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://app.example.test');

    expect(response.statusCode).toBe(404);
    expect(response.headers['access-control-allow-origin']).toBe(
      'https://app.example.test',
    );
  });

  it('retorna indisponibilidade sem expor erro de conexão no health check', async () => {
    const brokenPrisma = {
      $queryRaw: () => Promise.reject(new Error('connection credentials leaked')),
      $disconnect: async () => {},
    };
    const brokenApp = createApp({
      prisma: brokenPrisma,
      config: { nodeEnv: 'production' },
    });
    const response = await request(brokenApp).get('/health');

    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({
      status: 'ERROR',
      database: 'disconnected',
    });
    expect(JSON.stringify(response.body)).not.toContain('credentials');
  });

  it('não grava fotos em armazenamento local quando o provider está desativado', async () => {
    const storage = new PhotoStorage({
      uploadsDir: 'uploads',
      enabled: false,
    });

    const upload = storage.save('user-id', Buffer.from('image'), 'png');

    await expect(upload).rejects.toBeInstanceOf(AppError);
    await expect(upload).rejects.toMatchObject({ statusCode: 503 });
  });
});
