const request = require('supertest');
const { createApp } = require('../src/app');

describe('rotas do frontend', () => {
  const app = createApp();

  it('serve o dashboard diretamente em /dashboard sem alterar a URL', async () => {
    const response = await request(app).get('/dashboard');

    expect(response.statusCode).toBe(200);
    expect(response.headers.location).toBeUndefined();
    expect(response.text).toContain('<title>NutriFlow | Dashboard do paciente</title>');
    expect(response.text).toContain('src="dashboard.js"');
  });

  it('mantém a raiz da página no diretório do frontend para recursos relativos', async () => {
    const dashboard = await request(app).get('/dashboard');
    const stylesheet = await request(app).get('/styles.css');
    const script = await request(app).get('/dashboard.js');

    expect(dashboard.statusCode).toBe(200);
    expect(stylesheet.statusCode).toBe(200);
    expect(script.statusCode).toBe(200);
  });

  it('normaliza /dashboard/ sem redirecionar para o nome do arquivo', async () => {
    const response = await request(app).get('/dashboard/');

    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe('/dashboard');
  });

  it('redireciona a URL antiga do paciente para a rota limpa', async () => {
    const response = await request(app).get('/dashboard.html');

    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe('/dashboard');
  });

  it('serve o painel da nutricionista diretamente na rota limpa', async () => {
    const response = await request(app).get('/dashboard-nutricionista');

    expect(response.statusCode).toBe(200);
    expect(response.headers.location).toBeUndefined();
    expect(response.text).toContain('<title>NutriFlow | Dashboard do Nutricionista</title>');
    expect(response.text).toContain('src="dashboard-nutricionista.js"');
  });

  it('redireciona a URL antiga do painel da nutricionista para a rota limpa', async () => {
    const response = await request(app).get('/dashboard-nutricionista.html');

    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe('/dashboard-nutricionista');
  });

  it('normaliza /dashboard-nutricionista/ sem expor o arquivo HTML', async () => {
    const response = await request(app).get('/dashboard-nutricionista/');

    expect(response.statusCode).toBe(308);
    expect(response.headers.location).toBe('/dashboard-nutricionista');
  });

  it('preserva os demais aliases do frontend', async () => {
    const response = await request(app).get('/home');

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/index.html');
  });

  it('serve os callbacks nativos de confirmação e recuperação do Supabase', async () => {
    const confirmation = await request(app).get('/auth/confirm');
    const recovery = await request(app).get('/reset-password');

    expect(confirmation.statusCode).toBe(200);
    expect(confirmation.text).toContain('Confirmação de e-mail');
    expect(confirmation.text).toContain('resendConfirmationForm');
    expect(recovery.statusCode).toBe(200);
    expect(recovery.text).toContain('updatePasswordForm');
    expect(recovery.text).toContain('src="/auth-recovery.js"');

    const recoveryScript = await request(app).get('/auth-recovery.js');
    expect(recoveryScript.statusCode).toBe(200);
    expect(recoveryScript.text).toContain('exchangeCodeForSession');
    expect(recoveryScript.text).toContain('setSession');
  });

  it('serve o SDK oficial instalado sem expor a chave secreta', async () => {
    const response = await request(app).get('/api/vendor/supabase.js');

    expect(response.statusCode).toBe(200);
    expect(response.type).toContain('javascript');
    expect(response.text).toContain('createClient');
  });
});
