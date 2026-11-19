/*
 * Admin UI SDK worker: "Agendamento" columns in Sales > Orders. Commerce sends the order ids of
 * the visible rows; the booking comes from the ordn.<order number> index written by the order
 * webhooks (ord.<entity_id> as a fallback).
 */
const { okGridResponse, parseGridRequest, errorGridResponse } = require('@adobe/aio-commerce-lib-admin-ui/grid-columns');
const { getJson } = require('../../lib/store');

const STATUS = { confirmed: 'Confirmado', released: 'Liberado', held: 'Reservado' };

async function bookingFor(id) {
  let idx = await getJson(`ordn.${id}`);
  if (!idx) {
    const byEntity = await getJson(`ord.${id}`);
    if (byEntity?.orderNumber) idx = await getJson(`ordn.${byEntity.orderNumber}`);
  }
  if (!idx) return null;
  return { porto_booking: idx.schedule || '', porto_booking_status: STATUS[idx.status] || '' };
}

exports.main = async (params) => {
  let ids;
  try {
    ({ ids } = parseGridRequest(params));
  } catch (e) {
    return errorGridResponse(400, e.message);
  }
  const data = {};
  await Promise.all(ids.map(async (id) => {
    const row = await bookingFor(id).catch(() => null);
    if (row) data[id] = row;
  }));
  return okGridResponse(data, { porto_booking: '', porto_booking_status: '' });
};
