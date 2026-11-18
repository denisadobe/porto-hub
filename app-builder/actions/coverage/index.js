/* GET ?cep=01310100&sku=ADB201 -> { served, region, address, message } */
const { webAction } = require('../lib/http');
const { checkCoverage } = require('../lib/coverage');

exports.main = webAction(['get'], (params) => checkCoverage({ cep: params.cep, sku: params.sku }));
