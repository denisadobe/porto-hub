/* POST { reservationId } -> { released } (only held reservations; confirmed ones are released by order cancellation) */
const { webAction } = require('../lib/http');
const { releaseReservation } = require('../lib/agenda');

exports.main = webAction(['post'], (params) => releaseReservation(params.reservationId));
