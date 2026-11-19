/*
 * Porto Serviço demo payments, on top of two offline Commerce methods (renamed in the Admin):
 *   - purchaseorder -> "Cartão de crédito": card form rendered here. SIMULATED: card data never
 *     leaves the browser; only brand + last 4 digits + installments go to the order (as the
 *     purchase order number). Only well-known test card numbers are accepted.
 *   - banktransfer  -> "Pix": after the order is placed, the App Builder demo PSP (pix-charge)
 *     returns a real-format BR Code (fictitious key) + QR code, and "receives" the payment a few
 *     seconds later (pix-status).
 */
import { events } from '@dropins/tools/event-bus.js';
import { getConfigValue } from '@dropins/tools/lib/aem/configs.js';
import * as checkoutApi from '@dropins/storefront-checkout/api.js';
import { loadCSS } from '../../scripts/aem.js';

const CARD_CODE = 'purchaseorder';
const PIX_CODE = 'banktransfer';
const PO_FORM_NAME = 'purchase-order'; // validated by the checkout before placing the order

const TEST_CARDS = new Set([
  '4111111111111111', '4242424242424242', '4000000000000002', '5555555555554444', '5105105105105100',
  '2223003122003222', '378282246310005', '371449635398431', '6362970000457013', '6062825624254001',
]);

function css() {
  loadCSS(`${window.hlx.codeBasePath}/blocks/commerce-checkout/porto-payments.css`);
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === false || v === null || v === undefined) return;
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v === true ? '' : v);
  });
  node.append(...children.filter(Boolean));
  return node;
}

const digits = (v) => String(v || '').replace(/\D/g, '');

function cartTotal() {
  const cart = events.lastPayload('cart/data');
  const total = cart?.total?.includingTax || cart?.total?.excludingTax;
  return { value: Number(total?.value) || 0, currency: total?.currency || 'BRL' };
}

function money(value, currency) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value);
}

export function cardBrand(number) {
  const n = digits(number);
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return 'Elo';
  if (/^(606282|3841)/.test(n)) return 'Hipercard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'Mastercard';
  if (/^4/.test(n)) return 'Visa';
  return '';
}

export function luhn(number) {
  const n = digits(number);
  if (n.length < 13 || n.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < n.length; i += 1) {
    let d = Number(n[n.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function expiryValid(value, now = new Date()) {
  const m = String(value || '').match(/^(\d{2})\/(\d{2})$/);
  if (!m) return false;
  const month = Number(m[1]);
  const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

const formatCard = (v) => digits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (v) => {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function installmentOptions() {
  const { value, currency } = cartTotal();
  const max = value ? Math.max(1, Math.min(10, Math.floor(value / 5))) : 1;
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const label = value ? `${n}x de ${money(value / n, currency)} sem juros` : `${n}x sem juros`;
    const cash = value ? `À vista – ${money(value, currency)}` : 'À vista';
    return { value: String(n), label: n === 1 ? cash : label };
  });
}

/* ---------------- card (purchaseorder) ---------------- */

// set by renderCard; called by the checkout right before placing the order
let syncCardNow = async () => true;

/** Ensures the masked card summary is on the cart before placing the order. */
export async function prepareCardPayment(code) {
  if (code !== CARD_CODE) return true;
  return syncCardNow();
}

function renderCard(ctx) {
  css();
  const field = (id, label, input, hint) => el(
    'div',
    { className: `porto-pay__field porto-pay__field--${id}` },
    el('label', { for: `porto-card-${id}`, text: label }),
    input,
    hint ? el('p', { className: 'porto-pay__hint', id: `porto-card-${id}-hint`, text: hint }) : null,
  );
  const number = el('input', {
    id: 'porto-card-number', name: 'cc-number', inputmode: 'numeric', autocomplete: 'cc-number', required: true, placeholder: '0000 0000 0000 0000', 'aria-describedby': 'porto-card-number-hint',
  });
  const name = el('input', {
    id: 'porto-card-name', name: 'cc-name', autocomplete: 'cc-name', required: true, placeholder: 'Como está no cartão',
  });
  const expiry = el('input', {
    id: 'porto-card-expiry', name: 'cc-exp', inputmode: 'numeric', autocomplete: 'cc-exp', required: true, placeholder: 'MM/AA',
  });
  const cvv = el('input', {
    id: 'porto-card-cvv', name: 'cc-csc', inputmode: 'numeric', autocomplete: 'cc-csc', required: true, placeholder: '123', maxlength: '4',
  });
  const installments = el('select', { id: 'porto-card-installments', name: 'installments' });
  const fillInstallments = () => {
    const current = installments.value;
    installments.replaceChildren(...installmentOptions().map((o) => el('option', { value: o.value, text: o.label })));
    if ([...installments.options].some((o) => o.value === current)) installments.value = current;
  };
  fillInstallments();
  events.on('cart/data', fillInstallments);

  const brand = el('span', { className: 'porto-pay__brand', 'aria-live': 'polite' });
  const form = el(
    'form',
    { name: PO_FORM_NAME, className: 'porto-pay porto-pay--card', novalidate: true },
    el(
      'p',
      { className: 'porto-pay__demo' },
      'Ambiente de demonstração: nenhum valor é cobrado e os dados do cartão não saem do seu navegador. Use um cartão de teste, por exemplo ',
      el('strong', { text: '4111 1111 1111 1111' }),
      '.',
    ),
    el('div', { className: 'porto-pay__number' }, field('number', 'Número do cartão', number, 'Visa, Mastercard, Elo, Amex ou Hipercard'), brand),
    field('name', 'Nome impresso no cartão', name),
    el('div', { className: 'porto-pay__row' }, field('expiry', 'Validade', expiry), field('cvv', 'CVV', cvv)),
    field('installments', 'Parcelas', installments, 'Pagando com Cartão Porto Bank, você ganha 20% de desconto nos serviços.'),
  );

  let synced = '';
  const validate = () => {
    const n = digits(number.value);
    let msg = '';
    if (n && !luhn(n)) msg = 'Número de cartão inválido.';
    else if (n && !TEST_CARDS.has(n)) msg = 'Demonstração: use um cartão de teste, ex.: 4111 1111 1111 1111.';
    number.setCustomValidity(msg);
    number.closest('.porto-pay__field').querySelector('.porto-pay__hint').textContent = msg || 'Visa, Mastercard, Elo, Amex ou Hipercard';
    number.closest('.porto-pay__field').classList.toggle('is-invalid', !!msg);
    brand.textContent = cardBrand(n);
    expiry.setCustomValidity(expiry.value && !expiryValid(expiry.value) ? 'Validade inválida.' : '');
    const cvvLen = cardBrand(n) === 'Amex' ? 4 : 3;
    cvv.setCustomValidity(cvv.value && digits(cvv.value).length !== cvvLen ? `CVV com ${cvvLen} dígitos.` : '');
    name.setCustomValidity(name.value && name.value.trim().split(/\s+/).length < 2 ? 'Informe o nome como está no cartão.' : '');
    return form.checkValidity();
  };

  const sync = async () => {
    if (!validate()) return false;
    // only a masked summary goes to Commerce (purchase order number field)
    const summary = `${cardBrand(number.value).toUpperCase()} final ${digits(number.value).slice(-4)} · ${installments.value}x`;
    if (summary === synced) return true;
    synced = summary;
    try {
      await checkoutApi.setPaymentMethod({ code: CARD_CODE, purchase_order_number: summary });
      return true;
    } catch (e) {
      synced = '';
      console.error('porto card: setPaymentMethod failed', e);
      return false;
    }
  };
  syncCardNow = async () => {
    const ok = await sync();
    if (!ok) form.querySelector(':invalid')?.focus();
    return ok;
  };

  number.addEventListener('input', () => { number.value = formatCard(number.value); validate(); });
  expiry.addEventListener('input', () => { expiry.value = formatExpiry(expiry.value); validate(); });
  cvv.addEventListener('input', () => { cvv.value = digits(cvv.value).slice(0, 4); validate(); });
  name.addEventListener('input', () => { name.value = name.value.toUpperCase(); validate(); });
  [number, expiry, cvv, name, installments].forEach((i) => i.addEventListener('change', sync));
  form.addEventListener('focusout', sync);
  form.addEventListener('submit', (e) => e.preventDefault());

  ctx.replaceHTML(form);
}

/* ---------------- Pix (banktransfer) ---------------- */

function renderPix(ctx) {
  css();
  const { value, currency } = cartTotal();
  ctx.replaceHTML(el(
    'div',
    { className: 'porto-pay porto-pay--pix' },
    el('p', { className: 'porto-pay__pix-title', text: `Pague ${value ? money(value, currency) : ''} com Pix` }),
    el('ul', {}, el('li', { text: 'Ao finalizar, mostramos o QR Code e o código “copia e cola”.' }), el('li', { text: 'A confirmação é imediata e o agendamento fica garantido.' })),
    el('p', { className: 'porto-pay__demo', text: 'Ambiente de demonstração: o Pix é simulado e nenhum valor é cobrado.' }),
  ));
}

/** Slot handlers to merge into PaymentMethods `slots.Methods`. */
export function portoPaymentMethods() {
  return {
    [CARD_CODE]: { render: renderCard, autoSync: false },
    [PIX_CODE]: { render: renderPix },
  };
}

/* ---------------- after the order ---------------- */

function api() {
  return getConfigValue('porto-booking')?.api;
}

async function showPix(box, order) {
  const base = api();
  const amount = Number(order?.grandTotal?.value) || cartTotal().value;
  const status = el('p', {
    className: 'porto-pay__status', role: 'status', 'aria-live': 'polite', text: 'Gerando seu Pix…',
  });
  box.replaceChildren(el('p', { className: 'porto-pay__result-title', text: 'Pagamento via Pix' }), status);
  let charge;
  try {
    const res = await fetch(`${base}/pix-charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber: order.number, amount }),
    });
    charge = await res.json();
    if (!res.ok) throw new Error(charge.error?.message);
  } catch (e) {
    status.textContent = 'Não foi possível gerar o Pix agora. Você receberá as instruções por e-mail.';
    return;
  }
  const qr = el('div', { className: 'porto-pay__qr', role: 'img', 'aria-label': 'QR Code Pix' });
  qr.innerHTML = charge.qrSvg; // SVG generated by our own App Builder action
  const code = el('input', {
    className: 'porto-pay__code', value: charge.brcode, readonly: true, 'aria-label': 'Código Pix copia e cola',
  });
  const copy = el('button', { type: 'button', className: 'button porto-pay__copy', text: 'Copiar código' });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(charge.brcode);
    } catch (e) {
      code.select();
    }
    copy.textContent = 'Código copiado!';
    setTimeout(() => { copy.textContent = 'Copiar código'; }, 2500);
  });
  status.textContent = 'Aguardando pagamento… Abra o app do seu banco e escaneie o QR Code ou cole o código.';
  box.replaceChildren(
    el('p', { className: 'porto-pay__result-title', text: `Pague ${money(charge.amount, order?.grandTotal?.currency || cartTotal().currency)} com Pix` }),
    el('div', { className: 'porto-pay__pix-grid' }, qr, el('div', {}, el('label', { text: 'Pix copia e cola' }), code, copy, status)),
    el('p', { className: 'porto-pay__demo', text: 'Demonstração: o pagamento é confirmado automaticamente em alguns segundos. Nenhum valor é cobrado.' }),
  );
  const poll = setInterval(async () => {
    const s = await fetch(`${base}/pix-status?txid=${charge.txid}`).then((r) => r.json()).catch(() => null);
    if (s?.status === 'paid') {
      clearInterval(poll);
      box.classList.add('is-paid');
      status.textContent = '✓ Pagamento confirmado! Seu agendamento está garantido.';
      qr.classList.add('is-paid');
    }
  }, 2500);
}

function showCard(box, order) {
  const payment = order?.payments?.[0];
  box.classList.add('is-paid');
  box.replaceChildren(
    el('p', { className: 'porto-pay__result-title', text: 'Pagamento aprovado (simulado)' }),
    el('p', { text: `${payment?.name || 'Cartão de crédito'} aprovado. Ambiente de demonstração: nenhum valor foi cobrado.` }),
  );
}

/** Shows the Pix charge (or the card result) above the order confirmation. */
export function renderPaymentResult(block) {
  events.on('order/placed', (order) => {
    const code = order?.payments?.[0]?.code;
    if (code !== PIX_CODE && code !== CARD_CODE) return;
    css();
    const box = el('section', { className: 'porto-pay-result', 'aria-label': 'Pagamento' });
    block.before(box);
    if (code === PIX_CODE) showPix(box, order);
    else showCard(box, order);
  });
}
