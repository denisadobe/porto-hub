/* POST { cep, sku, date: "2026-11-23", shift: "manha", replaces?: "<previous reservationId>" } */
const { webAction } = require('../lib/http');
const { requireCoverage } = require('../lib/coverage');
const { reserveSlot, validateReservationId } = require('../lib/agenda');

exports.main = webAction(['post'], async (params) => {
  const { cep, sku, region } = await requireCoverage({ cep: params.cep, sku: params.sku });
  const replaces = params.replaces ? validateReservationId(params.replaces) : undefined;
  return reserveSlot({
    cep, sku, region, date: params.date, shift: params.shift, replaces,
  });
});
