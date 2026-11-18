/*
 * Commerce webhook, AFTER an order is cancelled: plugin.sales.api.order_management.cancel (after).
 * That method only sends the order id, so the reservations come from the ord.<entity_id> index
 * written when the order was placed (or from the items, when the payload has them).
 * Frees the booked shifts. Never blocks the cancellation.
 */
const {
  verify, success, bookingsOf, orderEntityIdOf,
} = require('../lib/webhook');
const { releaseReservation } = require('../lib/agenda');
const { getJson, remove } = require('../lib/store');

exports.main = async (params) => {
  let payload;
  try {
    payload = verify(params);
  } catch (e) {
    console.error('webhook-order-cancel:', e.message);
    return success();
  }
  const entityId = orderEntityIdOf(payload);
  const fromItems = bookingsOf(payload).map((b) => b.reservationId).filter(Boolean);
  const index = entityId ? await getJson(`ord.${entityId}`).catch(() => null) : null;
  const ids = [...new Set([...fromItems, ...(index?.reservationIds || [])])];
  const results = await Promise.all(ids.map((id) => releaseReservation(id, { allowConfirmed: true })
    .then((r) => ({ id, ...r }))
    .catch((e) => ({ id, error: e.message }))));
  if (index) await remove(`ord.${entityId}`).catch(() => {});
  console.info('webhook-order-cancel', JSON.stringify({ entityId, orderNumber: index?.orderNumber, results }));
  return success();
};
