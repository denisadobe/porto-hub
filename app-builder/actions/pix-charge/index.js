/* POST { orderNumber, amount } -> simulated Pix charge { txid, brcode, qrSvg, status } (demo PSP) */
const { webAction } = require('../lib/http');
const { createCharge } = require('../lib/pix');

exports.main = webAction(['post'], (params) => createCharge({ orderNumber: params.orderNumber, amount: params.amount }));
