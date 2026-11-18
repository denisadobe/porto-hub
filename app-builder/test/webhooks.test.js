const crypto = require('crypto');
const memoryStore = require('./memory-store');
const { setStore } = require('../actions/lib/store');
const agenda = require('../actions/lib/agenda');
const { bookingsOf, orderNumberOf, shippingPostcodeOf } = require('../actions/lib/webhook');
const validate = require('../actions/webhook-order-validate/index');
const placed = require('../actions/webhook-order-placed/index');
const cancel = require('../actions/webhook-order-cancel/index');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' });
const CLIENT = '11111111-2222-4333-8444-555555555555';
const SP = { id: 'sp-capital', name: 'São Paulo (capital)' };

/** Builds the raw-http params Commerce + I/O Runtime deliver to the action. */
function hookParams(payload, { key = PUBLIC_PEM, tamper = false } = {}) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signer = crypto.createSign('SHA256');
  signer.update(body);
  const signature = signer.sign(privateKey, 'base64');
  const sent = tamper ? Buffer.from(JSON.stringify({ ...payload, tampered: true })).toString('base64') : body;
  return {
    __ow_method: 'post',
    __ow_body: sent,
    __ow_headers: { 'x-adobe-commerce-webhook-signature': signature },
    COMMERCE_WEBHOOK_PUBLIC_KEY: key,
  };
}

/** Shape of observer.sales_order_place_* payloads (only the fields we read). */
function orderPayload({
  reservationId, sku = 'ADB201', postcode = '01310-100', number = '000000101', attrShape = 'array',
}) {
  let custom;
  if (attrShape === 'array') custom = [{ attribute_code: 'porto_reservation_id', value: reservationId }];
  if (attrShape === 'map') custom = { porto_reservation_id: { attribute_code: 'porto_reservation_id', value: reservationId } };
  if (attrShape === 'flat') custom = { porto_reservation_id: reservationId };
  return {
    eventName: 'observer.sales_order_place_before',
    data: {
      order: {
        increment_id: number,
        addresses: [
          { address_type: 'billing', postcode: '99999-999' },
          { address_type: 'shipping', postcode },
        ],
        items: [{
          sku, name: 'Serviço', qty_ordered: 1, ...(reservationId ? { custom_attributes: custom } : {}),
        }],
      },
    },
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

describe('payload parsing', () => {
  test('finds items, reservation ids in any custom attribute shape, order number and shipping CEP', () => {
    ['array', 'map', 'flat'].forEach((attrShape) => {
      const p = orderPayload({ reservationId: 'abc', attrShape });
      expect(bookingsOf(p)).toEqual([{ sku: 'ADB201', reservationId: 'abc' }]);
    });
    const p = orderPayload({ reservationId: 'abc' });
    expect(orderNumberOf(p)).toBe('000000101');
    expect(shippingPostcodeOf(p)).toBe('01310-100');
  });
});

describe('webhook-order-validate', () => {
  test('passes a live reservation for the same service and CEP, and extends the hold', async () => {
    const r = await hold();
    const res = await validate.main(hookParams(orderPayload({ reservationId: r.id })));
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ op: 'success' });
    const after = await agenda.getReservation(r.id);
    expect(Date.parse(after.expiresAt)).toBeGreaterThanOrEqual(Date.parse(r.expiresAt));
  });

  test('blocks items without a booking, expired bookings, other services and other CEPs', async () => {
    const r = await hold();
    const cases = [
      [orderPayload({}), 'informe o CEP'],
      [orderPayload({ reservationId: crypto.randomUUID() }), 'expirou'],
      [orderPayload({ reservationId: r.id, sku: 'ADB220' }), 'não corresponde a este serviço'],
      [orderPayload({ reservationId: r.id, postcode: '20040-002' }), 'mesmo CEP'],
    ];
    // eslint-disable-next-line no-restricted-syntax
    for (const [payload, text] of cases) {
      // eslint-disable-next-line no-await-in-loop
      const res = await validate.main(hookParams(payload));
      expect(res.body.op).toBe('exception');
      expect(res.body.message).toContain(text);
    }
  });

  test('rejects forged or unsigned requests and a missing public key', async () => {
    const r = await hold();
    const payload = orderPayload({ reservationId: r.id });
    expect((await validate.main(hookParams(payload, { tamper: true }))).body.op).toBe('exception');
    const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'pem' });
    expect((await validate.main(hookParams(payload, { key: other }))).body.op).toBe('exception');
    expect((await validate.main(hookParams(payload, { key: '' }))).body.op).toBe('exception');
    const unsigned = hookParams(payload);
    delete unsigned.__ow_headers['x-adobe-commerce-webhook-signature'];
    expect((await validate.main(unsigned)).body.op).toBe('exception');
  });

  test('accepts the key without PEM header lines (as copied from the admin field)', async () => {
    const r = await hold();
    const bare = PUBLIC_PEM.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
    const res = await validate.main(hookParams(orderPayload({ reservationId: r.id }), { key: bare }));
    expect(res.body).toEqual({ op: 'success' });
  });
});

describe('webhook-order-placed / webhook-order-cancel', () => {
  test('order placed confirms the booking with the order number; cancel frees the shift', async () => {
    const r = await hold();
    const payload = orderPayload({ reservationId: r.id, number: '000000123' });
    expect((await placed.main(hookParams(payload))).body).toEqual({ op: 'success' });
    const confirmed = await agenda.getReservation(r.id);
    expect(confirmed).toMatchObject({ status: 'confirmed', orderId: '000000123' });

    // a confirmed booking passes validation for the same order, not for another one
    expect((await validate.main(hookParams(payload))).body.op).toBe('success');
    const other = orderPayload({ reservationId: r.id, number: '000000999' });
    expect((await validate.main(hookParams(other))).body.message).toContain('outro pedido');

    expect((await cancel.main(hookParams(payload))).body).toEqual({ op: 'success' });
    expect(await agenda.getReservation(r.id)).toBeNull();
  });

  test('never block the order when something is wrong', async () => {
    const payload = orderPayload({ reservationId: crypto.randomUUID() });
    expect((await placed.main(hookParams(payload))).body).toEqual({ op: 'success' });
    expect((await placed.main(hookParams(payload, { tamper: true }))).body).toEqual({ op: 'success' });
    expect((await cancel.main(hookParams(payload))).body).toEqual({ op: 'success' });
  });
});
