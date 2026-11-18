/**
 * cards-product
 * One row per card: cell 1 image; cell 2 text:
 *   - paragraphs before the heading: optional badge(s) then the category
 *     eyebrow (the last paragraph before the heading is the category; several
 *     categories may be comma-separated)
 *   - heading: product title
 *   - paragraph with only bold text: price; paragraphs before it are the price label
 *   - paragraphs after the price: instalment text, the last one is the benefit
 *   - paragraph holding only a link: CTA
 * Optional cell 3: a Commerce product SKU. When present, the product's name,
 * price, image (when the catalog has one), stock and product page link come
 * live from the Commerce catalog; the authored badge, category and benefit stay.
 * If the SKU isn't found, the authored content is shown as-is.
 * The "N serviços disponíveis" count is generated. The block listens to
 * `services:category` (cards-category) and `services:search` (search-services).
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { CS_FETCH_GRAPHQL, getProductLink } from '../../scripts/commerce.js';
import {
  IS_UE, claimDecoration, emptyMediaSlot, isEmptyRow, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

const PRODUCTS_QUERY = `query CardsProduct($skus: [String]) {
  products(skus: $skus) {
    sku
    name
    urlKey
    inStock
    images(roles: ["image", "small_image", "thumbnail"]) { url label }
    ... on SimpleProductView {
      price { final { amount { value currency } } }
    }
    ... on ComplexProductView {
      priceRange { minimum { final { amount { value currency } } } }
    }
  }
}`;

async function fetchProducts(skus) {
  if (!skus.length) return new Map();
  try {
    const { data, errors } = await CS_FETCH_GRAPHQL.fetchGraphQl(PRODUCTS_QUERY, {
      method: 'GET',
      variables: { skus },
    });
    if (errors?.length) console.warn('cards-product: Commerce query errors', errors);
    return new Map((data?.products || []).filter(Boolean).map((p) => [p.sku, p]));
  } catch (e) {
    console.warn('cards-product: could not load Commerce products', e);
    return new Map();
  }
}

function formatPrice(product) {
  const amount = product.price?.final?.amount || product.priceRange?.minimum?.final?.amount;
  if (!amount || typeof amount.value !== 'number') return null;
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: amount.currency || 'BRL' })
      .format(amount.value);
  } catch {
    return amount.value.toFixed(2).replace('.', ',');
  }
}

function imageUrl(url, width) {
  if (!url) return null;
  const absolute = new URL(url.startsWith('//') ? `https:${url}` : url);
  // the Commerce image CDN resizes on request (?width=), e.g. 196 KB -> 26 KB at 400px
  if (width) {
    absolute.searchParams.set('width', width);
    absolute.searchParams.set('quality', '80');
  }
  return absolute.toString();
}

// card media is ~300px wide on desktop, half the viewport on tablet, full width on mobile
const CARD_IMAGE_SIZES = '(width >= 1024px) 304px, (width >= 425px) 50vw, 100vw';

function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(text) {
  return normalize(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function renderCount(el, n) {
  if (n === 0) {
    el.textContent = 'Nenhum serviço disponível';
    return;
  }
  const strong = document.createElement('strong');
  strong.textContent = n;
  el.replaceChildren(strong, n === 1 ? ' serviço disponível' : ' serviços disponíveis');
}

/** "20% de desconto com Cartão Porto Bank" -> bold highlight + description */
function decorateBenefit(el) {
  if (el.children.length) return;
  const match = el.textContent.trim().match(/^(.*?\bdesconto)\s+(.+)$/i);
  if (!match) return;
  const title = document.createElement('span');
  title.className = 'cards-product-benefit-title';
  const [, titleText, bodyText] = match;
  title.textContent = titleText;
  const text = document.createElement('span');
  text.className = 'cards-product-benefit-text';
  text.textContent = bodyText;
  el.replaceChildren(title, text);
}

const isCta = (el) => el.tagName === 'P' && el.querySelector('a[href]')
  && el.textContent.trim() === el.querySelector('a[href]').textContent.trim();

const isPrice = (el) => el.tagName === 'P' && el.children.length === 1
  && el.firstElementChild.tagName === 'STRONG'
  && el.textContent.trim() === el.firstElementChild.textContent.trim()
  && /\d/.test(el.textContent);

function decorateBody(body, li) {
  const children = [...body.children];
  const heading = body.querySelector('h1, h2, h3, h4, h5, h6');
  const headingIdx = heading ? children.indexOf(heading) : -1;
  let categories = [];

  if (heading) {
    heading.classList.add('cards-product-title');
    const before = children.slice(0, headingIdx).filter((el) => el.tagName === 'P');
    const categoryEl = before.pop();
    if (categoryEl) {
      categoryEl.classList.add('cards-product-category');
      categories = categoryEl.textContent.split(',').map(slugify).filter(Boolean);
    }
    before.forEach((el) => {
      el.classList.add('cards-product-badge');
      li.classList.add('has-badge');
    });
  }

  const after = children.slice(headingIdx + 1);
  const priceIdx = after.findIndex(isPrice);
  const ctas = after.filter(isCta);
  ctas.forEach((el) => {
    el.classList.add('cards-product-cta');
    el.querySelectorAll('a').forEach((a) => a.classList.add('button'));
  });
  const text = after.filter((el) => el.tagName === 'P' && !ctas.includes(el));

  if (priceIdx >= 0) {
    const price = after[priceIdx];
    price.classList.add('cards-product-price');
    const beforePrice = text.filter((el) => after.indexOf(el) < priceIdx);
    const afterPrice = text.filter((el) => after.indexOf(el) > priceIdx);
    beforePrice.forEach((el) => el.classList.add('cards-product-price-label'));
    const benefit = afterPrice.pop();
    if (benefit) {
      benefit.classList.add('cards-product-benefit');
      decorateBenefit(benefit);
    }
    afterPrice.forEach((el) => el.classList.add('cards-product-installments'));
  } else {
    const benefit = text.pop();
    if (benefit) {
      benefit.classList.add('cards-product-benefit');
      decorateBenefit(benefit);
    }
  }

  // a price block wrapper keeps label/price/installments together
  const priceEls = body.querySelectorAll('.cards-product-price-label, .cards-product-price, .cards-product-installments');
  if (priceEls.length) {
    const wrap = document.createElement('div');
    wrap.className = 'cards-product-pricing';
    priceEls[0].before(wrap);
    wrap.append(...priceEls);
  }

  return categories;
}

/**
 * Merges live Commerce data into an authored card. Authored badge, category,
 * price label and benefit are kept; name, price, image, stock and link come
 * from the catalog.
 */
function applyProduct(li, product) {
  const body = li.querySelector('.cards-product-card-body');
  if (!body) return;
  li.classList.add('is-commerce');

  const title = body.querySelector('.cards-product-title');
  if (title && product.name) title.textContent = product.name;

  const price = formatPrice(product);
  if (price) {
    let pricing = body.querySelector('.cards-product-pricing');
    if (!pricing) {
      pricing = document.createElement('div');
      pricing.className = 'cards-product-pricing';
      (title || body.firstElementChild)?.after(pricing);
    }
    let priceEl = pricing.querySelector('.cards-product-price');
    if (!priceEl) {
      priceEl = document.createElement('p');
      priceEl.className = 'cards-product-price';
      pricing.append(priceEl);
    }
    priceEl.replaceChildren(Object.assign(document.createElement('strong'), { textContent: price }));
    // authored instalments refer to the authored price, so they no longer apply
    pricing.querySelectorAll('.cards-product-installments').forEach((el) => el.remove());
  }

  const image = product.images?.find((img) => img?.url);
  if (image) {
    let media = li.querySelector('.cards-product-card-image');
    if (!media) {
      media = document.createElement('div');
      media.className = 'cards-product-card-image';
      li.prepend(media);
    }
    const img = document.createElement('img');
    img.src = imageUrl(image.url, 400);
    img.srcset = [400, 800].map((w) => `${imageUrl(image.url, w)} ${w}w`).join(', ');
    img.sizes = CARD_IMAGE_SIZES;
    img.alt = image.label || product.name || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    const picture = document.createElement('picture');
    picture.append(img);
    media.replaceChildren(picture);
  }

  if (product.urlKey) {
    const href = getProductLink(product.urlKey, product.sku);
    body.querySelectorAll('.cards-product-cta a').forEach((a) => { a.href = href; });
  }

  if (product.inStock === false) {
    li.classList.add('is-out-of-stock');
    const cta = body.querySelector('.cards-product-cta a');
    if (cta) {
      cta.removeAttribute('href');
      cta.setAttribute('aria-disabled', 'true');
      cta.textContent = 'Indisponível';
    }
  }
}

/**
 * Editor only: the SKU cell stays in the card as a small label (it is the "sku" field), so
 * authors see which Commerce product a card is bound to and can edit it in place.
 */
function keepSkuCell(div, sku) {
  div.className = 'cards-product-sku';
  div.dataset.label = sku ? 'Commerce · SKU' : 'Commerce · SKU (vazio)';
}

export default async function decorate(block) {
  if (!claimDecoration(block)) return;
  const ul = document.createElement('ul');
  ul.className = 'cards-product-list';

  [...block.children].forEach((row) => {
    if (isEmptyRow(row)) return;
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    li.className = 'cards-product-card';
    while (row.firstElementChild) li.append(row.firstElementChild);
    let categories = [];
    // editor: a card just added has no image yet, keep [image | text | sku] by position
    const mediaSlot = emptyMediaSlot([...li.children]);
    [...li.children].forEach((div, i) => {
      // cell 3 (optional): Commerce SKU, plain text only
      const sku = div.textContent.trim().replace(/^sku:\s*/i, '');
      if (i >= 2 && !div.querySelector('picture, a, h1, h2, h3, h4, h5, h6') && /^[\w.-]+$/.test(sku)) {
        li.dataset.sku = sku;
        if (IS_UE) keepSkuCell(div, sku);
        else div.remove();
        return;
      }
      if (i >= 2 && !div.textContent.trim() && !div.querySelector('picture')) {
        if (IS_UE) keepSkuCell(div, '');
        else div.remove();
        return;
      }
      if (div === mediaSlot) {
        div.className = 'cards-product-card-image';
        return;
      }
      if (div.children.length === 1 && div.querySelector('picture') && !div.textContent.trim()) {
        div.className = 'cards-product-card-image';
      } else {
        div.className = 'cards-product-card-body';
        categories = categories.concat(decorateBody(div, li));
      }
    });
    li.dataset.categories = categories.join(' ');
    li.dataset.search = normalize(li.textContent.replace(/\s+/g, ' '));
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) {
      // external images can't be resized here; at least keep them off the critical path
      img.loading = 'lazy';
      img.decoding = 'async';
      return;
    }
    replacePicture(img.closest('picture'), createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });

  const count = document.createElement('p');
  count.className = 'cards-product-count';
  count.setAttribute('aria-live', 'polite');

  const empty = document.createElement('p');
  empty.className = 'cards-product-empty';
  empty.textContent = 'Nenhum serviço encontrado para a sua busca.';
  empty.hidden = true;

  block.replaceChildren(count, ul, empty);

  const cards = [...ul.children];
  const state = { category: '', all: true, query: '' };

  const apply = () => {
    const terms = normalize(state.query).split(/\s+/).filter(Boolean);
    let visible = 0;
    cards.forEach((card) => {
      const cats = card.dataset.categories.split(' ').filter(Boolean);
      const inCategory = state.all || !state.category || cats.includes(state.category);
      // a search spans every category
      const matches = terms.length
        ? terms.every((t) => card.dataset.search.includes(t))
        : inCategory;
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    renderCount(count, visible);
    empty.hidden = visible > 0;
  };

  // initial state from blocks already decorated on the page
  // cards-category exposes its selection as data attributes on its block
  const filter = document.querySelector('[data-active-category]');
  if (filter) {
    state.category = filter.dataset.activeCategory;
    state.all = filter.dataset.activeAll === 'true';
  }
  const searchInput = document.querySelector('.search-services .search-services-input');
  if (searchInput) state.query = searchInput.value;

  document.addEventListener('services:category', (e) => {
    state.category = e.detail?.category || '';
    state.all = !!e.detail?.all;
    apply();
  });
  document.addEventListener('services:search', (e) => {
    state.query = e.detail?.query || '';
    apply();
  });

  apply();

  // Authored content renders first; live Commerce data is merged in when it arrives.
  // Not in the editor: there the authored fields are what is edited (and saved), so they must
  // not be replaced by catalog values; the SKU label shows which product a card is bound to.
  if (IS_UE) return;
  const skus = [...new Set(cards.map((card) => card.dataset.sku).filter(Boolean))];
  if (!skus.length) return;
  block.setAttribute('aria-busy', 'true');
  const products = await fetchProducts(skus);
  cards.forEach((card) => {
    const product = products.get(card.dataset.sku);
    if (!product) {
      if (card.dataset.sku) console.warn(`cards-product: SKU "${card.dataset.sku}" not found in Commerce; showing authored content`);
      return;
    }
    applyProduct(card, product);
    card.dataset.search = normalize(card.textContent.replace(/\s+/g, ' '));
  });
  block.removeAttribute('aria-busy');
  apply();
}
