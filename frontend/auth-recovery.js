(function handlePasswordRecovery(globalScope) {
  const heading = document.getElementById('recoveryHeading');
  const message = document.getElementById('recoveryMessage');
  const requestForm = document.getElementById('requestResetForm');
  const updateForm = document.getElementById('updatePasswordForm');
  const emailInput = document.getElementById('resetEmail');
  const newPassword = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmNewPassword');

  function validEmail(value) {
    return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
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
      message.textContent = 'Link inválido ou expirado. Solicite novas instruções de recuperação.';
      return;
    }

    try {
      const client = await globalScope.NutriFlowAuthReady;
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw error;
      }
      if (hash.get('type') === 'recovery' && !data.session) {
        message.textContent = 'Link inválido ou expirado. Solicite novas instruções de recuperação.';
        return;
      }
      if (data.session && hash.get('type') === 'recovery') {
        heading.textContent = 'Redefinir senha';
        message.textContent = 'Escolha uma nova senha com pelo menos 8 caracteres.';
        requestForm.classList.add('hidden');
        updateForm.classList.remove('hidden');
      }
    } catch {
      message.textContent = 'Não foi possível verificar o link. Solicite novas instruções de recuperação.';
    }
  }

  requestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!validEmail(email)) {
      message.textContent = 'Informe um endereço de e-mail válido.';
      return;
    }

    setBusy(requestForm, true);
    try {
      const response = await globalScope.NutriFlowApi.request('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message || 'Não foi possível enviar as instruções agora.');
      }
      message.textContent = result.message;
    } catch (error) {
      message.textContent = error.message || 'Não foi possível enviar as instruções agora.';
    } finally {
      setBusy(requestForm, false);
    }
  });

  updateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (newPassword.value.length < 8) {
      message.textContent = 'A senha deve ter pelo menos 8 caracteres.';
      return;
    }
    if (newPassword.value !== confirmPassword.value) {
      message.textContent = 'As senhas não conferem. Verifique e tente novamente.';
      return;
    }

    setBusy(updateForm, true);
    try {
      const client = await globalScope.NutriFlowAuthReady;
      const { error } = await client.auth.updateUser({ password: newPassword.value });
      if (error) {
        const text = String(error.message || '').toLowerCase();
        if (text.includes('session') || text.includes('token') || text.includes('expired')) {
          throw new Error('Link inválido ou expirado. Solicite novas instruções de recuperação.');
        }
        if (error.code === 'weak_password' || text.includes('password should')) {
          throw new Error('A senha deve ter pelo menos 8 caracteres.');
        }
        throw new Error('Não foi possível alterar a senha. Tente novamente.');
      }

      message.textContent = 'Senha alterada com sucesso.';
      updateForm.reset();
      updateForm.classList.add('hidden');
      try {
        const { error: signOutError } = await client.auth.signOut();
        if (signOutError) {
          console.error('A senha foi alterada, mas não foi possível encerrar a sessão de recuperação.', signOutError);
        }
      } catch (signOutError) {
        console.error('A senha foi alterada, mas não foi possível encerrar a sessão de recuperação.', signOutError);
      }
      globalScope.localStorage.removeItem('nutriflow.token');
      globalScope.localStorage.removeItem('nutriflow.refreshToken');
    } catch (error) {
      message.textContent = error.message || 'Não foi possível alterar a senha.';
    } finally {
      setBusy(updateForm, false);
    }
  });

  initialize();
})(window);
