/*
 * Commerce webhook, AFTER the order is placed: plugin.sales.api.order_management.place (after).
 * Confirms each reservation with the order number and remembers which reservations belong to the
 * order (key ord.<entity_id>), because the cancel webhook only receives the order id.
 * Never blocks the order: problems are logged.
 */
const {
  verify, success, bookingsOf, orderNumberOf, orderEntityIdOf,
} = require('../lib/webhook');
const { confirmReservation, scheduleLabel } = require('../lib/agenda');
const { putJson } = require('../lib/store');
const { record, shape } = require('../lib/diagnostics');

exports.main = async (params) => {
  let payload;
  try {
    payload = verify(params);
  } catch (e) {
    console.error('webhook-order-placed:', e.message);
    await record('webhook-order-placed', {
      signature: 'failed', reason: e.message, headers: Object.keys(params.__ow_headers || {}), bodyLength: (params.__ow_body || '').length,
    });
    return success();
  }
  const orderNumber = orderNumberOf(payload);
  const entityId = orderEntityIdOf(payload);
  const ids = bookingsOf(payload).map((b) => b.reservationId).filter(Boolean);
  const results = await Promise.all(ids.map((id) => confirmReservation(id, { orderId: orderNumber })
    .then((r) => ({ id, status: r.status, schedule: scheduleLabel(r) }))
    .catch((e) => ({ id, error: e.message }))));
  if (entityId && ids.length) {
    await putJson(`ord.${entityId}`, { orderNumber, reservationIds: ids })
      .catch((e) => console.error('webhook-order-placed: order index', e.message));
  }
  const confirmed = results.find((r) => r.status === 'confirmed');
  if (orderNumber && confirmed) {
    // orders grid column (Admin UI SDK) looks bookings up by order number
    await putJson(`ordn.${orderNumber}`, {
      orderNumber, entityId, reservationIds: ids, schedule: confirmed.schedule, status: 'confirmed',
    }).catch((e) => console.error('webhook-order-placed: order number index', e.message));
  }
  console.info('webhook-order-placed', JSON.stringify({ orderNumber, entityId, results }));
  await record('webhook-order-placed', {
    signature: 'ok', eventName: payload.eventName, shape: shape(payload), entityId, hasOrderNumber: !!orderNumber, results,
  });
  return success();
};
