/*
 * "Agendamento" box on the cart and checkout pages: shows the booked day/shift and the
 * installation address chosen in the product page flow (blocks/product-details/service-booking.js),
 * with the remaining hold time. Hidden when the cart no longer has the booked service.
 */
import { events } from '@dropins/tools/event-bus.js';
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import { loadCSS } from './aem.js';

const SESSION_KEY = 'porto-booking-session';

function readBooking() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function longDay(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long',
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function renderBookingSummary(block) {
  const {
    reservation, address, sku, productUrl,
  } = readBooking();
  if (!reservation?.date || !reservation?.shift) return;
  loadCSS(`${window.hlx.codeBasePath}/styles/porto-booking-summary.css`);

  const box = document.createElement('aside');
  box.className = 'porto-booking-summary';
  box.setAttribute('aria-label', 'Agendamento do serviço');
  const when = `${longDay(reservation.date)} · ${reservation.shift.label} (${reservation.shift.window})`;
  const where = address ? [`${address.street}, ${address.number}`, address.complement, address.neighborhood].filter(Boolean).join(' - ') : '';
  box.innerHTML = `
    <p class="porto-booking-summary__title">Agendamento do serviço</p>
    <p class="porto-booking-summary__when"></p>
    <p class="porto-booking-summary__where"></p>
    <p class="porto-booking-summary__hold" role="status" aria-live="polite"></p>
    <a class="porto-booking-summary__change">Alterar agendamento</a>`;
  box.querySelector('.porto-booking-summary__when').textContent = when.charAt(0).toUpperCase() + when.slice(1);
  box.querySelector('.porto-booking-summary__where').textContent = where;
  const change = box.querySelector('.porto-booking-summary__change');
  if (productUrl) change.href = productUrl;
  else change.remove();
  block.before(box);

  // remaining hold time (the booking is confirmed when the order is placed)
  const hold = box.querySelector('.porto-booking-summary__hold');
  const tick = () => {
    const left = Date.parse(reservation.expiresAt) - Date.now();
    if (!reservation.expiresAt || reservation.status === 'confirmed') {
      hold.textContent = '';
      return false;
    }
    if (left <= 0) {
      hold.textContent = 'O horário reservado expirou. Volte e escolha o horário novamente antes de finalizar.';
      hold.dataset.kind = 'warning';
      return false;
    }
    const m = Math.floor(left / 60000);
    const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    hold.textContent = `Horário reservado por mais ${m}:${s}. Ele é confirmado quando você finaliza o pedido.`;
    return true;
  };
  let timer;
  if (tick()) timer = setInterval(() => { if (!tick()) clearInterval(timer); }, 1000);

  // hide when the booked service is no longer in the cart (until the order is placed)
  let orderPlaced = false;
  events.on('cart/data', (cart) => {
    if (orderPlaced) return;
    const items = cart?.items || [];
    box.hidden = !items.some((i) => i.sku === sku || i.topLevelSku === sku);
  }, { eager: true });

  // order placed: Commerce calls App Builder (order webhook), which confirms the booking.
  // Poll the reservation for a few seconds to show the confirmation, then forget the session.
  events.on('order/placed', async (order) => {
    orderPlaced = true;
    clearInterval(timer);
    box.hidden = false;
    box.classList.add('is-placed');
    box.querySelector('.porto-booking-summary__title').textContent = 'Agendamento do serviço';
    change.remove();
    hold.dataset.kind = '';
    hold.textContent = 'Confirmando seu agendamento…';
    sessionStorage.removeItem(SESSION_KEY);
    const base = getConfigValue('porto-booking')?.api;
    let confirmed = null;
    for (let i = 0; base && i < 8 && !confirmed; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(`${base}/reservation?id=${reservation.id}`).then((res) => (res.ok ? res.json() : null)).catch(() => null);
      if (r?.status === 'confirmed') confirmed = r;
      // eslint-disable-next-line no-await-in-loop
      else await new Promise((resolve) => { setTimeout(resolve, 1500); });
    }
    const number = confirmed?.orderId || order?.number;
    if (confirmed) {
      box.classList.add('is-confirmed');
      box.querySelector('.porto-booking-summary__title').textContent = 'Agendamento confirmado';
      hold.textContent = `Pedido ${number}. Um técnico Porto vai até você na data e turno acima.`;
    } else {
      hold.textContent = `Pedido ${number || ''} recebido. A confirmação do agendamento chega por e-mail.`;
    }
  });
}
