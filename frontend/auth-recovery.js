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

  function getRecoveryErrorMessage(error) {
    const code = String(error?.code || '').toLowerCase();
    const text = String(error?.message || '').toLowerCase();

    if (
      code === 'otp_expired' ||
      text.includes('otp_expired') ||
      text.includes('expired') ||
      text.includes('token')
    ) {
      return 'Link inválido ou expirado. Solicite novas instruções de recuperação.';
    }

    return 'Não foi possível validar o link. Solicite novas instruções de recuperação.';
  }

  async function processCallback(callback) {
    try {
      return await callback();
    } finally {
      const cleanUrl = new URL(globalScope.location.href);
      cleanUrl.hash = '';
      cleanUrl.searchParams.delete('code');
      cleanUrl.searchParams.delete('sb_flow_id');
      globalScope.history.replaceState(globalScope.history.state, '', cleanUrl.toString());
    }
  }

  async function initialize() {
    const hash = new URLSearchParams(globalScope.location.hash.slice(1));
    const query = new URLSearchParams(globalScope.location.search);
    const linkError =
      hash.get('error') ||
      hash.get('error_description') ||
      hash.get('error_code') ||
      query.get('error') ||
      query.get('error_description') ||
      query.get('error_code');

    if (linkError) {
      message.textContent = 'Link inválido ou expirado. Solicite novas instruções de recuperação.';
      return;
    }

    try {
      const client = await globalScope.NutriFlowAuthReady;
      let recoverySession = null;

      if (query.has('code')) {
        const { data, error } = await processCallback(() =>
          client.auth.exchangeCodeForSession(query.get('code')),
        );
        if (error) {
          throw error;
        }
        if (data.redirectType !== 'recovery') {
          message.textContent = 'Este link não é válido para recuperação de senha.';
          return;
        }
        recoverySession = data.session;
      } else if (hash.get('type') === 'recovery') {
        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        if (!accessToken || !refreshToken) {
          message.textContent = 'Link inválido ou expirado. Solicite novas instruções de recuperação.';
          return;
        }

        const { data, error } = await processCallback(() =>
          client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          }),
        );
        if (error) {
          throw error;
        }
        recoverySession = data.session;
      } else {
        message.textContent = 'Abra o link enviado por e-mail para redefinir sua senha.';
        return;
      }

      if (!recoverySession) {
        message.textContent = 'Link inválido ou expirado. Solicite novas instruções de recuperação.';
        return;
      }

      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        throw sessionError;
      }
      if (!sessionData.session) {
        message.textContent = 'Link inválido ou expirado. Solicite novas instruções de recuperação.';
        return;
      }

      heading.textContent = 'Redefinir senha';
      message.textContent = 'Escolha uma nova senha com pelo menos 8 caracteres.';
      requestForm.classList.add('hidden');
      updateForm.classList.remove('hidden');
    } catch (error) {
      message.textContent = getRecoveryErrorMessage(error);
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
        if (
          error.code === 'otp_expired' ||
          text.includes('session') ||
          text.includes('token') ||
          text.includes('expired')
        ) {
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
