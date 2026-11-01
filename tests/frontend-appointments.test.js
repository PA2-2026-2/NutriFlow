const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const readFrontend = (filename) => fs.readFileSync(path.join(root, 'frontend', filename), 'utf8');

describe('integração da interface de consultas', () => {
  const nutritionistHtml = readFrontend('dashboard-nutricionista.html');
  const nutritionistJs = readFrontend('dashboard-nutricionista.js');
  const patientHtml = readFrontend('dashboard.html');
  const patientJs = readFrontend('dashboard.js');

  it('disponibiliza navegação responsiva e filtros na agenda do nutricionista', () => {
    expect(nutritionistHtml).toContain('href="#agenda" data-dashboard-page="agenda"');
    expect(nutritionistHtml).toContain('id="agenda" class="dashboard-view hidden');
    expect(nutritionistHtml).toContain('id="appointmentStatusFilter"');
    expect(nutritionistHtml).toContain('id="appointmentFromFilter"');
    expect(nutritionistHtml).toContain('id="appointmentToFilter"');
    expect(nutritionistJs).toContain("'agenda'");
  });

  it('cria consultas com paciente vinculado e horários ISO com fuso', () => {
    expect(nutritionistHtml).toContain('id="appointmentPatient"');
    expect(nutritionistHtml).toContain('id="appointmentStartAt" type="datetime-local"');
    expect(nutritionistHtml).toContain('id="appointmentEndAt" type="datetime-local"');
    expect(nutritionistJs).toContain("apiRequest('/api/appointments'");
    expect(nutritionistJs).toContain('startAt: localDateTimeToIso(');
    expect(nutritionistJs).toContain('endAt: localDateTimeToIso(');
    expect(nutritionistJs).toContain('patientId: document.getElementById(\'appointmentPatient\').value');
    expect(nutritionistJs).not.toContain("apiRequest('/api/nutritionist/appointments'");
  });

  it('lista com filtros e atualiza usando PUT sem enviar IDs de participantes', () => {
    expect(nutritionistJs).toContain('apiRequest(`/api/appointments${query ? `?${query}` : \'\'}`)');
    expect(nutritionistJs).toContain("query.set('status', status)");
    expect(nutritionistJs).toContain("query.set('from'");
    expect(nutritionistJs).toContain("query.set('to'");
    expect(nutritionistJs).toContain('method: \'PUT\'');
    expect(nutritionistJs).toContain('`/api/appointments/${encodeURIComponent(appointment.id)}`');
    expect(nutritionistJs).not.toContain('/api/nutritionist/appointments/');
    expect(nutritionistJs).not.toContain('scheduledAt: newDate');
  });

  it('exibe próximos agendamentos e histórico somente leitura para paciente', () => {
    expect(patientHtml).toContain('href="#consultas"');
    expect(patientHtml).toContain('id="patientUpcomingAppointments"');
    expect(patientHtml).toContain('id="patientAppointmentHistory"');
    expect(patientJs).toContain("apiRequest('/api/appointments')");
    expect(patientJs).toContain('getPatientAppointments()');
    expect(patientJs).toContain('appointment.description');
    expect(patientJs).not.toContain("method: 'PUT',\n      body: JSON.stringify(payload),\n    });\n    await apiRequest(`/api/appointments/");
  });
});
