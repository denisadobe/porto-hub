/*
 * Webhook diagnostics: the last calls of each order webhook, kept for 1 day in App Builder State
 * (key diag.<action>.<timestamp>). Stores only the payload SHAPE (key names and value types, no
 * values) plus the decision, so it is safe to expose through the public webhook-log action.
 */
const { putJson, getJson, listKeys } = require('./store');

const TTL = 60 * 60 * 24;

function shape(node, depth = 0) {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) return depth > 5 ? '[…]' : [node.length ? shape(node[0], depth + 1) : 'empty'];
  if (typeof node === 'object') {
    if (depth > 5) return '{…}';
    return Object.fromEntries(Object.entries(node).slice(0, 40).map(([k, v]) => [k, shape(v, depth + 1)]));
  }
  return typeof node;
}

async function record(action, entry) {
  const ts = new Date().toISOString();
  const key = `diag.${action}.${Date.now()}${Math.floor(Math.random() * 1000)}`;
  await putJson(key, { action, ts, ...entry }, { ttl: TTL }).catch(() => {});
}

async function recent(limit = 20) {
  const keys = (await listKeys('diag.*')).sort().reverse().slice(0, limit);
  return (await Promise.all(keys.map((k) => getJson(k)))).filter(Boolean)
    .sort((a, b) => (a.ts < b.ts ? 1 : -1));
}

module.exports = { shape, record, recent };
