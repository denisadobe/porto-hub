/*
 * Coverage and agenda configuration. Stored in App Builder State (keys cfg.coverage, cfg.agenda),
 * falling back to the demo defaults. The Admin UI SDK screens (later stage) write these keys.
 */
const { DEFAULT_COVERAGE, DEFAULT_AGENDA } = require('./defaults');
const { getJson, putJson } = require('./store');

const KEYS = { coverage: 'cfg.coverage', agenda: 'cfg.agenda' };
const ID_RE = /^[a-z0-9-]{1,40}$/;
const CEP_RE = /^\d{8}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Drops anything malformed so a bad admin save can never break the storefront. */
function sanitizeCoverage(raw) {
  const regions = Array.isArray(raw?.regions) ? raw.regions : [];
  return {
    regions: regions
      .filter((r) => r && ID_RE.test(r.id))
      .map((r) => ({
        id: r.id,
        name: String(r.name || r.id).slice(0, 80),
        active: r.active !== false,
        services: Array.isArray(r.services) && r.services.length ? r.services.map(String) : ['*'],
        ranges: (Array.isArray(r.ranges) ? r.ranges : [])
          .filter((x) => x && CEP_RE.test(x.from) && CEP_RE.test(x.to) && x.from <= x.to)
          .map((x) => ({ from: x.from, to: x.to })),
      })),
  };
}

function sanitizeAgenda(raw) {
  const base = clone(DEFAULT_AGENDA);
  const a = { ...base, ...(raw && typeof raw === 'object' ? raw : {}) };
  const int = (v, min, max, fallback) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  };
  return {
    timeZone: typeof a.timeZone === 'string' ? a.timeZone : base.timeZone,
    leadDays: int(a.leadDays, 0, 30, base.leadDays),
    horizonDays: int(a.horizonDays, 1, 60, base.horizonDays),
    holdMinutes: int(a.holdMinutes, 1, 60, base.holdMinutes),
    simulatedOccupancy: a.simulatedOccupancy !== false,
    shifts: (Array.isArray(a.shifts) ? a.shifts : base.shifts)
      .filter((s) => s && ID_RE.test(s.id) && TIME_RE.test(s.start) && TIME_RE.test(s.end))
      .map((s) => ({
        id: s.id,
        label: String(s.label || s.id).slice(0, 40),
        start: s.start,
        end: s.end,
        capacity: int(s.capacity, 0, 100, 1),
        weekdays: (Array.isArray(s.weekdays) ? s.weekdays : []).map(Number).filter((d) => d >= 0 && d <= 6),
      })),
    blockedDates: (Array.isArray(a.blockedDates) ? a.blockedDates : [])
      .filter((b) => b && DATE_RE.test(b.date))
      .map((b) => ({ date: b.date, reason: String(b.reason || '').slice(0, 80) })),
    regions: a.regions && typeof a.regions === 'object' ? a.regions : {},
  };
}

async function loadCoverage() {
  return sanitizeCoverage((await getJson(KEYS.coverage)) || DEFAULT_COVERAGE);
}

async function loadAgenda() {
  return sanitizeAgenda((await getJson(KEYS.agenda)) || DEFAULT_AGENDA);
}

async function saveCoverage(value) {
  const clean = sanitizeCoverage(value);
  await putJson(KEYS.coverage, clean);
  return clean;
}

async function saveAgenda(value) {
  const clean = sanitizeAgenda(value);
  await putJson(KEYS.agenda, clean);
  return clean;
}

module.exports = {
  KEYS, sanitizeCoverage, sanitizeAgenda, loadCoverage, loadAgenda, saveCoverage, saveAgenda,
};
