/*
 * Commerce webhook, AFTER the order is placed (e.g. observer.sales_order_place_after).
 * Confirms each reservation with the order number. Never blocks the order: problems are logged.
 */
const {
  verify, success, bookingsOf, orderNumberOf,
} = require('../lib/webhook');
const { confirmReservation } = require('../lib/agenda');

exports.main = async (params) => {
  let payload;
  try {
    payload = verify(params);
  } catch (e) {
    console.error('webhook-order-placed:', e.message);
    return success();
  }
  const orderNumber = orderNumberOf(payload);
  const results = await Promise.all(bookingsOf(payload)
    .filter((b) => b.reservationId)
    .map((b) => confirmReservation(b.reservationId, { orderId: orderNumber })
      .then((r) => ({ id: b.reservationId, status: r.status }))
      .catch((e) => ({ id: b.reservationId, error: e.message }))));
  console.info('webhook-order-placed', JSON.stringify({ orderNumber, results }));
  return success();
};
