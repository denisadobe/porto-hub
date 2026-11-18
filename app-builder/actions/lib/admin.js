/*
 * Admin (Commerce Admin UI SDK page) helpers. Actions run with require-adobe-auth: I/O Runtime
 * validates the admin's IMS token; we also require the caller's IMS org to be the project's org
 * (ALLOWED_IMS_ORG, written by CI from the workspace configuration).
 */
const { HttpError, webAction } = require('./http');

function headerOf(params, name) {
  const headers = params.__ow_headers || {};
  return headers[name] || headers[name.toLowerCase()] || '';
}

function requireAdmin(params) {
  const auth = headerOf(params, 'authorization');
  if (!/^Bearer\s+\S+/i.test(auth)) throw new HttpError(401, 'unauthorized', 'Faça login no Admin do Commerce.');
  const allowed = String(params.ALLOWED_IMS_ORG || '').trim();
  const org = String(headerOf(params, 'x-gw-ims-org-id')).trim();
  if (allowed && org !== allowed) throw new HttpError(403, 'forbidden', 'Organização sem acesso a este app.');
}

/** webAction-style wrapper for admin actions (methods + auth). */
function adminAction(methods, handler) {
  return webAction(methods, async (params) => {
    requireAdmin(params);
    return handler(params);
  });
}

module.exports = { requireAdmin, adminAction };
