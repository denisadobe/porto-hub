/*
 * Key-value storage (App Builder State). Keys: [a-zA-Z0-9-_.], values: strings, TTL max 365 days.
 * Tests replace the store with an in-memory one through setStore().
 */
const MAX_TTL = 60 * 60 * 24 * 365;

let store;

async function getStore() {
  if (!store) {
    // eslint-disable-next-line global-require
    const stateLib = require('@adobe/aio-lib-state');
    store = await stateLib.init();
  }
  return store;
}

function setStore(custom) {
  store = custom;
}

async function getJson(key) {
  const res = await (await getStore()).get(key);
  if (!res || res.value === undefined || res.value === null) return null;
  try {
    return JSON.parse(res.value);
  } catch (e) {
    return null;
  }
}

/** Writes JSON. Returns false when ifNotExists was set and the key already existed. */
async function putJson(key, value, { ttl = MAX_TTL, ifNotExists = false } = {}) {
  const options = { ttl: Math.min(Math.max(1, Math.round(ttl)), MAX_TTL) };
  if (ifNotExists) options.ifNotExists = true;
  const res = await (await getStore()).put(key, JSON.stringify(value), options);
  return res !== null;
}

async function remove(key) {
  await (await getStore()).delete(key);
}

async function listKeys(match) {
  const keys = [];
  // eslint-disable-next-line no-restricted-syntax
  for await (const page of (await getStore()).list({ match })) {
    keys.push(...page.keys);
  }
  return keys;
}

module.exports = {
  MAX_TTL, getStore, setStore, getJson, putJson, remove, listKeys,
};
