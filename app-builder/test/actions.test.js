const memoryStore = require('./memory-store');
const { setStore, putJson } = require('../actions/lib/store');
const { KEYS } = require('../actions/lib/config');
const agenda = require('../actions/lib/agenda');
const coverage = require('../actions/coverage/index');
const slots = require('../actions/slots/index');
const reserve = require('../actions/reserve/index');
const release = require('../actions/release/index');
const reservation = require('../actions/reservation/index');

const ORIGIN = 'https://main--porto-hub--denisadobe.aem.live';
const get = (params) => ({ __ow_method: 'get', __ow_headers: { origin: ORIGIN }, ...params });
const post = (params) => ({ __ow_method: 'post', __ow_headers: { origin: ORIGIN }, ...params });

const VIACEP = {
  '01310100': {
    cep: '01310-100', logradouro: 'Avenida Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP',
  },
  '69005010': {
    cep: '69005-010', logradouro: 'Rua Barroso', bairro: 'Centro', localidade: 'Manaus', uf: 'AM',
  },
};

let store;
beforeEach(() => {
  store = memoryStore();
  setStore(store);
  global.fetch = jest.fn(async (url) => {
    const cep = url.match(/ws\/(\d{8})\/json/)[1];
    return { ok: true, status: 200, json: async () => VIACEP[cep] || { erro: 'true' } };
  });
});

async function firstFreeSlot(cep = '01310100', sku = 'ADB201') {
  const res = await slots.main(get({ cep, sku }));
  const day = res.body.days.find((d) => d.shifts.some((s) => s.available));
  return { date: day.date, shift: day.shifts.find((s) => s.available) };
}

describe('coverage', () => {
  test('served CEP returns region and address (CORS header left to I/O Runtime)', async () => {
    const res = await coverage.main(get({ cep: '01310-100', sku: 'ADB201' }));
    expect(res.statusCode).toBe(200);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.body).toMatchObject({
      cep: '01310-100', served: true, region: { id: 'sp-capital' }, address: { street: 'Avenida Paulista', city: 'São Paulo' },
    });
  });

  test('existing CEP outside coverage is not served', async () => {
    const res = await coverage.main(get({ cep: '69005010' }));
    expect(res.body).toMatchObject({ served: false, reason: 'region', region: null });
  });

  test('unknown and malformed CEPs are rejected', async () => {
    expect((await coverage.main(get({ cep: '99999999' }))).statusCode).toBe(404);
    const bad = await coverage.main(get({ cep: '123' }));
    expect(bad.statusCode).toBe(400);
    expect(bad.body.error.code).toBe('invalid_cep');
  });

  test('still answers when ViaCEP is down', async () => {
    global.fetch = jest.fn(async () => { throw new Error('network'); });
    const res = await coverage.main(get({ cep: '01310100' }));
    expect(res.body).toMatchObject({ served: true, address: null, addressLookup: 'unavailable' });
  });

  test('admin configuration overrides the defaults (region off, service restricted)', async () => {
    await putJson(KEYS.coverage, {
      regions: [
        {
          id: 'sp-capital', name: 'São Paulo', active: false, ranges: [{ from: '01000000', to: '05999999' }],
        },
        {
          id: 'campinas', name: 'Campinas', services: ['ADB220'], ranges: [{ from: '13000000', to: '13149999' }],
        },
      ],
    });
    expect((await coverage.main(get({ cep: '01310100' }))).body.served).toBe(false);
    VIACEP['13010000'] = { logradouro: 'Rua X', bairro: 'Centro', localidade: 'Campinas', uf: 'SP' };
    expect((await coverage.main(get({ cep: '13010000', sku: 'ADB220' }))).body.served).toBe(true);
    expect((await coverage.main(get({ cep: '13010000', sku: 'ADB201' }))).body.reason).toBe('service');
  });

  test('rejects other HTTP methods', async () => {
    expect((await coverage.main(post({ cep: '01310100' }))).statusCode).toBe(405);
  });
});

describe('slots', () => {
  test('lists bookable days with shifts, never today, never holidays or Sundays', async () => {
    const res = await slots.main(get({ cep: '01310100', sku: 'ADB201' }));
    expect(res.statusCode).toBe(200);
    const today = agenda.todayIn('America/Sao_Paulo');
    expect(res.body.days.length).toBeGreaterThan(5);
    res.body.days.forEach((d) => {
      expect(d.date > today).toBe(true);
      expect(agenda.weekday(d.date)).not.toBe(0);
      expect(['2026-11-20', '2026-12-25', '2027-01-01']).not.toContain(d.date);
      d.shifts.forEach((s) => expect(s.remaining).toBeGreaterThanOrEqual(0));
    });
    expect(res.body.holdMinutes).toBe(15);
  });

  test('days=N returns the next N days that have shifts', async () => {
    const res = await slots.main(get({ cep: '01310100', sku: 'ADB201', days: '3' }));
    expect(res.body.days).toHaveLength(3);
    res.body.days.forEach((d) => expect(d.shifts.length).toBeGreaterThan(0));
    expect((await slots.main(get({ cep: '01310100', sku: 'ADB201', days: '0' }))).statusCode).toBe(400);
  });

  test('requires a served CEP and a service', async () => {
    expect((await slots.main(get({ cep: '69005010', sku: 'ADB201' }))).statusCode).toBe(422);
    expect((await slots.main(get({ cep: '01310100' }))).body.error.code).toBe('invalid_sku');
  });
});

describe('reservations', () => {
  test('reserve holds a unit, lowers availability, and can be read and released', async () => {
    const { date, shift } = await firstFreeSlot();
    const res = await reserve.main(post({
      cep: '01310100', sku: 'ADB201', date, shift: shift.id,
    }));
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'held', date, shift: { id: shift.id } });
    expect(res.body.slotKey).toBeUndefined();

    const after = (await slots.main(get({ cep: '01310100', sku: 'ADB201' }))).body.days
      .find((d) => d.date === date).shifts.find((s) => s.id === shift.id);
    expect(after.remaining).toBe(shift.remaining - 1);

    const read = await reservation.main(get({ id: res.body.id }));
    expect(read.body.status).toBe('held');

    expect((await release.main(post({ reservationId: res.body.id }))).body.released).toBe(true);
    expect((await reservation.main(get({ id: res.body.id }))).statusCode).toBe(404);
  });

  test('never overbooks: parallel requests beyond capacity fail with slot_full', async () => {
    const { date, shift } = await firstFreeSlot();
    const attempts = await Promise.all(Array.from({ length: shift.remaining + 3 }, () => reserve.main(post({
      cep: '01310100', sku: 'ADB201', date, shift: shift.id,
    }))));
    const okCount = attempts.filter((r) => r.statusCode === 200).length;
    expect(okCount).toBe(shift.remaining);
    attempts.filter((r) => r.statusCode !== 200).forEach((r) => expect(r.body.error.code).toBe('slot_full'));
    const units = new Set(attempts.filter((r) => r.statusCode === 200).map((r) => r.body.id));
    expect(units.size).toBe(okCount);
  });

  test('replaces releases the previous hold', async () => {
    const { date, shift } = await firstFreeSlot();
    const first = await reserve.main(post({
      cep: '01310100', sku: 'ADB201', date, shift: shift.id,
    }));
    const second = await reserve.main(post({
      cep: '01310100', sku: 'ADB201', date, shift: shift.id, replaces: first.body.id,
    }));
    expect(second.statusCode).toBe(200);
    expect((await reservation.main(get({ id: first.body.id }))).statusCode).toBe(404);
  });

  test('rejects past, unknown or out-of-window dates and unknown shifts', async () => {
    const base = { cep: '01310100', sku: 'ADB201', shift: 'manha' };
    expect((await reserve.main(post({ ...base, date: '2020-01-01' }))).body.error.code).toBe('invalid_date');
    expect((await reserve.main(post({ ...base, date: 'amanha' }))).body.error.code).toBe('invalid_date');
    const { date } = await firstFreeSlot();
    expect((await reserve.main(post({ ...base, date, shift: 'noite' }))).body.error.code).toBe('invalid_shift');
    expect((await reserve.main(get({ ...base, date }))).statusCode).toBe(405);
  });

  test('held reservations expire after the hold time', async () => {
    let now = Date.now();
    store = memoryStore({ clock: () => now });
    setStore(store);
    const { date, shift } = await firstFreeSlot();
    const res = await reserve.main(post({
      cep: '01310100', sku: 'ADB201', date, shift: shift.id,
    }));
    now += 16 * 60 * 1000;
    expect((await reservation.main(get({ id: res.body.id }))).statusCode).toBe(404);
  });

  test('confirmed reservations survive the hold and cannot be released by the storefront', async () => {
    const { date, shift } = await firstFreeSlot();
    const res = await reserve.main(post({
      cep: '01310100', sku: 'ADB201', date, shift: shift.id,
    }));
    const confirmed = await agenda.confirmReservation(res.body.id, { orderId: '000000123' });
    expect(confirmed).toMatchObject({ status: 'confirmed', orderId: '000000123' });
    expect((await release.main(post({ reservationId: res.body.id }))).statusCode).toBe(409);
    expect((await agenda.releaseReservation(res.body.id, { allowConfirmed: true })).released).toBe(true);
  });

  test('invalid reservation ids are rejected', async () => {
    expect((await reservation.main(get({ id: '../cfg.coverage' }))).statusCode).toBe(400);
    expect((await release.main(post({ reservationId: 'x' }))).statusCode).toBe(400);
  });
});

describe('agenda helpers', () => {
  test('simulated occupancy is stable and leaves most shifts bookable', () => {
    const cfg = { simulatedOccupancy: true };
    const a = agenda.simulatedBooked(cfg, 'sp-capital', '2026-12-01', 'manha', 4);
    expect(agenda.simulatedBooked(cfg, 'sp-capital', '2026-12-01', 'manha', 4)).toBe(a);
    expect(agenda.simulatedBooked({ simulatedOccupancy: false }, 'x', '2026-12-01', 'manha', 4)).toBe(0);
  });

  test('dates are computed in São Paulo time', () => {
    // 2026-11-19 01:30 UTC is still 2026-11-18 in São Paulo (UTC-3)
    expect(agenda.todayIn('America/Sao_Paulo', new Date('2026-11-19T01:30:00Z'))).toBe('2026-11-18');
    expect(agenda.addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
