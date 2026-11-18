/*
 * Commerce webhook, AFTER the order is placed: plugin.sales.api.order_management.place (after).
 * Confirms each reservation with the order number and remembers which reservations belong to the
 * order (key ord.<entity_id>), because the cancel webhook only receives the order id.
 * Never blocks the order: problems are logged.
 */
const {
  verify, success, bookingsOf, orderNumberOf, orderEntityIdOf,
} = require('../lib/webhook');
const { confirmReservation } = require('../lib/agenda');
const { putJson } = require('../lib/store');

exports.main = async (params) => {
  let payload;
  try {
    payload = verify(params);
  } catch (e) {
    console.error('webhook-order-placed:', e.message);
    return success();
  }
  const orderNumber = orderNumberOf(payload);
  const entityId = orderEntityIdOf(payload);
  const ids = bookingsOf(payload).map((b) => b.reservationId).filter(Boolean);
  const results = await Promise.all(ids.map((id) => confirmReservation(id, { orderId: orderNumber })
    .then((r) => ({ id, status: r.status }))
    .catch((e) => ({ id, error: e.message }))));
  if (entityId && ids.length) {
    await putJson(`ord.${entityId}`, { orderNumber, reservationIds: ids })
      .catch((e) => console.error('webhook-order-placed: order index', e.message));
  }
  console.info('webhook-order-placed', JSON.stringify({ orderNumber, entityId, results }));
  return success();
};
