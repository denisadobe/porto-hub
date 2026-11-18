/*
 * Builds the Universal Editor files in the project root (component-definition.json,
 * component-models.json, component-filters.json) from the templates in ue/models.
 * Templates use { "...": "./file.json#/pointer" } entries (globs allowed: ./blocks/*.json),
 * which are replaced by the referenced array items, as in the da-block-collection reference.
 * Run: npm run build:json
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = join(ROOT, 'ue', 'models');

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function pointer(obj, path) {
  return path.split('/').filter(Boolean).reduce((value, key) => (value == null ? value : value[key]), obj);
}

function filesFor(base, pattern) {
  if (!pattern.includes('*')) return [join(base, pattern)];
  const dir = join(base, dirname(pattern));
  const suffix = pattern.split('*').pop();
  return readdirSync(dir).filter((f) => f.endsWith(suffix)).sort().map((f) => join(dir, f));
}

function expand(value, base) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item) && typeof item['...'] === 'string') {
        const [pattern, path = ''] = item['...'].split('#');
        return filesFor(base, pattern).flatMap((file) => {
          const referenced = pointer(readJson(file), path);
          return Array.isArray(referenced) ? expand(referenced, dirname(file)) : [];
        });
      }
      return [expand(item, base)];
    });
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, expand(v, base)]));
  }
  return value;
}

['component-definition.json', 'component-models.json', 'component-filters.json'].forEach((name) => {
  const out = expand(readJson(join(MODELS, name)), MODELS);
  writeFileSync(join(ROOT, name), `${JSON.stringify(out, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`${name} written`);
});
