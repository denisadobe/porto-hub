/*
 * Commerce webhook, AFTER an order is cancelled (e.g. observer.order_cancel_after).
 * Frees the booked shifts so other customers can book them. Never blocks the cancellation.
 */
const {
  verify, success, bookingsOf, orderNumberOf,
} = require('../lib/webhook');
const { releaseReservation } = require('../lib/agenda');

exports.main = async (params) => {
  let payload;
  try {
    payload = verify(params);
  } catch (e) {
    console.error('webhook-order-cancel:', e.message);
    return success();
  }
  const orderNumber = orderNumberOf(payload);
  const results = await Promise.all(bookingsOf(payload)
    .filter((b) => b.reservationId)
    .map((b) => releaseReservation(b.reservationId, { allowConfirmed: true })
      .then((r) => ({ id: b.reservationId, ...r }))
      .catch((e) => ({ id: b.reservationId, error: e.message }))));
  console.info('webhook-order-cancel', JSON.stringify({ orderNumber, results }));
  return success();
};
