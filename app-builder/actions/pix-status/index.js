/* GET ?txid= -> { status: pending | paid, paidAt } (the demo PSP "receives" the payment after a few seconds) */
const { webAction } = require('../lib/http');
const { chargeStatus } = require('../lib/pix');

exports.main = webAction(['get'], (params) => chargeStatus(params.txid));
