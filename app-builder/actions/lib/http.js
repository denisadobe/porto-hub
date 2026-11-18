/*
 * Web action helpers: CORS for the storefront hosts, JSON responses and errors with
 * messages in Portuguese (shown to the customer as-is).
 */
const ALLOWED_ORIGINS = [
  /^https:\/\/([a-z0-9-]+--)?porto-hub--denisadobe\.aem\.(page|live)$/,
  /^https:\/\/([a-z0-9-]+--)?porto-hub--denisadobe\.ue\.da\.live$/,
  /^http:\/\/localhost(:\d+)?$/,
];

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function corsHeaders(params) {
  const origin = params?.__ow_headers?.origin;
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.some((re) => re.test(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function ok(params, body) {
  return { statusCode: 200, headers: corsHeaders(params), body };
}

function fail(params, error) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.status,
      headers: corsHeaders(params),
      body: { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
    };
  }
  // eslint-disable-next-line no-console
  console.error(error);
  return {
    statusCode: 500,
    headers: corsHeaders(params),
    body: { error: { code: 'internal', message: 'Não foi possível concluir agora. Tente novamente em instantes.' } },
  };
}

function requireMethod(params, ...methods) {
  const method = (params.__ow_method || 'get').toLowerCase();
  if (!methods.includes(method)) {
    throw new HttpError(405, 'method_not_allowed', `Método ${method.toUpperCase()} não suportado.`);
  }
}

/** Wraps an action handler: (params) => body. */
function webAction(methods, handler) {
  return async (params = {}) => {
    try {
      requireMethod(params, ...methods);
      return ok(params, await handler(params));
    } catch (error) {
      return fail(params, error);
    }
  };
}

module.exports = {
  HttpError, webAction, corsHeaders, ok, fail,
};
