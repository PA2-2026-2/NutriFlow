(function configureNutriFlowAuth(globalScope) {
  const isPasswordRecoveryPage =
    globalScope.location?.pathname === '/reset-password' ||
    globalScope.location?.pathname === '/reset-password.html';

  globalScope.NutriFlowAuthReady = (async () => {
    const hadNutriFlowSession = Boolean(
      globalScope.localStorage.getItem('nutriflow.token'),
    );
    const response = await globalScope.NutriFlowApi.request('/api/auth/config');
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Autenticação indisponível.');
    }

    if (!globalScope.supabase?.createClient) {
      throw new Error('Não foi possível carregar o cliente de autenticação.');
    }

    const client = globalScope.supabase.createClient(data.url, data.anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: !isPasswordRecoveryPage,
        flowType: 'implicit',
        persistSession: true,
        storageKey: 'nutriflow.supabase.session',
      },
    });

    client.auth.onAuthStateChange((event, session) => {
      if (
        session?.access_token &&
        ((event === 'TOKEN_REFRESHED' &&
          globalScope.localStorage.getItem('nutriflow.token')) ||
          (event === 'INITIAL_SESSION' && hadNutriFlowSession))
      ) {
        globalScope.localStorage.setItem('nutriflow.token', session.access_token);
        if (session.refresh_token) {
          globalScope.localStorage.setItem('nutriflow.refreshToken', session.refresh_token);
        }
      } else if (event === 'SIGNED_OUT') {
        globalScope.localStorage.removeItem('nutriflow.token');
        globalScope.localStorage.removeItem('nutriflow.refreshToken');
        globalScope.localStorage.removeItem('nutriflow.user');
        globalScope.localStorage.removeItem('nutriflow.lastAuthAt');
      }
    });

    return client;
  })();

  globalScope.NutriFlowSignOut = async () => {
    const client = await globalScope.NutriFlowAuthReady;
    const { error } = await client.auth.signOut();
    if (error) {
      throw error;
    }
  };
})(window);
