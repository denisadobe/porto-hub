/*
 * booking-flow: sell a few services right on a landing page (e.g. a partner campaign).
 * Authoring: one row per service. Cell 1: Commerce SKU. Cell 2 (optional): label shown instead
 * of the catalog name. The customer picks a service (name, image and price come from Commerce)
 * and goes through the same flow as the product page, on this page:
 * CEP -> day and shift -> address -> prefilled checkout (scripts/service-booking.js).
 */
import { CS_FETCH_GRAPHQL } from '../../scripts/commerce.js';
import renderServiceBooking from '../../scripts/service-booking.js';
import {
  IS_UE, claimDecoration, isEmptyRow, moveInstrumentation,
} from '../../scripts/ue-utils.js';

const QUERY = `query BookingFlow($skus: [String]) {
  products(skus: $skus) {
    sku
    name
    images(roles: ["image", "small_image", "thumbnail"]) { url label }
    ... on SimpleProductView { price { final { amount { value currency } } } }
    ... on ComplexProductView { priceRange { minimum { final { amount { value currency } } } } }
  }
}`;

async function fetchProducts(skus) {
  if (!skus.length) return new Map();
  try {
    const { data } = await CS_FETCH_GRAPHQL.fetchGraphQl(QUERY, { method: 'GET', variables: { skus } });
    return new Map((data?.products || []).map((p) => [p.sku, p]));
  } catch (e) {
    console.warn('booking-flow: could not load products', e);
    return new Map();
  }
}

function priceOf(p) {
  const amount = p?.price?.final?.amount || p?.priceRange?.minimum?.final?.amount;
  if (!amount?.value) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: amount.currency || 'BRL' }).format(amount.value);
}

function imageOf(p, width = 640) {
  const url = p?.images?.[0]?.url;
  if (!url) return '';
  const u = new URL(url.startsWith('//') ? `https:${url}` : url, window.location.href);
  u.searchParams.set('width', width);
  return u.href;
}

export default async function decorate(block) {
  if (!claimDecoration(block)) return;

  const rows = [...block.children].filter((row) => !isEmptyRow(row));
  const items = rows.map((row) => {
    const [skuCell, labelCell] = row.children;
    return {
      row,
      sku: skuCell?.textContent.trim() || '',
      label: labelCell?.textContent.trim() || '',
    };
  }).filter((item) => item.sku || IS_UE);

  const list = document.createElement('div');
  list.className = 'booking-flow-services';
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-label', 'Escolha o serviço');

  const single = items.length === 1;
  const heading = document.createElement('p');
  heading.className = 'booking-flow-title';
  heading.textContent = single ? 'Seu serviço' : 'Escolha o serviço';

  const flow = document.createElement('div');
  flow.className = 'booking-flow-flow';

  const products = await fetchProducts(items.map((i) => i.sku).filter(Boolean));
  let selected = null;

  const select = (item) => {
    const product = products.get(item.sku);
    if (!product) return;
    selected = { ...product, name: item.label || product.name };
    list.querySelectorAll('input').forEach((input) => { input.checked = input.value === item.sku; });
    renderServiceBooking(flow, { getProduct: () => selected });
  };

  items.forEach((item) => {
    const product = products.get(item.sku);
    const card = document.createElement('label');
    card.className = `booking-flow-service${product ? '' : ' is-missing'}`;
    // keep the editor's instrumentation on the visible card
    moveInstrumentation(item.row, card);

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'booking-flow-service';
    input.value = item.sku;
    input.disabled = !product;
    input.addEventListener('change', () => select(item));

    const img = imageOf(product);
    const media = document.createElement('span');
    media.className = 'booking-flow-service-media';
    if (img) {
      const image = document.createElement('img');
      image.src = img;
      image.alt = '';
      image.loading = 'lazy';
      image.width = 640;
      image.height = 480;
      media.append(image);
    }

    const body = document.createElement('span');
    body.className = 'booking-flow-service-body';
    const name = document.createElement('span');
    name.className = 'booking-flow-service-name';
    name.textContent = item.label || product?.name || item.sku || 'Novo serviço (informe o SKU)';
    const price = document.createElement('span');
    price.className = 'booking-flow-service-price';
    const amount = product ? priceOf(product) : '';
    if (amount) {
      const from = document.createElement('span');
      from.className = 'booking-flow-service-from';
      from.textContent = 'A partir de';
      const value = document.createElement('strong');
      value.className = 'booking-flow-service-value';
      value.textContent = amount;
      price.append(from, value);
    } else if (!product && item.sku) {
      price.textContent = `SKU ${item.sku} não encontrado no Commerce`;
    }
    body.append(name, price);

    card.append(input, media, body);

    // with a choice to make: "Escolher" / "Selecionado" footer and a check badge
    // (visual only: the radio input carries the state for assistive technology)
    if (!single) {
      const state = document.createElement('span');
      state.className = 'booking-flow-service-state';
      state.setAttribute('aria-hidden', 'true');
      state.innerHTML = '<span class="booking-flow-service-choose">Escolher</span><span class="booking-flow-service-chosen">Selecionado</span>';
      const check = document.createElement('span');
      check.className = 'booking-flow-service-check';
      check.setAttribute('aria-hidden', 'true');
      card.append(state, check);
    }
    list.append(card);
  });

  block.replaceChildren(heading, list, flow);
  if (IS_UE) block.classList.add('booking-flow-editor');
  // layout depends on how many services are authored: 1, 2, 3 or more
  const count = items.length;
  block.classList.add(`booking-flow--count-${count > 3 ? 'many' : count}`);
  if (single) block.classList.add('booking-flow--single');

  const first = items.find((i) => products.has(i.sku));
  if (first) select(first);
}
