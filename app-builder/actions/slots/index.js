/* GET ?cep=01310100&sku=ADB201&days=14 -> { region, holdMinutes, days: [{ date, label, shifts }] } */
const { webAction, HttpError } = require('../lib/http');
const { requireCoverage } = require('../lib/coverage');
const { availableSlots } = require('../lib/agenda');

exports.main = webAction(['get'], async (params) => {
  const { cep, sku, region } = await requireCoverage({ cep: params.cep, sku: params.sku });
  let days;
  if (params.days !== undefined) {
    days = Number(params.days);
    if (!Number.isInteger(days) || days < 1 || days > 60) {
      throw new HttpError(400, 'invalid_days', 'Período inválido.');
    }
  }
  return { cep, sku, ...(await availableSlots(region, { days })) };
});
