/* GET -> last order webhook calls (payload shape + decision, no personal data). For troubleshooting. */
const { webAction } = require('../lib/http');
const { recent } = require('../lib/diagnostics');

exports.main = webAction(['get'], async () => ({ calls: await recent(20) }));
