const fs = require('fs');
const path = require('path');
const vm = require('vm');

const recoveryScript = fs.readFileSync(
  path.join(__dirname, '..', 'frontend', 'auth-recovery.js'),
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

async function loadRecoveryPage({ hash, updateUser, hasSession = true }) {
  const elements = new Map();
  const storage = new Map([['nutriflow.token', 'old-token']]);
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: hasSession ? { user: { id: 'user-id' } } : null },
        error: null,
      }),
      updateUser,
      signOut: async () => ({ error: null }),
    },
  };
  const window = {
    location: { hash, search: '' },
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
    console,
  });
  await new Promise((resolve) => setImmediate(resolve));

  return { elements, storage };
}

describe('fluxo de redefinição de senha no navegador', () => {
  it('usa updateUser somente com o link recovery autorizado e exibe sucesso após resposta positiva', async () => {
    const updateUser = jest.fn(async ({ password }) => ({
      data: { user: { id: 'user-id', password } },
      error: null,
    }));
    const { elements, storage } = await loadRecoveryPage({
      hash: '#access_token=recovery-token&type=recovery',
      updateUser,
    });
    const form = elements.get('updatePasswordForm');
    const message = elements.get('recoveryMessage');
    const newPassword = elements.get('newPassword');
    const confirmation = elements.get('confirmNewPassword');

    expect(form.classList.contains('hidden')).toBe(false);
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
      hash: '#access_token=recovery-token&type=recovery',
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
      hash: '#access_token=recovery-token&type=recovery',
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
      hash: '#access_token=invalid&type=recovery',
      updateUser: jest.fn(),
      hasSession: false,
    });

    expect(elements.get('recoveryMessage').textContent)
      .toContain('Link inválido ou expirado.');
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
