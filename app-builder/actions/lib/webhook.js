/*
 * Adobe Commerce webhooks -> App Builder (raw-http web actions).
 * - Signature: header x-adobe-commerce-webhook-signature = base64 RSA-SHA256 signature of the
 *   base64-encoded body (params.__ow_body), verified with the public key from
 *   Stores > Configuration > Adobe Services > Webhooks (COMMERCE_WEBHOOK_PUBLIC_KEY).
 * - Response: 200 with { op: 'success' } to continue, { op: 'exception', message } to stop the
 *   original action (the message is shown to the customer).
 * - Payload: the default (full) payload of the order webhook methods. The parser is tolerant: it
 *   looks for the order items (objects with a sku) and, inside each, the porto_reservation_id
 *   custom attribute, whatever its exact shape ([{attribute_code, value}], {code: value} or
 *   {code: {value}}).
 */
const crypto = require('crypto');

const RESERVATION_CODE = 'porto_reservation_id';

class WebhookError extends Error {}

function respond(op) {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: op };
}
const success = () => respond({ op: 'success' });
const exception = (message) => respond({ op: 'exception', message });

function normalizeKey(key) {
  if (!key) return '';
  const k = String(key).replace(/\\n/g, '\n').trim();
  if (k.includes('BEGIN PUBLIC KEY')) return k;
  return `-----BEGIN PUBLIC KEY-----\n${k}\n-----END PUBLIC KEY-----`;
}

/** Returns the parsed payload when the signature is valid; throws WebhookError otherwise. */
function verify(params) {
  const key = normalizeKey(params.COMMERCE_WEBHOOK_PUBLIC_KEY);
  if (!params.COMMERCE_WEBHOOK_PUBLIC_KEY) throw new WebhookError('Webhook public key is not configured.');
  const headers = params.__ow_headers || {};
  const signature = headers['x-adobe-commerce-webhook-signature'] || '';
  const body = params.__ow_body || '';
  if (!signature || !body) throw new WebhookError('Missing webhook signature or body.');
  const verifier = crypto.createVerify('SHA256');
  verifier.update(body);
  let valid = false;
  try {
    valid = verifier.verify(key, signature, 'base64');
  } catch (e) {
    valid = false;
  }
  if (!valid) throw new WebhookError('Invalid webhook signature.');
  return JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
}

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

/** porto_reservation_id inside an item, whatever the custom attributes shape. */
function reservationIdOf(node, depth = 0) {
  if (depth > 5 || node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    // eslint-disable-next-line no-restricted-syntax
    for (const child of node) {
      const found = reservationIdOf(child, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const code = node.attribute_code || node.code;
  if (code === RESERVATION_CODE && typeof node.value === 'string') return node.value;
  if (RESERVATION_CODE in node) {
    const v = node[RESERVATION_CODE];
    if (typeof v === 'string') return v;
    if (isObject(v) && typeof v.value === 'string') return v.value;
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const child of Object.values(node)) {
    const found = reservationIdOf(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** First array of objects with a sku (the order/quote items). Skips child items of configurables. */
function findItems(payload) {
  const queue = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (Array.isArray(node)) {
      const items = node.filter((x) => isObject(x) && typeof x.sku === 'string');
      if (items.length) return items.filter((x) => !x.parent_item_id && !x.parent_item);
      queue.push(...node.filter((x) => x && typeof x === 'object'));
    } else if (isObject(node)) {
      queue.push(...Object.values(node).filter((x) => x && typeof x === 'object'));
    }
  }
  return [];
}

function findValue(payload, keys) {
  const queue = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (isObject(node)) {
      const hit = keys.find((k) => node[k] !== undefined && node[k] !== null && node[k] !== '');
      if (hit) return node[hit];
      queue.push(...Object.values(node).filter((x) => x && typeof x === 'object'));
    } else if (Array.isArray(node)) {
      queue.push(...node.filter((x) => x && typeof x === 'object'));
    }
  }
  return null;
}

function orderNumberOf(payload) {
  const v = findValue(payload, ['increment_id', 'reserved_order_id', 'order_number']);
  return v ? String(v) : null;
}

/** Postcode of the shipping address when the payload has one. */
function shippingPostcodeOf(payload) {
  const queue = [payload];
  let fallback = null;
  while (queue.length) {
    const node = queue.shift();
    if (isObject(node)) {
      if (node.address_type === 'shipping' && node.postcode) return String(node.postcode);
      if (isObject(node.shipping_address) && node.shipping_address.postcode) {
        fallback = fallback || String(node.shipping_address.postcode);
      }
      queue.push(...Object.values(node).filter((x) => x && typeof x === 'object'));
    } else if (Array.isArray(node)) {
      queue.push(...node.filter((x) => x && typeof x === 'object'));
    }
  }
  return fallback;
}

function bookingsOf(payload) {
  return findItems(payload).map((item) => ({ sku: item.sku, reservationId: reservationIdOf(item) }));
}

/**
 * Internal order id (entity_id): the object that has the order number also has it.
 * plugin.sales.api.order_management.cancel only sends { id }, so that is the fallback.
 */
function orderEntityIdOf(payload) {
  const queue = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (isObject(node)) {
      if (node.increment_id && node.entity_id) return String(node.entity_id);
      queue.push(...Object.values(node).filter((x) => x && typeof x === 'object'));
    } else if (Array.isArray(node)) {
      queue.push(...node.filter((x) => x && typeof x === 'object'));
    }
  }
  const id = payload?.data?.id ?? payload?.data?.order_id ?? payload?.data?.entity_id;
  return id !== undefined && id !== null && /^\d+$/.test(String(id)) ? String(id) : null;
}

module.exports = {
  orderEntityIdOf,
  WebhookError,
  verify,
  success,
  exception,
  bookingsOf,
  findItems,
  reservationIdOf,
  orderNumberOf,
  shippingPostcodeOf,
  normalizeKey,
};
