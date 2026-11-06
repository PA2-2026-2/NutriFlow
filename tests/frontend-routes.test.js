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
    expect(response.text).toContain('<a class="mobile-nav-pill" href="/patients/challenges">Desafios</a>');
  });

  it('mantém a navegação completa do paciente na tela de desafios', async () => {
    const response = await request(app).get('/patients/challenges');

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('href="/dashboard#refeicoes"');
    expect(response.text).toContain('href="/dashboard#historico"');
    expect(response.text).toContain('href="/dashboard#plano"');
    expect(response.text).toContain('href="/dashboard#medidas"');
    expect(response.text).toContain('href="/dashboard#peso"');
    expect(response.text).toContain('href="/dashboard#consultas"');
    expect(response.text).toContain('aria-label="Navegação do painel do paciente"');
  });

  it('serve as telas de metas nutricionais para os dois perfis', async () => {
    const patient = await request(app).get('/patients/goals');
    const nutritionist = await request(app).get('/nutritionists/goals');

    expect(patient.statusCode).toBe(200);
    expect(patient.text).toContain('Minhas metas nutricionais');
    expect(patient.text).toContain('src="/patients-goals.js"');
    expect(nutritionist.statusCode).toBe(200);
    expect(nutritionist.text).toContain('Metas dos pacientes');
    expect(nutritionist.text).toContain('src="/nutritionists-goals.js"');
  });

  it('mostra navegação lateral, pacientes vinculados e campo de categoria personalizada', async () => {
    const response = await request(app).get('/nutritionists/goals');

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('aria-label="Navegação do painel da nutricionista"');
    expect(response.text).toContain('xl:flex xl:flex-col');
    expect(response.text).not.toContain('Meu painel');
    expect(response.text).toContain('href="/nutritionists/challenges" class="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-white/75');
    expect(response.text).toContain('<span aria-hidden="true">◇</span><span>Desafios Ativos</span>');
    expect(response.text).toContain('href="/nutritionists/goals" aria-current="page"');
    expect(response.text).toContain('id="linkedPatientSidebar"');
    expect(response.text).toContain('id="customCategoryField"');
    expect(response.text).toContain('name="customCategory"');
  });

  it('mantém a sidebar do paciente nas metas com a navegação padrão', async () => {
    const response = await request(app).get('/patients/goals');

    expect(response.statusCode).toBe(200);
    expect(response.text).toContain('aria-label="Navegação do painel do paciente"');
    expect(response.text).toContain('href="/patients/challenges"');
    expect(response.text).toContain('href="/patients/goals" aria-current="page"');
    expect(response.text).toContain('xl:flex xl:flex-col');
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
    expect(response.text).toContain('<a class="mobile-nav-pill" href="/nutritionists/challenges">Desafios Ativos</a>');
    expect(response.text).toContain('href="/nutritionists/goals">Metas Nutricionais</a>');
    expect(response.text).not.toContain('aria-disabled="true">Desafios Ativos');
  });

  it('mantém a mesma ordem e os mesmos destinos da sidebar nutricionista nas telas principais', async () => {
    const pages = await Promise.all([
      request(app).get('/dashboard-nutricionista'),
      request(app).get('/nutritionists/challenges'),
      request(app).get('/nutritionists/goals'),
    ]);
    const expectedOrder = [
      'Meus Pacientes',
      'Últimos Planos',
      'Últimas Avaliações',
      'Desafios Ativos',
      'Metas Nutricionais',
      'Agenda',
      'Bate-papos',
    ];

    for (const response of pages) {
      expect(response.statusCode).toBe(200);
      const sidebar = response.text.match(
        /<nav[^>]*aria-label="Navegação do painel da nutricionista"[^>]*>([\s\S]*?)<\/nav>/,
      )?.[1];
      expect(sidebar).toBeDefined();
      const positions = expectedOrder.map((label) => sidebar.indexOf(label));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((first, second) => first - second));
      expect(sidebar).not.toContain('Meu painel');
    }
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
