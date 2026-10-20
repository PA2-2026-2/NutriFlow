const request = require('supertest');
const { createApp } = require('../src/app');
const { SupabasePhotoStorage, SIGNED_URL_TTL_SECONDS } = require('../src/infra/supabasePhotoStorage');
const { AppError } = require('../src/errors/appError');
const { createUserWithRole, cleanupTestUsers, bearer } = require('./helpers');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('SupabasePhotoStorage', () => {
  let app;
  let account;
  let storageApi;
  let storage;
  let uploadError;

  beforeAll(async () => {
    uploadError = null;
    storageApi = {
      upload: jest.fn(async () => ({ error: uploadError })),
      createSignedUrl: jest.fn(async (objectKey, expiresIn) => ({
        data: {
          signedUrl: `https://supabase.example.test/storage/v1/object/sign/nutriflow-images/${objectKey}?token=temporary`,
        },
        error: null,
      })),
      remove: jest.fn(async () => ({ error: null })),
    };
    const client = {
      storage: {
        from: jest.fn(() => storageApi),
      },
    };
    storage = new SupabasePhotoStorage({
      client,
      bucket: 'nutriflow-images',
    });
    app = createApp({
      config: { photoStorageProvider: 'supabase' },
      photoStorage: storage,
    });
  });

  beforeEach(async () => {
    uploadError = null;
    storageApi.upload.mockClear();
    storageApi.createSignedUrl.mockClear();
    account = await createUserWithRole(app, 'PATIENT');
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
  });

  it('saves a valid upload in the private bucket and returns a temporary signed URL', async () => {
    const response = await request(app)
      .post('/api/users/me/photo')
      .set(bearer(account.token))
      .set('Content-Type', 'image/png')
      .send(PNG_1X1);

    expect(response.statusCode).toBe(200);
    expect(response.body.profilePhotoUrl).toContain(
      '/object/sign/nutriflow-images/profile-photos/',
    );
    expect(response.body.profilePhotoUrl).toContain('token=temporary');

    const savedUser = await app.locals.prisma.user.findUnique({
      where: { id: account.user.id },
    });
    expect(savedUser.profilePhotoUrl).toMatch(
      /^profile-photos\/[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.png$/,
    );
    expect(storageApi.upload).toHaveBeenCalledWith(
      savedUser.profilePhotoUrl,
      PNG_1X1,
      { contentType: 'image/png', upsert: false },
    );

    await request(app)
      .get('/api/users/me')
      .set(bearer(account.token))
      .expect(200)
      .expect((result) => {
        expect(result.body.user.profilePhotoUrl).toContain('token=temporary');
      });
    expect(storageApi.createSignedUrl).toHaveBeenCalledWith(
      savedUser.profilePhotoUrl,
      SIGNED_URL_TTL_SECONDS,
    );
  });

  it('rejects invalid image contents before writing to Supabase', async () => {
    const response = await request(app)
      .post('/api/users/me/photo')
      .set(bearer(account.token))
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not an image'));

    expect(response.statusCode).toBe(415);
    expect(storageApi.upload).not.toHaveBeenCalled();
  });

  it('returns an explicit storage error without exposing provider details', async () => {
    uploadError = { message: 'secret storage diagnostics' };

    const response = await request(app)
      .post('/api/users/me/photo')
      .set(bearer(account.token))
      .set('Content-Type', 'image/png')
      .send(PNG_1X1);

    expect(response.statusCode).toBe(502);
    expect(response.body.message).toBe('Não foi possível armazenar a foto.');
    expect(JSON.stringify(response.body)).not.toContain('secret storage');
    const savedUser = await app.locals.prisma.user.findUnique({
      where: { id: account.user.id },
    });
    expect(savedUser.profilePhotoUrl).toBeNull();
  });
});

describe('SupabasePhotoStorage failures', () => {
  it('maps a storage failure to an application error', async () => {
    const failingStorage = new SupabasePhotoStorage({
      client: {
        storage: {
          from: () => ({
            upload: async () => ({ error: new Error('private provider details') }),
          }),
        },
      },
    });

    await expect(
      failingStorage.save('user-id', PNG_1X1, 'png'),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      failingStorage.save('user-id', PNG_1X1, 'png'),
    ).rejects.toMatchObject({ statusCode: 502 });
  });
});
