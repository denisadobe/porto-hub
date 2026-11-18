/*
 * Web action helpers: JSON responses and errors with messages in Portuguese (shown to the
 * customer as-is). CORS: I/O Runtime adds "Access-Control-Allow-Origin: *" to web action
 * responses and answers preflights itself; setting the header here too would produce an
 * invalid combined value ("*,https://..."), so actions must not set it.
 */
class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};

function ok(body) {
  return { statusCode: 200, headers: { ...HEADERS }, body };
}

function fail(error) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.status,
      headers: { ...HEADERS },
      body: { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
    };
  }
  // eslint-disable-next-line no-console
  console.error(error);
  return {
    statusCode: 500,
    headers: { ...HEADERS },
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
      return ok(await handler(params));
    } catch (error) {
      return fail(error);
    }
  };
}

module.exports = {
  HttpError, webAction, ok, fail,
};
