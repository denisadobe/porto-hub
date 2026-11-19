const crypto = require('crypto');
const memoryStore = require('./memory-store');
const { setStore, getJson } = require('../actions/lib/store');
const agenda = require('../actions/lib/agenda');
const config = require('../actions/admin/config/index');
const bookings = require('../actions/admin/bookings/index');
const grid = require('../actions/admin/order-grid-booking/index');
const placed = require('../actions/webhook-order-placed/index');
const cancel = require('../actions/webhook-order-cancel/index');

const ORG = 'ABC123@AdobeOrg';
const CLIENT = '11111111-2222-4333-8444-555555555555';
const SP = { id: 'sp-capital', name: 'São Paulo (capital)' };
const admin = (method, extra = {}) => ({
  __ow_method: method,
  __ow_headers: { authorization: 'Bearer token', 'x-gw-ims-org-id': ORG },
  ALLOWED_IMS_ORG: ORG,
  ...extra,
});

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = publicKey.export({ type: 'spki', format: 'pem' });
function signed(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signer = crypto.createSign('SHA256');
  signer.update(body);
  return {
    __ow_body: body,
    __ow_headers: { 'x-adobe-commerce-webhook-signature': signer.sign(privateKey, 'base64') },
    COMMERCE_WEBHOOK_PUBLIC_KEY: PEM,
  };
}

async function hold() {
  const [day] = (await agenda.availableSlots(SP)).days.filter((d) => d.shifts.some((s) => s.available));
  const shift = day.shifts.find((s) => s.available);
  return agenda.reserveSlot({
    cep: '01310100', sku: 'ADB201', region: SP, date: day.date, shift: shift.id, clientId: CLIENT,
  });
}

beforeEach(() => setStore(memoryStore()));

describe('admin auth', () => {
  test('requires a bearer token and the project IMS org', async () => {
    expect((await config.main({ __ow_method: 'get', ALLOWED_IMS_ORG: ORG })).statusCode).toBe(401);
    const otherOrg = admin('get');
    otherOrg.__ow_headers['x-gw-ims-org-id'] = 'OTHER@AdobeOrg';
    expect((await config.main(otherOrg)).statusCode).toBe(403);
    expect((await config.main(admin('get'))).statusCode).toBe(200);
  });
});

describe('admin config', () => {
  test('returns defaults, saves sanitized coverage and agenda, rejects empty ones', async () => {
    const res = await config.main(admin('get'));
    expect(res.body.coverage.regions.length).toBeGreaterThan(3);
    expect(res.body.agenda.shifts.map((s) => s.id)).toEqual(['manha', 'tarde']);

    const coverage = {
      regions: [
        { id: 'sp-capital', name: 'SP', ranges: [{ from: '01000000', to: '05999999' }, { from: 'xx', to: '1' }] },
        { id: 'Bad Id!', name: 'x', ranges: [] },
      ],
    };
    const saved = await config.main(admin('post', { coverage }));
    expect(saved.body.coverage.regions).toHaveLength(1);
    expect(saved.body.coverage.regions[0].ranges).toHaveLength(1);
    expect((await config.main(admin('get'))).body.coverage.regions).toHaveLength(1);

    expect((await config.main(admin('post', { coverage: { regions: [] } }))).statusCode).toBe(422);
    const shifts = [{
      id: 'manha', label: 'Manhã', start: '08:00', end: '12:00', capacity: 2, weekdays: [1, 2],
    }];
    const agendaRes = await config.main(admin('post', { agenda: { holdMinutes: 20, shifts } }));
    expect(agendaRes.body.agenda).toMatchObject({ holdMinutes: 20 });
    expect((await config.main(admin('post', { agenda: { shifts: [] } }))).statusCode).toBe(422);
  });
});

describe('admin bookings + orders grid', () => {
  test('lists bookings, shows the order in the grid, and releases a confirmed booking', async () => {
    const r = await hold();
    expect((await bookings.main(admin('get'))).body.bookings.map((b) => b.id)).toEqual([r.id]);

    const order = {
      order: {
        increment_id: '000000200', entity_id: 90, items: [{ sku: 'ADB201', custom_attributes: [{ attribute_code: 'porto_reservation_id', value: r.id }] }],
      },
    };
    await placed.main(signed(order));
    const list = (await bookings.main(admin('get'))).body.bookings;
    expect(list[0]).toMatchObject({ status: 'confirmed', orderId: '000000200' });
    expect(list[0].clientId).toBeUndefined();

    const g = await grid.main({ gridType: 'order', ids: ['000000200', '000000999'], requestId: 'req-1' });
    expect(g.statusCode).toBe(200);
    expect(g.body.data['000000200'].porto_booking).toContain(r.shift.label);
    expect(g.body.data['000000200'].porto_booking_status).toBe('Confirmado');
    expect(g.body.data['000000999']).toBeUndefined();

    const rel = await bookings.main(admin('post', { action: 'release', id: r.id }));
    expect(rel.body.released).toBe(true);
    expect(await agenda.getReservation(r.id)).toBeNull();
    const after = await grid.main({ gridType: 'order', ids: ['000000200'], requestId: 'req-2' });
    expect(after.body.data['000000200'].porto_booking_status).toBe('Liberado');
  });

  test('cancel webhook marks the order as released in the grid', async () => {
    const r = await hold();
    await placed.main(signed({
      order: {
        increment_id: '000000201', entity_id: 91, items: [{ sku: 'ADB201', custom_attributes: [{ attribute_code: 'porto_reservation_id', value: r.id }] }],
      },
    }));
    await cancel.main(signed({ id: '91', result: true, subject: [] }));
    expect((await getJson('ordn.000000201')).status).toBe('released');
    expect((await grid.main({ gridType: 'order', ids: ['000000201'], requestId: 'r' })).body.data['000000201'].porto_booking_status).toBe('Liberado');
  });

  test('grid rejects malformed requests', async () => {
    expect((await grid.main({ gridType: 'order', ids: [] })).error.statusCode).toBe(400);
  });
});
