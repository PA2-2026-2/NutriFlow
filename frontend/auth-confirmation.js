(function handleEmailConfirmation(globalScope) {
  const message = document.getElementById('confirmationMessage');
  const form = document.getElementById('resendConfirmationForm');
  const emailInput = document.getElementById('confirmationEmail');

  function showError(text) {
    message.textContent = text;
    form.classList.remove('hidden');
  }

  function validEmail(value) {
    return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function initialize() {
    const hash = new URLSearchParams(globalScope.location.hash.slice(1));
    const query = new URLSearchParams(globalScope.location.search);
    const linkError =
      hash.get('error') ||
      hash.get('error_description') ||
      query.get('error') ||
      query.get('error_description');

    if (linkError) {
      showError('Link inválido ou expirado. Informe seu e-mail para solicitar uma nova confirmação.');
      return;
    }

    try {
      const client = await globalScope.NutriFlowAuthReady;
      const { data, error } = await client.auth.getSession();
      if (error || !data.session?.user?.email_confirmed_at) {
        showError('Link inválido ou expirado. Informe seu e-mail para solicitar uma nova confirmação.');
        return;
      }

      message.textContent = 'E-mail confirmado com sucesso. Agora você já pode entrar no NutriFlow.';
    } catch (error) {
      showError('Não foi possível verificar o link. Solicite uma nova confirmação.');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!validEmail(email)) {
      showError('Informe um endereço de e-mail válido.');
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await globalScope.NutriFlowApi.request('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Não foi possível enviar o e-mail agora.');
      }
      message.textContent = result.message;
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  initialize();
})(window);
