const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createUserWithRole, cleanupTestUsers, bearer } = require('./helpers');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG_FAKE = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);


describe('POST /api/users/me/photo', () => {
  let app;
  let uploadsDir;
  let account;

  const upload = (token, body, contentType) =>
    request(app)
      .post('/api/users/me/photo')
      .set(bearer(token))
      .set('Content-Type', contentType)
      .send(body);

  const filesOnDisk = () => {
    const dir = path.join(uploadsDir, 'profile-photos');
    return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  };

  beforeAll(async () => {
    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nutriflow-uploads-'));
    app = createApp({ config: { uploadsDir } });
  });

  beforeEach(async () => {
    
    fs.rmSync(path.join(uploadsDir, 'profile-photos'), { recursive: true, force: true });
    account = await createUserWithRole(app, 'PATIENT');
  });

  afterAll(async () => {
    await cleanupTestUsers(app);
    await app.stop();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('deve aceitar PNG, salvar a URL no usuario e servir o arquivo', async () => {
    const response = await upload(account.token, PNG_1X1, 'image/png');

    expect(response.statusCode).toBe(200);
    expect(response.body.profilePhotoUrl).toMatch(/^\/uploads\/profile-photos\/.+\.png$/);
    expect(response.body.user.profilePhotoUrl).toBe(response.body.profilePhotoUrl);

    const me = await request(app).get('/api/users/me').set(bearer(account.token));
    expect(me.body.user.profilePhotoUrl).toBe(response.body.profilePhotoUrl);

    const file = await request(app).get(response.body.profilePhotoUrl);
    expect(file.statusCode).toBe(200);
    expect(file.headers['content-type']).toContain('image/png');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
  });

  it('deve aceitar JPEG', async () => {
    const response = await upload(account.token, JPEG_FAKE, 'image/jpeg');

    expect(response.statusCode).toBe(200);
    expect(response.body.profilePhotoUrl).toMatch(/\.jpg$/);
  });

  it('deve substituir a foto antiga (removendo o arquivo anterior)', async () => {
    const first = await upload(account.token, PNG_1X1, 'image/png');
    const firstName = path.basename(first.body.profilePhotoUrl);
    expect(filesOnDisk()).toContain(firstName);

    const second = await upload(account.token, JPEG_FAKE, 'image/jpeg');
    const secondName = path.basename(second.body.profilePhotoUrl);

    expect(second.statusCode).toBe(200);
    expect(secondName).not.toBe(firstName);
    expect(filesOnDisk()).toContain(secondName);
    expect(filesOnDisk()).not.toContain(firstName);
  });

  it('deve recusar formatos que nao sao JPG/PNG (415)', async () => {
    const gif = await upload(account.token, Buffer.from('GIF89a-fake'), 'image/gif');
    const webp = await upload(account.token, Buffer.from('RIFFxxxxWEBP'), 'image/webp');
    const pdf = await upload(account.token, Buffer.from('%PDF-1.4'), 'application/pdf');
    const text = await upload(account.token, 'ola', 'text/plain');

    expect(gif.statusCode).toBe(415);
    expect(webp.statusCode).toBe(415);
    expect(pdf.statusCode).toBe(415);
    expect(text.statusCode).toBe(415);
  });

  it('deve recusar arquivo que diz ser imagem mas nao e (conteudo invalido)', async () => {
    const response = await upload(account.token, Buffer.from('isto nao e uma imagem'), 'image/png');

    expect(response.statusCode).toBe(415);
    expect(filesOnDisk().length).toBe(0);
  });

  it('deve recusar arquivo acima do limite (413)', async () => {
    const tooBig = Buffer.concat([PNG_1X1, Buffer.alloc(2 * 1024 * 1024 + 10, 7)]);

    const response = await upload(account.token, tooBig, 'image/png');

    expect(response.statusCode).toBe(413);
    expect(filesOnDisk().length).toBe(0);
  });

  it('deve recusar corpo vazio (400)', async () => {
    const response = await request(app)
      .post('/api/users/me/photo')
      .set(bearer(account.token))
      .set('Content-Type', 'image/png');

    expect(response.statusCode).toBe(400);
  });

  it('deve exigir token', async () => {
    const response = await request(app)
      .post('/api/users/me/photo')
      .set('Content-Type', 'image/png')
      .send(PNG_1X1);

    expect(response.statusCode).toBe(401);
    expect(filesOnDisk().length).toBe(0);
  });

  it('cada usuario so altera a propria foto', async () => {
    const other = await createUserWithRole(app, 'PATIENT');

    const response = await upload(account.token, PNG_1X1, 'image/png');
    const otherMe = await request(app).get('/api/users/me').set(bearer(other.token));

    expect(response.statusCode).toBe(200);
    expect(otherMe.body.user.profilePhotoUrl).toBeNull();
  });

  it('deve apagar a foto do disco quando o admin remove o usuario', async () => {
    const admin = await createUserWithRole(app, 'ADMIN');
    const uploaded = await upload(account.token, PNG_1X1, 'image/png');
    const name = path.basename(uploaded.body.profilePhotoUrl);
    expect(filesOnDisk()).toContain(name);

    const removed = await request(app)
      .delete(`/api/admin/users/${account.user.id}`)
      .set(bearer(admin.token));

    expect(removed.statusCode).toBe(200);
    expect(filesOnDisk()).not.toContain(name);
  });
});
