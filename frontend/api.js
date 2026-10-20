(function bootstrapNutriFlowApi(globalScope) {
  const DEFAULT_LOCAL_API_ORIGIN = 'http://127.0.0.1:3000';

  function normalizeOrigin(origin) {
    return String(origin || '').trim().replace(/\/+$/, '');
  }

  function isLocalHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1';
  }

  function getConfiguredOrigin() {
    const globalOrigin = normalizeOrigin(globalScope.NUTRIFLOW_API_ORIGIN);

    if (globalOrigin) {
      return globalOrigin;
    }

    try {
      return normalizeOrigin(globalScope.localStorage?.getItem('nutriflow.apiOrigin'));
    } catch (error) {
      return '';
    }
  }

  function getCandidateOrigins() {
    const configuredOrigin = getConfiguredOrigin();
    const locationProtocol = globalScope.location?.protocol || '';
    const locationHostname = globalScope.location?.hostname || '';
    const locationPort = globalScope.location?.port || '';
    const origins = [];

    if (configuredOrigin) {
      origins.push(configuredOrigin);
    }

    if (locationProtocol === 'file:') {
      origins.push(DEFAULT_LOCAL_API_ORIGIN);
      return [...new Set(origins)];
    }

    if (isLocalHost(locationHostname) && locationPort !== '3000') {
      origins.push(DEFAULT_LOCAL_API_ORIGIN);
      origins.push('');
      return [...new Set(origins)];
    }

    origins.push('');

    return [...new Set(origins)];
  }

  function resolveUrl(path, origin = '') {
    if (!origin) {
      return path;
    }

    return new URL(path, `${origin}/`).toString();
  }

  async function request(path, options = {}) {
    const candidateOrigins = getCandidateOrigins();
    let lastError = null;
    let lastResponse = null;

    for (const origin of candidateOrigins) {
      const requestUrl = resolveUrl(path, origin);

      try {
        const response = await globalScope.fetch(requestUrl, options);

        if (response.status === 404 && origin !== candidateOrigins[candidateOrigins.length - 1]) {
          lastResponse = response;
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastResponse) {
      return lastResponse;
    }

    if (lastError) {
      throw lastError;
    }

    throw new Error('Nao foi possivel conectar com a API do NutriFlow.');
  }

  globalScope.NutriFlowApi = {
    request,
    resolveUrl,
    getCandidateOrigins,
  };
})(window);
