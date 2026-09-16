const request = require('supertest');
const { createApp } = require('../src/app');

describe('GET /health', () => {
  it('deve retornar status OK e banco conectado', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/health');

    expect(response.statusCode).toBe(200);

    expect(response.body).toEqual({
      status: 'OK',
      environment: 'test',
      database: 'connected',
    });
  });
});