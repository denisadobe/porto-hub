/*
 * Commerce webhook, BEFORE the order is placed (e.g. observer.sales_order_place_before).
 * Blocks the order unless every service item carries a live reservation for that same service and
 * the shipping (installation) CEP matches the reservation. Gives the hold 10 more minutes so the
 * "order placed" webhook can confirm it.
 */
const {
  verify, success, exception, bookingsOf, shippingPostcodeOf, orderNumberOf,
} = require('../lib/webhook');
const { getReservation, extendHold } = require('../lib/agenda');
const { record, shape } = require('../lib/diagnostics');

const digits = (v) => String(v || '').replace(/\D/g, '');

const MSG = {
  missing: 'Para contratar este serviço, informe o CEP e escolha o dia e o turno na página do serviço.',
  expired: 'O horário reservado expirou. Volte à página do serviço e escolha o horário novamente.',
  otherService: 'O horário reservado não corresponde a este serviço. Escolha o horário novamente.',
  otherCep: 'O endereço de instalação deve ter o mesmo CEP usado no agendamento. Corrija o endereço ou agende de novo.',
  otherOrder: 'Este horário já foi confirmado em outro pedido. Escolha um novo horário.',
  unavailable: 'Não foi possível confirmar o agendamento agora. Tente novamente em instantes.',
};

exports.main = async (params) => {
  let payload;
  try {
    payload = verify(params);
  } catch (e) {
    console.error('webhook-order-validate:', e.message);
    await record('webhook-order-validate', {
      signature: 'failed', reason: e.message, headers: Object.keys(params.__ow_headers || {}), bodyLength: (params.__ow_body || '').length,
    });
    // unsigned or forged requests never pass (secure default)
    return exception(MSG.unavailable);
  }
  try {
    const bookings = bookingsOf(payload);
    const postcode = digits(shippingPostcodeOf(payload));
    const orderNumber = orderNumberOf(payload);
    console.info('webhook-order-validate', JSON.stringify({ orderNumber, postcode, bookings }));
    await record('webhook-order-validate', {
      signature: 'ok', eventName: payload.eventName, shape: shape(payload), bookings: bookings.length, withReservation: bookings.filter((b) => b.reservationId).length,
    });
    if (!bookings.length) return success();
    const requireBooking = String(params.REQUIRE_BOOKING ?? 'true') !== 'false';

    // eslint-disable-next-line no-restricted-syntax
    for (const { sku, reservationId } of bookings) {
      if (!reservationId) {
        if (requireBooking) return exception(MSG.missing);
        // eslint-disable-next-line no-continue
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const r = await getReservation(reservationId).catch(() => null);
      if (!r) return exception(MSG.expired);
      if (r.sku !== sku) return exception(MSG.otherService);
      if (postcode && digits(r.cep) !== postcode) return exception(MSG.otherCep);
      if (r.status === 'confirmed' && r.orderId && orderNumber && r.orderId !== orderNumber) {
        return exception(MSG.otherOrder);
      }
      // eslint-disable-next-line no-await-in-loop
      if (r.status === 'held') await extendHold(reservationId);
    }
    return success();
  } catch (e) {
    console.error('webhook-order-validate failed:', e);
    return exception(MSG.unavailable);
  }
};
