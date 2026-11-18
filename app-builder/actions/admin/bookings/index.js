/*
 * Admin: bookings (held and confirmed reservations).
 * GET  -> { bookings: [...] } sorted by date and shift
 * POST { action: 'release', id } -> frees the shift (also confirmed ones, e.g. orders cancelled
 *      before the cancel webhook existed)
 */
const { HttpError } = require('../../lib/http');
const { adminAction } = require('../../lib/admin');
const { listKeys, getJson, putJson } = require('../../lib/store');
const { releaseReservation, publicReservation, validateReservationId } = require('../../lib/agenda');

async function listBookings() {
  const keys = await listKeys('rsv.*');
  const all = (await Promise.all(keys.map((k) => getJson(k)))).filter(Boolean).map(publicReservation);
  return all.sort((a, b) => `${a.date}${a.shift?.start || a.shift?.id}`.localeCompare(`${b.date}${b.shift?.start || b.shift?.id}`));
}

exports.main = adminAction(['get', 'post'], async (params) => {
  const method = (params.__ow_method || 'get').toLowerCase();
  if (method === 'get') return { bookings: await listBookings() };
  if (params.action !== 'release') throw new HttpError(400, 'invalid_action', 'Ação inválida.');
  const id = validateReservationId(params.id);
  const before = await getJson(`rsv.${id}`);
  const result = await releaseReservation(id, { allowConfirmed: true });
  if (before?.orderId) {
    const idx = await getJson(`ordn.${before.orderId}`);
    if (idx) await putJson(`ordn.${before.orderId}`, { ...idx, status: 'released' });
  }
  return result;
});
