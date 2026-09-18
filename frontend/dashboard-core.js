(function initNutriFlowCore() {
  function safeParse(jsonValue) {
    try {
      return jsonValue ? JSON.parse(jsonValue) : null;
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getInitials(name, fallback = '--') {
    const initials = String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');

    return initials || fallback;
  }

  function formatSidebarDate(options = {}) {
    const {
      date = new Date(),
      locale = 'pt-BR',
      stripPeriod = false,
    } = options;

    const formatted = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
    }).format(date);

    return stripPeriod ? formatted.replace('.', '') : formatted;
  }

  function createSessionManager(options = {}) {
    const {
      tokenKey = 'nutriflow.token',
      userKey = 'nutriflow.user',
      lastAuthKey = 'nutriflow.lastAuthAt',
      redirectTo = 'index.html',
      storage = window.localStorage,
      onClear = null,
    } = options;

    function getToken() {
      return storage.getItem(tokenKey);
    }

    function getUser() {
      return safeParse(storage.getItem(userKey));
    }

    function persistUser(user) {
      if (!user) {
        return null;
      }

      storage.setItem(userKey, JSON.stringify(user));
      return user;
    }

    function clear() {
      if (typeof onClear === 'function') {
        onClear();
      }

      storage.removeItem(tokenKey);
      storage.removeItem(userKey);
      storage.removeItem(lastAuthKey);
      window.location.replace(redirectTo);
    }

    function ensureAuthenticated() {
      if (!getToken()) {
        clear();
        return false;
      }

      return true;
    }

    return {
      clear,
      ensureAuthenticated,
      getToken,
      getUser,
      persistUser,
    };
  }

  function createToastController(element, options = {}) {
    const { duration = 2400 } = options;
    let timeoutId = null;

    function show(message) {
      if (!element || !message) {
        return;
      }

      element.textContent = message;
      element.classList.remove('hidden');
      element.classList.add('is-visible');

      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        element.classList.remove('is-visible');
        element.classList.add('hidden');
      }, duration);
    }

    return { show };
  }

  function createApiClient(options = {}) {
    const {
      request = window.NutriFlowApi?.request,
      getToken = () => null,
      onUnauthorized = null,
      invalidResponseMessage = 'Resposta invalida do servidor.',
      defaultErrorMessage = 'Nao foi possivel concluir a operacao.',
    } = options;

    return async function apiRequest(url, requestOptions = {}) {
      if (typeof request !== 'function') {
        throw new Error('Cliente HTTP indisponivel.');
      }

      const headers = new Headers(requestOptions.headers || {});
      const token = getToken();

      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (requestOptions.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await request(url, {
        ...requestOptions,
        headers,
      });

      const data = await response.json().catch(() => ({
        message: invalidResponseMessage,
      }));

      if (response.status === 401 || response.status === 403) {
        if (typeof onUnauthorized === 'function') {
          onUnauthorized(data.message, response, data);
        }

        throw new Error(data.message || 'Sessao invalida.');
      }

      if (!response.ok) {
        throw new Error(data.message || defaultErrorMessage);
      }

      return data;
    };
  }

  window.NutriFlowCore = {
    createApiClient,
    createSessionManager,
    createToastController,
    escapeHtml,
    formatSidebarDate,
    getInitials,
    safeParse,
  };
})();
