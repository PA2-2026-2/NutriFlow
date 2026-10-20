const fs = require('fs');
const path = require('path');
const vm = require('vm');

const recoveryScript = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'auth-recovery.js'),
  'utf8',
);
const authClientScript = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'auth-client.js'),
  'utf8',
);
const confirmationScript = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'auth-confirmation.js'),
  'utf8',
);

function createElement() {
  const classes = new Set();
  const button = {
    disabled: false,
    setAttribute(name, value) {
      this[name] = value;
    },
  };

  return {
    value: '',
    textContent: '',
    listeners: {},
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
    querySelector() {
      return button;
    },
    reset() {
      this.value = '';
    },
    button,
  };
}

async function loadRecoveryPage({
  hash,
  query = '',
  updateUser,
  hasSession = true,
  redirectType = 'recovery',
  sessionError = null,
}) {
  const elements = new Map();
  const storage = new Map([['nutriflow.token', 'old-token']]);
  const authCalls = [];
  const setSession = jest.fn(async () => {
    authCalls.push('setSession');
    return {
      data: { session: hasSession && !sessionError ? { user: { id: 'user-id' } } : null },
      error: sessionError,
    };
  });
  const exchangeCodeForSession = jest.fn(async () => {
    authCalls.push('exchangeCodeForSession');
    return {
      data: {
        session: hasSession ? { user: { id: 'user-id' } } : null,
        redirectType,
      },
      error: null,
    };
  });
  const client = {
    auth: {
      getSession: jest.fn(async () => {
        authCalls.push('getSession');
        return {
          data: { session: hasSession ? { user: { id: 'user-id' } } : null },
          error: null,
        };
      }),
      setSession,
      exchangeCodeForSession,
      updateUser,
      signOut: async () => ({ error: null }),
    },
  };
  const window = {
    location: {
      hash,
      search: query,
      href: `https://nutriflowconsultorio.online/reset-password${query}${hash}`,
    },
    history: {
      state: null,
      replaceState: jest.fn(),
    },
    NutriFlowAuthReady: Promise.resolve(client),
    localStorage: {
      removeItem(key) {
        storage.delete(key);
      },
    },
  };
  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        const element = createElement();
        if (id === 'updatePasswordForm') {
          element.classList.add('hidden');
        }
        elements.set(id, element);
      }
      return elements.get(id);
    },
  };

  vm.runInNewContext(recoveryScript, {
    window,
    document,
    URLSearchParams,
    URL,
    console,
  });
  await new Promise((resolve) => setImmediate(resolve));

  return {
    elements,
    storage,
    setSession,
    exchangeCodeForSession,
    authCalls,
    history: window.history,
  };
}

async function loadAuthClient(pathname) {
  const createClient = jest.fn(() => ({
    auth: { onAuthStateChange: jest.fn() },
  }));
  const window = {
    location: { pathname },
    localStorage: { getItem: () => null },
    NutriFlowApi: {
      request: async () => ({
        ok: true,
        json: async () => ({ url: '', anonKey: '' }),
      }),
    },
    supabase: { createClient },
  };

  vm.runInNewContext(authClientScript, { window });
  await window.NutriFlowAuthReady;
  return createClient.mock.calls[0][2];
}

describe('fluxo de redefinição de senha no navegador', () => {
  it('usa updateUser somente com o link recovery autorizado e exibe sucesso após resposta positiva', async () => {
    const updateUser = jest.fn(async ({ password }) => ({
      data: { user: { id: 'user-id', password } },
      error: null,
    }));
    const { elements, storage, setSession, authCalls, history } = await loadRecoveryPage({
      hash: '#access_token=recovery-token&refresh_token=refresh-token&type=recovery',
      updateUser,
    });
    const form = elements.get('updatePasswordForm');
    const message = elements.get('recoveryMessage');
    const newPassword = elements.get('newPassword');
    const confirmation = elements.get('confirmNewPassword');

    expect(form.classList.contains('hidden')).toBe(false);
    expect(setSession).toHaveBeenCalledTimes(1);
    expect(authCalls).toEqual(['setSession', 'getSession']);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    expect(history.replaceState.mock.calls[0][2])
      .toBe('https://nutriflowconsultorio.online/reset-password');
    newPassword.value = 'nova-senha-123';
    confirmation.value = 'nova-senha-123';
    await form.listeners.submit({ preventDefault() {} });

    expect(updateUser).toHaveBeenCalledWith({ password: 'nova-senha-123' });
    expect(message.textContent).toBe('Senha alterada com sucesso.');
    expect(storage.has('nutriflow.token')).toBe(false);
  });

  it('não informa sucesso quando o token de recuperação é inválido ou expirou', async () => {
    const updateUser = jest.fn(async () => ({
      data: { user: null },
      error: { message: 'Recovery token expired' },
    }));
    const { elements } = await loadRecoveryPage({
      hash: '#access_token=recovery-token&refresh_token=refresh-token&type=recovery',
      updateUser,
    });
    const form = elements.get('updatePasswordForm');
    elements.get('newPassword').value = 'nova-senha-123';
    elements.get('confirmNewPassword').value = 'nova-senha-123';
    await form.listeners.submit({ preventDefault() {} });

    expect(elements.get('recoveryMessage').textContent)
      .toBe('Link inválido ou expirado. Solicite novas instruções de recuperação.');
    expect(elements.get('updatePasswordForm').classList.contains('hidden')).toBe(false);
  });

  it('trata erro de confirmação da senha antes de chamar o Supabase', async () => {
    const updateUser = jest.fn();
    const { elements } = await loadRecoveryPage({
      hash: '#access_token=recovery-token&refresh_token=refresh-token&type=recovery',
      updateUser,
    });
    elements.get('newPassword').value = 'nova-senha-123';
    elements.get('confirmNewPassword').value = 'outra-senha';
    await elements.get('updatePasswordForm').listeners.submit({ preventDefault() {} });

    expect(updateUser).not.toHaveBeenCalled();
    expect(elements.get('recoveryMessage').textContent)
      .toBe('As senhas não conferem. Verifique e tente novamente.');
  });

  it('orienta o usuário quando o link de recuperação expirou antes da abertura', async () => {
    const { elements } = await loadRecoveryPage({
      hash: '#error=access_denied&error_description=expired',
      updateUser: jest.fn(),
    });

    expect(elements.get('recoveryMessage').textContent)
      .toContain('Link inválido ou expirado.');
  });

  it('não permite redefinir a senha quando o link não produz uma sessão Supabase', async () => {
    const { elements } = await loadRecoveryPage({
      hash: '#access_token=invalid&refresh_token=refresh-token&type=recovery',
      updateUser: jest.fn(),
      hasSession: false,
    });

    expect(elements.get('recoveryMessage').textContent)
      .toContain('Link inválido ou expirado.');
    expect(elements.get('updatePasswordForm').classList.contains('hidden')).toBe(true);
  });

  it('troca um code PKCE de recuperação uma única vez antes de consultar a sessão', async () => {
    const { elements, setSession, exchangeCodeForSession, authCalls, history } = await loadRecoveryPage({
      hash: '',
      query: '?code=recovery-code',
      updateUser: jest.fn(),
    });

    expect(elements.get('updatePasswordForm').classList.contains('hidden')).toBe(false);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(exchangeCodeForSession).toHaveBeenCalledWith('recovery-code');
    expect(setSession).not.toHaveBeenCalled();
    expect(authCalls).toEqual(['exchangeCodeForSession', 'getSession']);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    expect(history.replaceState.mock.calls[0][2])
      .toBe('https://nutriflowconsultorio.online/reset-password');
  });

  it('não permite code que não foi emitido para recuperação de senha', async () => {
    const { elements, exchangeCodeForSession } = await loadRecoveryPage({
      hash: '',
      query: '?code=sign-in-code',
      redirectType: null,
      updateUser: jest.fn(),
    });

    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(elements.get('updatePasswordForm').classList.contains('hidden')).toBe(true);
    expect(elements.get('recoveryMessage').textContent)
      .toBe('Este link não é válido para recuperação de senha.');
  });

  it('desativa detecção automática da URL apenas na rota de recuperação', async () => {
    const recoveryOptions = await loadAuthClient('/reset-password');
    const standardOptions = await loadAuthClient('/');

    expect(recoveryOptions.auth.detectSessionInUrl).toBe(false);
    expect(standardOptions.auth.detectSessionInUrl).toBe(true);
  });

  it('apresenta uma mensagem clara quando o Supabase retorna otp_expired', async () => {
    const { elements } = await loadRecoveryPage({
      hash: '#access_token=expired&refresh_token=refresh-token&type=recovery',
      updateUser: jest.fn(),
      sessionError: { code: 'otp_expired', message: 'Token expired' },
    });

    expect(elements.get('recoveryMessage').textContent)
      .toBe('Link inválido ou expirado. Solicite novas instruções de recuperação.');
    expect(elements.get('updatePasswordForm').classList.contains('hidden')).toBe(true);
  });

  it('oferece novo e-mail quando o link de confirmação é inválido ou expirou', async () => {
    const elements = new Map();
    const window = {
      location: {
        hash: '#error=access_denied&error_description=expired',
        search: '',
      },
      NutriFlowAuthReady: Promise.resolve({
        auth: { getSession: jest.fn() },
      }),
      NutriFlowApi: { request: jest.fn() },
    };
    const document = {
      getElementById(id) {
        if (!elements.has(id)) {
          const element = createElement();
          if (id === 'resendConfirmationForm') {
            element.classList.add('hidden');
          }
          elements.set(id, element);
        }
        return elements.get(id);
      },
    };
    vm.runInNewContext(confirmationScript, {
      window,
      document,
      URLSearchParams,
      console,
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(elements.get('confirmationMessage').textContent)
      .toContain('Link inválido ou expirado.');
    expect(elements.get('resendConfirmationForm').classList.contains('hidden')).toBe(false);
  });
});
