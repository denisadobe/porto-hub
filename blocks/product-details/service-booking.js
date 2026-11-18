/*
 * Porto Serviço booking flow, shown on the product page instead of "Add to Cart":
 *   1. CEP          -> coverage check (App Builder `coverage`, address from ViaCEP)
 *   2. Dia e turno  -> available shifts (`slots`) and a 15-minute hold (`reserve`)
 *   3. Endereço     -> installation address and contact
 *   4. Revisão      -> single-service cart in Commerce (booking stored as cart item custom
 *                      attributes, address set as shipping address) -> checkout
 * App Builder base URL: config.json > public.default["porto-booking"].api
 * Storage: localStorage keeps the customer id and last CEP; sessionStorage keeps the
 * reservation and address (personal data never outlives the browser session).
 */
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import * as cartApi from '@dropins/storefront-cart/api.js';
import { loadCSS } from '../../scripts/aem.js';
import { rootLink, checkIsAuthenticated } from '../../scripts/commerce.js';

const LOCAL_KEY = 'porto-booking';
const SESSION_KEY = 'porto-booking-session';
const CEP_HELP_URL = 'https://buscacepinter.correios.com.br/app/endereco/index.php';

const TEXT = {
  title: 'Agende seu serviço',
  intro: 'Em 4 passos rápidos: confira se atendemos o seu endereço, escolha o melhor dia e siga para o pagamento.',
  steps: ['Onde será o serviço?', 'Escolha o dia e o turno', 'Endereço e contato', 'Revise e confirme'],
  change: 'Alterar',
  cepLabel: 'CEP do local do serviço',
  cepCheck: 'Consultar',
  cepChecking: 'Consultando…',
  cepHelp: 'Não sei meu CEP',
  cepInvalid: 'Informe um CEP válido com 8 dígitos.',
  slotsHint: 'O técnico chega dentro da janela do turno escolhido.',
  slotsLoading: 'Carregando horários disponíveis…',
  slotsEmpty: 'Não há horários disponíveis nos próximos dias. Tente novamente mais tarde.',
  daysLabel: 'Dias disponíveis',
  shiftsLegend: (day) => `Turnos em ${day}`,
  soldOut: 'Esgotado',
  lastSpot: 'Última vaga',
  spots: (n) => `${n} vagas`,
  holding: 'Reservando horário…',
  held: (time) => `Horário reservado para você por ${time}.`,
  holdExpired: 'O tempo de reserva acabou. Escolha o horário novamente.',
  continue: 'Continuar',
  street: 'Rua / Avenida',
  number: 'Número',
  complement: 'Complemento (opcional)',
  neighborhood: 'Bairro',
  city: 'Cidade / UF',
  firstname: 'Nome',
  lastname: 'Sobrenome',
  telephone: 'Celular',
  email: 'E-mail',
  service: 'Serviço',
  when: 'Quando',
  where: 'Onde',
  contact: 'Contato',
  replaceNote: 'Cada compra agenda um serviço. Outros itens do carrinho serão substituídos por este.',
  checkout: 'Ir para o pagamento',
  preparing: 'Preparando seu pedido…',
  genericError: 'Não foi possível concluir agora. Tente novamente em instantes.',
};

/* ---------- small helpers ---------- */

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === false || v === null || v === undefined) return;
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  });
  node.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

function read(storage, key) {
  try {
    return JSON.parse(storage.getItem(key)) || {};
  } catch (e) {
    return {};
  }
}

function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (e) { /* storage full or disabled: the flow still works in memory */ }
}

function customerId() {
  const local = read(localStorage, LOCAL_KEY);
  if (!local.clientId) {
    local.clientId = crypto.randomUUID();
    write(localStorage, LOCAL_KEY, local);
  }
  return local.clientId;
}

const digits = (value) => String(value || '').replace(/\D/g, '');
const formatCep = (value) => {
  const d = digits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
const formatPhone = (value) => {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

function dayParts(date) {
  const d = new Date(`${date}T12:00:00Z`);
  const fmt = (opts) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts }).format(d);
  return {
    weekday: fmt({ weekday: 'short' }).replace('.', ''),
    day: fmt({ day: '2-digit' }),
    month: fmt({ month: 'short' }).replace('.', ''),
    long: fmt({ weekday: 'long', day: '2-digit', month: 'long' }),
  };
}

function scheduleText(reservation) {
  if (!reservation) return '';
  const { long } = dayParts(reservation.date);
  return `${long} · ${reservation.shift.label} (${reservation.shift.window})`;
}

function addressText(address, coverage) {
  if (!address || !coverage) return '';
  const a = coverage.address || {};
  const line = [address.street, address.number].filter(Boolean).join(', ');
  const extra = [address.complement, address.neighborhood].filter(Boolean).join(' - ');
  return `${line}${extra ? ` - ${extra}` : ''} - ${a.city}/${a.state} - CEP ${coverage.cep}`;
}

/* ---------- App Builder API ---------- */

class BookingError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function api(path, body) {
  const base = getConfigValue('porto-booking')?.api;
  if (!base) throw new BookingError(TEXT.genericError, 'not_configured');
  let res;
  try {
    res = await fetch(`${base}/${path}`, body ? {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    } : {});
  } catch (e) {
    throw new BookingError(TEXT.genericError, 'network');
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new BookingError(json.error?.message || TEXT.genericError, json.error?.code, res.status);
  }
  return json;
}

/* ---------- Commerce cart ---------- */

let regionsPromise;
function brazilRegionId(code) {
  regionsPromise = regionsPromise || cartApi.fetchGraphQl(
    'query PortoRegions($id: String) { country(id: $id) { available_regions { id code } } }',
    { method: 'GET', variables: { id: getConfigValue('porto-booking')?.['country-code'] || 'BR' } },
  ).then(({ data }) => data?.country?.available_regions || []);
  return regionsPromise.then((regions) => regions.find((r) => r.code === code)?.id);
}

async function cartGraphQl(query, variables) {
  const { data, errors } = await cartApi.fetchGraphQl(query, { variables });
  if (errors?.length) throw new BookingError(errors[0].message || TEXT.genericError, 'commerce');
  return data;
}

const SET_ITEM_ATTRIBUTES = `mutation PortoBookingItem($input: CartItemCustomAttributesInput) {
  setCustomAttributesOnCartItem(input: $input) { cart { id } } }`;
const SET_ADDRESSES = `mutation PortoBookingAddress($cartId: String!, $address: CartAddressInput!) {
  setShippingAddressesOnCart(input: { cart_id: $cartId, shipping_addresses: [{ address: $address }] }) {
    cart { shipping_addresses { available_shipping_methods { carrier_code method_code available } } } }
  setBillingAddressOnCart(input: { cart_id: $cartId, billing_address: { same_as_shipping: true } }) { cart { id } } }`;
const SET_EMAIL = `mutation PortoBookingEmail($cartId: String!, $email: String!) {
  setGuestEmailOnCart(input: { cart_id: $cartId, email: $email }) { cart { id } } }`;
const SET_SHIPPING_METHOD = `mutation PortoBookingMethod($cartId: String!, $carrier: String!, $method: String!) {
  setShippingMethodsOnCart(input: { cart_id: $cartId, shipping_methods: [{ carrier_code: $carrier, method_code: $method }] }) { cart { id } } }`;

/** Empties the cart, adds the service with the booking, sets address/contact. */
async function prepareCart(sku, { reservation, coverage, address }) {
  // first-time visitors have no cart yet: getCartData throws "No cart ID found";
  // addProductsToCart below creates it
  const current = await cartApi.getCartData().catch(() => null);
  const others = (current?.items || []).map((item) => ({ uid: item.uid, quantity: 0 }));
  if (others.length) await cartApi.updateProductsFromCart(others);

  const cart = await cartApi.addProductsToCart([{ sku, quantity: 1 }]);
  const item = cart?.items?.find((i) => i.sku === sku || i.topLevelSku === sku) || cart?.items?.[0];
  if (!cart?.id || !item) throw new BookingError(TEXT.genericError, 'cart');

  await cartGraphQl(SET_ITEM_ATTRIBUTES, {
    input: {
      cart_id: cart.id,
      cart_item_id: item.uid,
      custom_attributes: [
        { attribute_code: 'porto_reservation_id', value: reservation.id },
        { attribute_code: 'porto_schedule', value: scheduleText(reservation) },
        { attribute_code: 'porto_cep', value: coverage.cep },
        { attribute_code: 'porto_region', value: coverage.region?.id || '' },
      ],
    },
  });

  const a = coverage.address || {};
  const data = await cartGraphQl(SET_ADDRESSES, {
    cartId: cart.id,
    address: {
      firstname: address.firstname,
      lastname: address.lastname,
      telephone: digits(address.telephone),
      // one line: the checkout form joins multiple street lines into its first field
      street: [[`${address.street}, ${address.number}`, address.complement, address.neighborhood].filter(Boolean).join(' - ')],
      city: a.city,
      region: a.state,
      region_id: await brazilRegionId(a.state),
      postcode: coverage.cep,
      country_code: getConfigValue('porto-booking')?.['country-code'] || 'BR',
      save_in_address_book: false,
    },
  });
  if (!checkIsAuthenticated() && address.email) {
    await cartGraphQl(SET_EMAIL, { cartId: cart.id, email: address.email });
  }

  const methods = data?.setShippingAddressesOnCart?.cart?.shipping_addresses?.[0]
    ?.available_shipping_methods || [];
  const method = methods.find((m) => m.available !== false);
  if (method) {
    await cartGraphQl(SET_SHIPPING_METHOD, {
      cartId: cart.id, carrier: method.carrier_code, method: method.method_code,
    });
  }
  await cartApi.refreshCart();
}

/* ---------- UI ---------- */

export default function renderServiceBooking(container, { getProduct }) {
  loadCSS(`${window.hlx.codeBasePath}/blocks/product-details/service-booking.css`);

  const session = read(sessionStorage, SESSION_KEY);
  const state = {
    step: 0,
    coverage: null,
    reservation: session.reservation || null,
    address: session.address || null,
    days: [],
    selectedDate: session.reservation?.date || null,
    notice: null,
  };
  let timer;

  const persist = () => {
    write(sessionStorage, SESSION_KEY, {
      reservation: state.reservation,
      address: state.address,
      sku: getProduct()?.sku,
      productUrl: window.location.pathname,
    });
    const local = read(localStorage, LOCAL_KEY);
    if (state.coverage) local.cep = state.coverage.cep;
    write(localStorage, LOCAL_KEY, local);
  };
  const sku = () => getProduct()?.sku;

  /* ----- skeleton ----- */
  const stepEls = TEXT.steps.map((title, i) => {
    const summary = el('p', { className: 'service-booking__summary' });
    const change = el('button', {
      type: 'button', className: 'service-booking__change', text: TEXT.change, 'aria-label': `${TEXT.change}: ${title}`,
    });
    const body = el('div', { className: 'service-booking__body', id: `service-booking-step-${i + 1}` });
    const li = el(
      'li',
      { className: 'service-booking__step', 'data-state': 'locked' },
      el(
        'div',
        { className: 'service-booking__header' },
        el('span', { className: 'service-booking__number', 'aria-hidden': 'true', text: String(i + 1) }),
        el('div', { className: 'service-booking__heading' }, el('h3', { text: title }), summary),
        change,
      ),
      body,
    );
    return {
      li, body, summary, change,
    };
  });

  const root = el(
    'section',
    { className: 'service-booking', 'aria-labelledby': 'service-booking-title' },
    el('h2', { id: 'service-booking-title', text: TEXT.title }),
    el('p', { className: 'service-booking__intro', text: TEXT.intro }),
    el('ol', { className: 'service-booking__steps' }, stepEls.map((s) => s.li)),
  );
  container.replaceChildren(root);

  function message(target, text, kind = 'info') {
    target.textContent = text || '';
    target.dataset.kind = kind;
  }

  function summaries() {
    stepEls[0].summary.textContent = state.coverage
      ? [state.coverage.cep, state.coverage.address?.street, state.coverage.address?.neighborhood].filter(Boolean).join(' · ')
      : '';
    stepEls[1].summary.textContent = scheduleText(state.reservation);
    stepEls[2].summary.textContent = state.address ? `${state.address.firstname} · ${addressText(state.address, state.coverage)}` : '';
  }

  function goTo(step, { focus = true } = {}) {
    state.step = step;
    stepEls.forEach((s, i) => {
      let stepState = 'locked';
      if (i < step) stepState = 'done';
      else if (i === step) stepState = 'active';
      s.li.dataset.state = stepState;
      s.body.hidden = i !== step;
      s.change.hidden = stepState !== 'done';
      if (i === step) s.li.setAttribute('aria-current', 'step');
      else s.li.removeAttribute('aria-current');
    });
    summaries();
    // eslint-disable-next-line no-use-before-define
    [renderCep, renderSlots, renderAddress, renderReview][step]();
    if (focus) {
      const target = stepEls[step].body.querySelector('input:not([disabled]), button:not([disabled])');
      target?.focus({ preventScroll: true });
      stepEls[step].li.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  stepEls.forEach((s, i) => s.change.addEventListener('click', () => goTo(i)));

  /* ----- hold timer ----- */
  function stopTimer() {
    clearInterval(timer);
    timer = null;
  }

  function startTimer(output) {
    stopTimer();
    const tick = () => {
      const left = state.reservation ? Date.parse(state.reservation.expiresAt) - Date.now() : 0;
      if (left <= 0) {
        stopTimer();
        const expired = !!state.reservation;
        state.reservation = null;
        persist();
        if (expired) {
          state.notice = { text: TEXT.holdExpired, kind: 'warning' };
          goTo(1);
        }
        return;
      }
      const m = Math.floor(left / 60000);
      const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
      if (output) message(output, TEXT.held(`${m}:${s}`), 'success');
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  /* ----- step 1: CEP ----- */
  async function checkCep(cep, output, button) {
    if (digits(cep).length !== 8) {
      message(output, TEXT.cepInvalid, 'error');
      return false;
    }
    if (button) {
      button.disabled = true;
      button.textContent = TEXT.cepChecking;
    }
    try {
      const result = await api(`coverage?cep=${digits(cep)}&sku=${encodeURIComponent(sku())}`);
      if (!result.served) {
        message(output, result.message, 'warning');
        return false;
      }
      if (state.coverage?.cep !== result.cep && state.reservation) {
        api('release', { reservationId: state.reservation.id }).catch(() => {});
        state.reservation = null;
      }
      state.coverage = result;
      persist();
      message(output, result.message, 'success');
      return true;
    } catch (e) {
      message(output, e.message, 'error');
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = TEXT.cepCheck;
      }
    }
  }

  function renderCep() {
    const input = el('input', {
      id: 'service-booking-cep',
      name: 'cep',
      inputmode: 'numeric',
      autocomplete: 'postal-code',
      placeholder: '00000-000',
      maxlength: '9',
      required: true,
      value: state.coverage?.cep || read(localStorage, LOCAL_KEY).cep || '',
      'aria-describedby': 'service-booking-cep-msg',
    });
    input.addEventListener('input', () => { input.value = formatCep(input.value); });
    const button = el('button', { type: 'submit', className: 'button', text: TEXT.cepCheck });
    const output = el('p', {
      id: 'service-booking-cep-msg', className: 'service-booking__message', role: 'status', 'aria-live': 'polite',
    });
    const form = el(
      'form',
      { className: 'service-booking__cep', novalidate: true },
      el('label', { for: 'service-booking-cep', text: TEXT.cepLabel }),
      el('div', { className: 'service-booking__row' }, input, button),
      el('a', {
        href: CEP_HELP_URL, target: '_blank', rel: 'noopener', className: 'service-booking__help', text: TEXT.cepHelp,
      }),
      output,
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await checkCep(input.value, output, button)) goTo(1);
    });
    stepEls[0].body.replaceChildren(form);
  }

  /* ----- step 2: day + shift ----- */
  async function reserve(date, shift, output, group) {
    group.querySelectorAll('input').forEach((i) => { i.disabled = true; });
    message(output, TEXT.holding);
    try {
      state.reservation = await api('reserve', {
        cep: state.coverage.cep,
        sku: sku(),
        date,
        shift,
        clientId: customerId(),
        replaces: state.reservation?.id,
      });
      persist();
      summaries();
      startTimer(output);
      return true;
    } catch (e) {
      message(output, e.message, e.code === 'too_many_holds' ? 'warning' : 'error');
      return false;
    }
  }

  function renderSlots() {
    const { body } = stepEls[1];
    const output = el('p', { className: 'service-booking__message', role: 'status', 'aria-live': 'polite' });
    const days = el('div', { className: 'service-booking__days', role: 'radiogroup', 'aria-label': TEXT.daysLabel });
    const shifts = el('fieldset', { className: 'service-booking__shifts' });
    const next = el('button', {
      type: 'button', className: 'button', text: TEXT.continue, disabled: !state.reservation,
    });
    next.addEventListener('click', () => { if (state.reservation) goTo(2); });
    body.replaceChildren(el('p', { className: 'service-booking__hint', text: TEXT.slotsHint }), days, shifts, output, next);

    function drawShifts() {
      const day = state.days.find((d) => d.date === state.selectedDate);
      if (!day) {
        shifts.replaceChildren();
        shifts.hidden = true;
        return;
      }
      shifts.hidden = false;
      shifts.replaceChildren(
        el('legend', { text: TEXT.shiftsLegend(dayParts(day.date).long) }),
        ...day.shifts.map((s) => {
          const mine = state.reservation?.date === day.date
            && state.reservation?.shift?.id === s.id;
          let availability = TEXT.spots(s.remaining);
          if (mine) availability = '';
          else if (!s.available) availability = TEXT.soldOut;
          else if (s.remaining === 1) availability = TEXT.lastSpot;
          const input = el('input', {
            type: 'radio', name: 'service-booking-shift', value: s.id, checked: mine, disabled: !s.available && !mine,
          });
          input.addEventListener('change', async () => {
            next.disabled = true;
            const ok = await reserve(day.date, s.id, output, shifts);
            // eslint-disable-next-line no-use-before-define
            await loadSlots({ keepMessage: true });
            next.disabled = !ok || !state.reservation;
          });
          return el(
            'label',
            { className: `service-booking__shift${!s.available && !mine ? ' is-soldout' : ''}` },
            input,
            el('span', { className: 'service-booking__shift-label', text: s.label }),
            el('span', { className: 'service-booking__shift-window', text: s.window }),
            availability ? el('span', { className: 'service-booking__shift-spots', text: availability }) : null,
          );
        }),
      );
    }

    function drawDays() {
      days.replaceChildren(...state.days.map((d) => {
        const p = dayParts(d.date);
        const hasSpots = d.shifts.some((s) => s.available) || state.reservation?.date === d.date;
        const input = el('input', {
          type: 'radio', name: 'service-booking-day', value: d.date, checked: d.date === state.selectedDate, disabled: !hasSpots,
        });
        input.addEventListener('change', () => {
          state.selectedDate = d.date;
          drawShifts();
        });
        return el(
          'label',
          { className: `service-booking__day${hasSpots ? '' : ' is-soldout'}`, title: p.long },
          input,
          el('span', { className: 'service-booking__day-weekday', text: p.weekday }),
          el('span', { className: 'service-booking__day-date', text: p.day }),
          el('span', { className: 'service-booking__day-month', text: p.month }),
        );
      }));
    }

    async function loadSlots({ keepMessage = false } = {}) {
      if (!keepMessage) message(output, TEXT.slotsLoading);
      try {
        const res = await api(`slots?cep=${digits(state.coverage.cep)}&sku=${encodeURIComponent(sku())}&days=14`);
        state.days = res.days;
        if (!state.days.length) {
          message(output, TEXT.slotsEmpty, 'warning');
          return;
        }
        if (!state.days.some((d) => d.date === state.selectedDate)) {
          const firstOpen = state.days.find((d) => d.shifts.some((s) => s.available));
          state.selectedDate = (firstOpen || state.days[0]).date;
        }
        drawDays();
        drawShifts();
        if (state.reservation) startTimer(output);
        else if (state.notice) message(output, state.notice.text, state.notice.kind);
        else if (!keepMessage) message(output, '');
        state.notice = null;
      } catch (e) {
        message(output, e.message, 'error');
      }
    }

    loadSlots();
  }

  /* ----- step 3: address + contact ----- */
  function field(name, label, attrs = {}, value = '') {
    const id = `service-booking-${name}`;
    const input = el('input', {
      id, name, value: value || '', ...attrs,
    });
    return el('div', { className: `service-booking__field service-booking__field--${name}` }, el('label', { for: id, text: label }), input);
  }

  function renderAddress() {
    const a = state.coverage?.address || {};
    const saved = state.address || {};
    const guest = !checkIsAuthenticated();
    const form = el(
      'form',
      { className: 'service-booking__address' },
      field('street', TEXT.street, { required: true, autocomplete: 'address-line1' }, saved.street || a.street),
      field('number', TEXT.number, { required: true, inputmode: 'numeric' }, saved.number),
      field('complement', TEXT.complement, { autocomplete: 'address-line2' }, saved.complement),
      field('neighborhood', TEXT.neighborhood, { required: true }, saved.neighborhood || a.neighborhood),
      field('city', TEXT.city, { readonly: true, tabindex: '-1' }, [a.city, a.state].filter(Boolean).join(' / ')),
      field('firstname', TEXT.firstname, { required: true, autocomplete: 'given-name' }, saved.firstname),
      field('lastname', TEXT.lastname, { required: true, autocomplete: 'family-name' }, saved.lastname),
      field('telephone', TEXT.telephone, {
        required: true, type: 'tel', autocomplete: 'tel-national', inputmode: 'tel', placeholder: '(11) 99999-9999', pattern: '\\(\\d{2}\\) \\d{4,5}-\\d{4}',
      }, saved.telephone),
      guest ? field('email', TEXT.email, { required: true, type: 'email', autocomplete: 'email' }, saved.email) : null,
      el('button', { type: 'submit', className: 'button', text: TEXT.continue }),
    );
    const phone = form.querySelector('[name="telephone"]');
    phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      delete values.city;
      state.address = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, String(v).trim()]),
      );
      persist();
      goTo(3);
    });
    stepEls[2].body.replaceChildren(form);
  }

  /* ----- step 4: review + cart ----- */
  function renderReview() {
    const product = getProduct();
    const output = el('p', { className: 'service-booking__message', role: 'status', 'aria-live': 'polite' });
    const button = el('button', { type: 'button', className: 'button service-booking__checkout', text: TEXT.checkout });
    const row = (label, value) => [el('dt', { text: label }), el('dd', { text: value })];
    stepEls[3].body.replaceChildren(
      el(
        'dl',
        { className: 'service-booking__review' },
        row(TEXT.service, product?.name || product?.sku || ''),
        row(TEXT.when, scheduleText(state.reservation)),
        row(TEXT.where, addressText(state.address, state.coverage)),
        row(TEXT.contact, [`${state.address.firstname} ${state.address.lastname}`, state.address.telephone, state.address.email].filter(Boolean).join(' · ')),
      ),
      el('p', { className: 'service-booking__note', text: TEXT.replaceNote }),
      button,
      output,
    );
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = TEXT.preparing;
      message(output, '');
      try {
        state.reservation = await api(`reservation?id=${state.reservation.id}`);
        await prepareCart(product.sku, state);
        persist();
        window.location.href = rootLink('/checkout');
      } catch (e) {
        if (e.code === 'reservation_not_found') {
          state.reservation = null;
          state.notice = { text: TEXT.holdExpired, kind: 'warning' };
          persist();
          goTo(1);
          return;
        }
        message(output, e.message, 'error');
        button.disabled = false;
        button.textContent = TEXT.checkout;
      }
    });
  }

  /* ----- resume where the customer left off ----- */
  (async () => {
    const lastCep = read(localStorage, LOCAL_KEY).cep;
    const sameProduct = read(sessionStorage, SESSION_KEY).sku === sku();
    if (!lastCep || !sku()) {
      goTo(0, { focus: false });
      return;
    }
    const probe = el('p');
    if (!(await checkCep(lastCep, probe))) {
      goTo(0, { focus: false });
      message(stepEls[0].body.querySelector('.service-booking__message'), probe.textContent, probe.dataset.kind);
      return;
    }
    if (!sameProduct && state.reservation) {
      api('release', { reservationId: state.reservation.id }).catch(() => {});
      state.reservation = null;
      persist();
    }
    if (state.reservation) {
      state.reservation = await api(`reservation?id=${state.reservation.id}`).catch(() => null);
      persist();
    }
    if (state.reservation && state.address) goTo(3, { focus: false });
    else goTo(1, { focus: false });
  })();
}
