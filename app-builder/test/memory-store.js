/* In-memory stand-in for @adobe/aio-lib-state: get/put (ttl, ifNotExists)/delete/list({ match }). */
module.exports = function memoryStore({ clock = () => Date.now() } = {}) {
  const data = new Map();
  const alive = (key) => {
    const entry = data.get(key);
    if (!entry) return null;
    if (entry.expires <= clock()) {
      data.delete(key);
      return null;
    }
    return entry;
  };
  return {
    data,
    async get(key) {
      const entry = alive(key);
      return entry ? { value: entry.value, expiration: new Date(entry.expires).toISOString() } : undefined;
    },
    async put(key, value, { ttl = 86400, ifNotExists = false } = {}) {
      if (typeof value !== 'string') throw new Error('value must be a string');
      if (!/^[a-zA-Z0-9-_.]{1,1024}$/.test(key)) throw new Error(`bad key ${key}`);
      if (ifNotExists && alive(key)) return null;
      data.set(key, { value, expires: clock() + ttl * 1000 });
      return key;
    },
    async delete(key) {
      return data.delete(key) ? key : null;
    },
    list({ match = '*' } = {}) {
      const re = new RegExp(`^${match.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
      const keys = [...data.keys()].filter((k) => alive(k) && re.test(k));
      return (async function* pages() { yield { keys }; }());
    },
  };
};
