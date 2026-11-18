/* GET ?id=<reservationId> -> reservation (status held | confirmed) */
const { webAction, HttpError } = require('../lib/http');
const { getReservation, publicReservation } = require('../lib/agenda');

exports.main = webAction(['get'], async (params) => {
  const reservation = await getReservation(params.id);
  if (!reservation) {
    throw new HttpError(404, 'reservation_not_found', 'Reserva não encontrada ou expirada. Escolha o horário novamente.');
  }
  return publicReservation(reservation);
});
