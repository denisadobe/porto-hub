/*
 * Agenda: available days/shifts per region, and reservations.
 *
 * Each shift has N capacity units per region and day. A reservation claims one unit with
 * an atomic "write if not exists" on key slot.<region>.<date>.<shift>.<unit>, so two
 * customers can never get the same unit. Held reservations expire on their own (TTL);
 * confirmed ones (after the order is placed) are kept until 30 days after the visit.
 *
 * Keys: slot.<region>.<date>.<shift>.<unit>   -> reservation
 *       rsv.<reservationId>                    -> reservation + slotKey
 */
const crypto = require('crypto');
const { HttpError } = require('./http');
const { loadAgenda } = require('./config');
const {
  getJson, putJson, remove, listKeys,
} = require('./store');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function todayIn(timeZone, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function weekday(date) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function dayLabels(date) {
  const d = new Date(`${date}T12:00:00Z`);
  const fmt = (opts) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }).format(d);
  return {
    weekday: fmt({ weekday: 'long' }),
    label: fmt({ weekday: 'short', day: '2-digit', month: 'short' }),
  };
}

function capacityOf(agenda, regionId, shift) {
  const override = agenda.regions?.[regionId]?.capacity?.[shift.id];
  return Number.isInteger(override) && override >= 0 ? override : shift.capacity;
}

/** FNV-1a, used for a stable "already booked" share of each shift in the demo. */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function simulatedBooked(agenda, regionId, date, shiftId, capacity) {
  if (!agenda.simulatedOccupancy || capacity <= 0) return 0;
  const h = hash(`${regionId}|${date}|${shiftId}`);
  if (h % 7 === 0) return capacity; // some shifts are fully booked
  return h % capacity; // never full otherwise
}

function shiftWindow(shift) {
  return `${shift.start}–${shift.end}`;
}

function bookableDates(agenda, now) {
  const first = addDays(todayIn(agenda.timeZone, now), agenda.leadDays);
  const blocked = new Set(agenda.blockedDates.map((b) => b.date));
  const dates = [];
  for (let i = 0; i < agenda.horizonDays; i += 1) {
    const date = addDays(first, i);
    if (!blocked.has(date)) dates.push(date);
  }
  return dates;
}

/** Claimed units per "<date>.<shift>" for a region. */
async function claimedUnits(regionId) {
  const claimed = new Map();
  (await listKeys(`slot.${regionId}.*`)).forEach((key) => {
    const [, , date, shiftId, unit] = key.split('.');
    const k = `${date}.${shiftId}`;
    if (!claimed.has(k)) claimed.set(k, new Set());
    claimed.get(k).add(Number(unit));
  });
  return claimed;
}

function freeUnits(agenda, regionId, date, shift, claimed) {
  const capacity = capacityOf(agenda, regionId, shift);
  const booked = simulatedBooked(agenda, regionId, date, shift.id, capacity);
  const taken = claimed.get(`${date}.${shift.id}`) || new Set();
  const free = [];
  for (let unit = booked + 1; unit <= capacity; unit += 1) {
    if (!taken.has(unit)) free.push(unit);
  }
  return free;
}

async function availableSlots(region, { days, now } = {}) {
  const agenda = await loadAgenda();
  const claimed = await claimedUnits(region.id);
  const result = bookableDates(agenda, now)
    .map((date) => {
      const wd = weekday(date);
      const shifts = agenda.shifts
        .filter((s) => s.weekdays.includes(wd) && capacityOf(agenda, region.id, s) > 0)
        .map((s) => {
          const remaining = freeUnits(agenda, region.id, date, s, claimed).length;
          return {
            id: s.id, label: s.label, window: shiftWindow(s), remaining, available: remaining > 0,
          };
        });
      return { date, ...dayLabels(date), shifts };
    })
    .filter((d) => d.shifts.length)
    .slice(0, days || undefined); // "days" = next N days that have shifts
  return {
    region,
    timeZone: agenda.timeZone,
    holdMinutes: agenda.holdMinutes,
    days: result,
  };
}

function publicReservation(r) {
  const { slotKey, ...rest } = r;
  return rest;
}

function validateReservationId(id) {
  if (!UUID_RE.test(String(id || ''))) {
    throw new HttpError(400, 'invalid_reservation', 'Reserva inválida.');
  }
  return String(id);
}

async function getReservation(id) {
  return getJson(`rsv.${validateReservationId(id)}`);
}

async function releaseReservation(id, { allowConfirmed = false } = {}) {
  const r = await getReservation(id);
  if (!r) return { released: false, reason: 'not_found' };
  if (r.status === 'confirmed' && !allowConfirmed) {
    throw new HttpError(409, 'reservation_confirmed', 'Este agendamento já foi confirmado em um pedido.');
  }
  await remove(r.slotKey);
  await remove(`rsv.${r.id}`);
  return { released: true };
}

async function reserveSlot({
  cep, sku, region, date, shift: shiftId, replaces, now = new Date(),
}) {
  const agenda = await loadAgenda();
  if (!DATE_RE.test(String(date || '')) || !bookableDates(agenda, now).includes(date)) {
    throw new HttpError(422, 'invalid_date', 'Essa data não está disponível para agendamento.');
  }
  const shift = agenda.shifts.find((s) => s.id === shiftId);
  if (!shift || !shift.weekdays.includes(weekday(date))) {
    throw new HttpError(422, 'invalid_shift', 'Esse turno não está disponível nessa data.');
  }
  if (replaces) await releaseReservation(replaces).catch(() => {});

  const holdSeconds = agenda.holdMinutes * 60;
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + holdSeconds * 1000).toISOString();
  const reservation = {
    id,
    status: 'held',
    cep,
    sku,
    region,
    date,
    ...dayLabels(date),
    shift: { id: shift.id, label: shift.label, window: shiftWindow(shift) },
    createdAt: now.toISOString(),
    expiresAt,
  };

  const free = freeUnits(agenda, region.id, date, shift, await claimedUnits(region.id));
  // eslint-disable-next-line no-restricted-syntax
  for (const unit of free) {
    const slotKey = `slot.${region.id}.${date}.${shift.id}.${unit}`;
    // eslint-disable-next-line no-await-in-loop
    if (await putJson(slotKey, reservation, { ttl: holdSeconds, ifNotExists: true })) {
      // eslint-disable-next-line no-await-in-loop
      await putJson(`rsv.${id}`, { ...reservation, slotKey }, { ttl: holdSeconds });
      return reservation;
    }
  }
  throw new HttpError(409, 'slot_full', 'Esse horário acabou de ser preenchido. Escolha outro turno ou data.');
}

/** Turns a held reservation into a confirmed booking (used when the order is placed). */
async function confirmReservation(id, { orderId, now = new Date() } = {}) {
  const r = await getReservation(id);
  if (!r) throw new HttpError(410, 'reservation_expired', 'A reserva do horário expirou. Escolha o horário novamente.');
  if (r.status === 'confirmed') return publicReservation(r);
  const confirmed = {
    ...r, status: 'confirmed', orderId: orderId || null, confirmedAt: now.toISOString(),
  };
  delete confirmed.expiresAt;
  const ttl = Math.max(60, (Date.parse(`${r.date}T23:59:59Z`) + 30 * DAY_MS - now.getTime()) / 1000);
  await putJson(r.slotKey, publicReservation(confirmed), { ttl });
  await putJson(`rsv.${id}`, confirmed, { ttl });
  return publicReservation(confirmed);
}

module.exports = {
  todayIn,
  addDays,
  weekday,
  hash,
  simulatedBooked,
  bookableDates,
  availableSlots,
  reserveSlot,
  releaseReservation,
  getReservation,
  confirmReservation,
  publicReservation,
  validateReservationId,
};
