/*
 * Simulated Pix PSP for the demo: creates a charge with a real-format BR Code (EMV "copia e
 * cola", Banco Central spec) pointing to a FICTITIOUS key, and marks it as paid a few seconds
 * later. Nothing is ever charged. Keys: pix.<txid> (1 day).
 */
const crypto = require('crypto');
const QRCode = require('qrcode');
const { HttpError } = require('./http');
const { getJson, putJson } = require('./store');

const DEMO_KEY = '7d9f2a44-2b1c-4e5f-9a3b-0c1d2e3f4a5b'; // fictitious random key (EVP)
const MERCHANT = 'PORTO SERVICO DEMO';
const CITY = 'SAO PAULO';
const AUTO_PAY_SECONDS = 12;
const TTL = 60 * 60 * 24;

const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC16-CCITT (poly 0x1021, init 0xFFFF), as required by the BR Code spec. */
function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function brCode({ amount, txid, description }) {
  const account = tlv('00', 'br.gov.bcb.pix') + tlv('01', DEMO_KEY) + (description ? tlv('02', description.slice(0, 40)) : '');
  const payload = [
    tlv('00', '01'), tlv('26', account), tlv('52', '0000'), tlv('53', '986'), tlv('54', amount.toFixed(2)),
    tlv('58', 'BR'), tlv('59', MERCHANT), tlv('60', CITY), tlv('62', tlv('05', txid)), '6304',
  ].join('');
  return payload + crc16(payload);
}

function statusOf(charge, now = Date.now()) {
  if (charge.status === 'paid') return charge;
  if (now - Date.parse(charge.createdAt) >= AUTO_PAY_SECONDS * 1000) {
    return { ...charge, status: 'paid', paidAt: new Date(Date.parse(charge.createdAt) + AUTO_PAY_SECONDS * 1000).toISOString() };
  }
  return charge;
}

async function createCharge({ orderNumber, amount }) {
  const number = String(orderNumber || '');
  if (!/^\d{1,20}$/.test(number)) throw new HttpError(400, 'invalid_order', 'Pedido inválido.');
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > 100000) throw new HttpError(400, 'invalid_amount', 'Valor inválido.');
  const existing = await getJson(`pix.order.${number}`);
  if (existing) {
    const charge = await getJson(`pix.${existing.txid}`);
    if (charge) return { ...statusOf(charge), qrSvg: await QRCode.toString(charge.brcode, { type: 'svg', margin: 1 }) };
  }
  const txid = `PS${number}${crypto.randomBytes(4).toString('hex').toUpperCase()}`.slice(0, 25);
  const code = brCode({ amount: value, txid, description: `Pedido ${number}` });
  const charge = {
    txid, orderNumber: number, amount: value, brcode: code, status: 'pending', createdAt: new Date().toISOString(),
  };
  await putJson(`pix.${txid}`, charge, { ttl: TTL });
  await putJson(`pix.order.${number}`, { txid }, { ttl: TTL });
  return { ...charge, qrSvg: await QRCode.toString(code, { type: 'svg', margin: 1 }) };
}

async function chargeStatus(txid) {
  if (!/^[A-Z0-9]{1,25}$/.test(String(txid || ''))) throw new HttpError(400, 'invalid_txid', 'Cobrança inválida.');
  const charge = await getJson(`pix.${txid}`);
  if (!charge) throw new HttpError(404, 'pix_not_found', 'Cobrança Pix não encontrada.');
  const { brcode, ...rest } = statusOf(charge);
  return rest;
}

module.exports = {
  brCode, crc16, createCharge, chargeStatus, statusOf, AUTO_PAY_SECONDS,
};
