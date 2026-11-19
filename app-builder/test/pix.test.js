const memoryStore = require('./memory-store');
const { setStore } = require('../actions/lib/store');
const pix = require('../actions/lib/pix');
const charge = require('../actions/pix-charge/index');
const status = require('../actions/pix-status/index');

const post = (p) => ({ __ow_method: 'post', ...p });
const get = (p) => ({ __ow_method: 'get', ...p });

beforeEach(() => setStore(memoryStore()));

test('CRC16 matches the Banco Central example', () => {
  const ex = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  expect(pix.crc16(ex)).toBe('1D3D');
});

test('BR Code carries amount, currency, country, txid and a valid CRC', () => {
  const code = pix.brCode({ amount: 35, txid: 'PS000000045ABCD', description: 'Pedido 000000045' });
  expect(code.startsWith('000201')).toBe(true);
  expect(code).toContain('br.gov.bcb.pix');
  expect(code).toContain('540535.00');
  expect(code).toContain('5303986');
  expect(code).toContain('5802BR');
  expect(code).toContain('0515PS000000045ABCD');
  expect(pix.crc16(code.slice(0, -4))).toBe(code.slice(-4));
});

test('charge is created once per order, starts pending and is "paid" after the simulated delay', async () => {
  const res = await charge.main(post({ orderNumber: '000000045', amount: 35 }));
  expect(res.statusCode).toBe(200);
  expect(res.body).toMatchObject({ orderNumber: '000000045', amount: 35, status: 'pending' });
  expect(res.body.qrSvg).toContain('<svg');
  const again = await charge.main(post({ orderNumber: '000000045', amount: 35 }));
  expect(again.body.txid).toBe(res.body.txid);

  const pending = await status.main(get({ txid: res.body.txid }));
  expect(pending.body.status).toBe('pending');
  expect(pending.body.brcode).toBeUndefined();
  const later = pix.statusOf({ ...res.body, createdAt: new Date(Date.now() - 60000).toISOString() });
  expect(later.status).toBe('paid');
});

test('rejects bad input', async () => {
  expect((await charge.main(post({ orderNumber: 'abc', amount: 10 }))).statusCode).toBe(400);
  expect((await charge.main(post({ orderNumber: '1', amount: -1 }))).statusCode).toBe(400);
  expect((await charge.main(get({ orderNumber: '1', amount: 1 }))).statusCode).toBe(405);
  expect((await status.main(get({ txid: '../x' }))).statusCode).toBe(400);
  expect((await status.main(get({ txid: 'NOPE' }))).statusCode).toBe(404);
});
