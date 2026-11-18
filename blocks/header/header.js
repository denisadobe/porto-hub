// Drop-in Tools
import { events } from '@dropins/tools/event-bus.js';

import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';
import { fetchPlaceholders } from '../../scripts/commerce.js';

import renderSellerAssistedBuyingBanner from './renderSellerAssistedBuyingBanner.js';

/*
 * Porto header.
 * nav.plain.html sections (all copy, links and images live there):
 *   1. brand logo
 *   2. utility links
 *   3. tools (call-to-action links); the Commerce cart button is added here
 *   4. megamenus: <li>Label<ul> brand-logo link, then one <li> per audience tab
 *      holding one <ul> per link column and an optional <blockquote> promo card
 *      (image, title, link). An <em> after a link is rendered as a badge.
 */

const isDesktop = window.matchMedia('(width >= 900px)');
const labels = await fetchPlaceholders();
let idCounter = 0;
const uid = (prefix) => { idCounter += 1; return `${prefix}-${idCounter}`; };

const CHEVRON = '<svg viewBox="0 0 12 6" width="12" height="6" aria-hidden="true" focusable="false"><path d="M1 .5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CART = '<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false"><path d="M2 4h3.6l3 13.2a1.6 1.6 0 0 0 1.6 1.3h11.6a1.6 1.6 0 0 0 1.6-1.2L26 8.5H7.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11" cy="23" r="1.8" fill="currentColor"/><circle cx="21" cy="23" r="1.8" fill="currentColor"/></svg>';

/** Fetches the nav fragment: /content first (local preview), then the site root (DA/EDS). */
async function fetchNav() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
  if (!resp.ok) return null;
  const html = await resp.text();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  // resolve relative image paths (images/...) against the fragment location
  const base = new URL(resp.url);
  wrapper.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), base).href;
  });
  return wrapper;
}

/** Text of an <li> without its nested lists. */
function ownLabel(li) {
  return [...li.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE || (n.nodeType === Node.ELEMENT_NODE && !['UL', 'OL', 'BLOCKQUOTE'].includes(n.tagName)))
    .map((n) => n.textContent)
    .join(' ')
    .trim();
}

function buildLinkList(ul) {
  const list = document.createElement('ul');
  list.className = 'nav-panel-links';
  [...ul.children].forEach((li) => {
    const item = document.createElement('li');
    const link = li.querySelector('a');
    if (link) item.append(link);
    li.querySelectorAll('em').forEach((em) => {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = em.textContent.trim();
      item.append(badge);
    });
    list.append(item);
  });
  return list;
}

function buildPromo(blockquote) {
  const link = blockquote.querySelector('a');
  const img = blockquote.querySelector('img');
  const texts = [...blockquote.querySelectorAll('p')].filter((p) => !p.querySelector('img'));
  const card = document.createElement('a');
  card.className = 'nav-promo';
  card.href = link?.href || '#';
  const title = document.createElement('span');
  title.className = 'nav-promo-title';
  title.textContent = texts.find((p) => !p.querySelector('a'))?.textContent.trim() || '';
  const cta = document.createElement('span');
  cta.className = 'nav-promo-subtitle';
  cta.textContent = link?.textContent.trim() || '';
  card.append(title, cta);
  if (img) {
    img.alt = '';
    img.loading = 'lazy';
    img.className = 'nav-promo-image';
    card.append(img);
  }
  return card;
}

/** Builds one megamenu: trigger button + panel with brand logo, audience tabs and tab panels. */
function buildMegamenu(li) {
  const label = ownLabel(li);
  const content = li.querySelector(':scope > ul');
  const item = document.createElement('li');
  item.className = 'nav-drop';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'nav-drop-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `<span class="nav-drop-label"></span><span class="nav-drop-icon">${CHEVRON}</span>`;
  trigger.querySelector('.nav-drop-label').textContent = label;
  item.append(trigger);
  if (!content) return item;

  const panel = document.createElement('div');
  panel.className = 'nav-panel';
  panel.id = uid('nav-panel');
  trigger.setAttribute('aria-controls', panel.id);

  const head = document.createElement('div');
  head.className = 'nav-panel-head';
  const tabList = document.createElement('div');
  tabList.className = 'nav-panel-tabs';
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', label);

  const tabs = [];
  [...content.children].forEach((entry) => {
    const logoImg = entry.querySelector(':scope > a > img');
    if (logoImg && !entry.querySelector('ul')) {
      const brand = entry.querySelector('a');
      brand.className = 'nav-panel-brand';
      head.prepend(brand);
      return;
    }
    const tabLabel = ownLabel(entry);
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'nav-panel-tab';
    tab.setAttribute('role', 'tab');
    tab.id = uid('nav-tab');
    tab.textContent = tabLabel;

    const tabPanel = document.createElement('div');
    tabPanel.className = 'nav-panel-body';
    tabPanel.setAttribute('role', 'tabpanel');
    tabPanel.id = uid('nav-tabpanel');
    tabPanel.setAttribute('aria-labelledby', tab.id);
    entry.querySelectorAll(':scope > ul').forEach((ul) => tabPanel.append(buildLinkList(ul)));
    const promo = entry.querySelector(':scope > blockquote');
    if (promo) tabPanel.append(buildPromo(promo));

    tabList.append(tab);
    tabs.push({ tab, tabPanel });
  });

  // only the active audience's links are rendered (as on the source)
  const select = (index) => {
    tabs.forEach(({ tab, tabPanel }, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', active);
      tab.tabIndex = active ? 0 : -1;
      if (active) {
        tab.setAttribute('aria-controls', tabPanel.id);
        if (!tabPanel.isConnected) panel.append(tabPanel);
      } else {
        tab.removeAttribute('aria-controls');
        tabPanel.remove();
      }
    });
  };
  tabs.forEach(({ tab }, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      select(next);
      tabs[next].tab.focus();
    });
  });
  // mobile: the panel is a sub-panel of the drawer with a back button
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nav-panel-back';
  back.innerHTML = `<span class="nav-panel-back-icon">${CHEVRON}</span><span>Voltar</span>`;
  head.prepend(back);

  head.append(tabList);
  panel.append(head);
  select(0);
  item.append(panel);
  return item;
}

/** Commerce mini-cart: cart button with item count + lazily loaded mini-cart panel. */
function buildMiniCart(tools) {
  const wrapper = document.createRange().createContextualFragment(`
    <div class="minicart-wrapper nav-tools-wrapper">
      <button type="button" class="nav-cart-button" aria-label="${labels.Global?.Cart ?? 'Carrinho'}" aria-haspopup="dialog" aria-expanded="false" aria-controls="minicart-panel">${CART}</button>
      <div class="minicart-panel nav-tools-panel" id="minicart-panel"></div>
      <div class="nav-cart-status" role="status" aria-live="polite"></div>
    </div>`);
  tools.prepend(wrapper);
  const panel = tools.querySelector('.minicart-panel');
  const button = tools.querySelector('.nav-cart-button');
  const status = tools.querySelector('.nav-cart-status');
  if (['/checkout'].includes(window.location.pathname)) button.hidden = true;

  let loading;
  const load = () => {
    if (!loading) {
      loading = (async () => {
        const meta = getMetadata('mini-cart');
        const path = meta ? new URL(meta, window.location).pathname : '/mini-cart';
        const fragment = await loadFragment(path);
        if (fragment?.firstElementChild) panel.append(fragment.firstElementChild);
      })();
    }
    return loading;
  };

  const toggle = async (state) => {
    const show = state ?? !panel.classList.contains('nav-tools-panel--show');
    if (show) {
      button.setAttribute('aria-busy', 'true');
      await load();
      button.removeAttribute('aria-busy');
      const { publishShoppingCartViewEvent } = await import('@dropins/storefront-cart/api.js');
      publishShoppingCartViewEvent();
    }
    panel.classList.toggle('nav-tools-panel--show', show);
    button.setAttribute('aria-expanded', show);
  };
  button.addEventListener('click', () => toggle());

  document.addEventListener('click', (e) => {
    if (!panel.classList.contains('nav-tools-panel--show')) return;
    const miniCart = panel.querySelector('[data-block-name="commerce-mini-cart"]');
    const undoEnabled = miniCart?.innerHTML.includes('undo-remove-item');
    const outside = !panel.contains(e.target) && !button.contains(e.target);
    if (outside && !(undoEnabled && e.target.closest('header'))) toggle(false);
  });

  let previous;
  events.on('cart/data', (data) => {
    const qty = data?.totalQuantity ?? 0;
    if (qty) button.dataset.count = qty;
    else delete button.dataset.count;
    button.setAttribute('aria-label', qty
      ? `${labels.Global?.Cart ?? 'Carrinho'} (${qty} ${qty === 1 ? 'item' : 'itens'})`
      : labels.Global?.Cart ?? 'Carrinho');
    if (previous !== undefined && previous !== qty) {
      status.textContent = qty ? `Carrinho atualizado: ${qty} ${qty === 1 ? 'item' : 'itens'}` : 'Carrinho atualizado: vazio';
    }
    previous = qty;
  }, { eager: true });

  return { close: () => toggle(false) };
}

export default async function decorate(block) {
  const sellerBanner = await renderSellerAssistedBuyingBanner();
  if (sellerBanner && !document.querySelector('.seller-assisted-buying-banner')) {
    document.body.insertAdjacentElement('afterbegin', sellerBanner);
  }

  const fragment = await fetchNav();
  if (!fragment) return;
  const [brandSection, utilitySection, toolsSection, menusSection] = [...fragment.children];

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Principal');
  nav.setAttribute('aria-expanded', 'false');

  // row 1: brand, utility links, tools
  const top = document.createElement('div');
  top.className = 'nav-top';

  const brand = document.createElement('div');
  brand.className = 'nav-brand';
  const brandLink = brandSection?.querySelector('a');
  if (brandLink) brand.append(brandLink);

  // the utility links are their own navigation landmark (as on the source)
  const utility = document.createElement('nav');
  utility.className = 'nav-utility';
  utility.setAttribute('aria-label', 'Institucional');
  const utilityList = utilitySection?.querySelector('ul');
  if (utilityList) utility.append(utilityList);

  const tools = document.createElement('div');
  tools.className = 'nav-tools';
  toolsSection?.querySelectorAll('a').forEach((a) => {
    a.className = 'nav-cta';
    tools.append(a);
  });
  const miniCart = buildMiniCart(tools);

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-controls', 'nav-menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Abrir menu');
  hamburger.innerHTML = '<span class="nav-hamburger-icon"></span>';

  top.append(hamburger, brand, utility, tools);

  // row 2: megamenus
  const sections = document.createElement('div');
  sections.className = 'nav-sections';
  sections.id = 'nav-menu';
  const menuList = document.createElement('ul');
  menuList.className = 'nav-drops';
  menusSection?.querySelectorAll(':scope > ul > li').forEach((li) => menuList.append(buildMegamenu(li)));
  // on mobile the utility links sit at the top of the menu drawer, as a row of pills
  const drawerUtility = utility.cloneNode(true);
  drawerUtility.className = 'nav-utility nav-utility-drawer';
  drawerUtility.setAttribute('aria-label', 'Institucional (menu)');
  sections.append(drawerUtility, menuList);

  nav.append(top, sections);

  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-wrapper';
  wrapper.append(nav, overlay);
  block.append(wrapper);

  /* ---- behavior ---- */
  const drops = [...menuList.querySelectorAll('.nav-drop')];
  let closeTimer;
  let openedByHover = null;

  const setOpen = (drop, open) => {
    const trigger = drop.querySelector('.nav-drop-trigger');
    trigger.setAttribute('aria-expanded', open);
    drop.classList.toggle('is-open', open);
    // mobile: an open category replaces the drawer list (slide-in sub-panel)
    if (!isDesktop.matches) {
      sections.classList.toggle('is-sub-open', drops.some((d) => d.classList.contains('is-open')));
    }
  };
  const closeAll = () => {
    drops.forEach((d) => setOpen(d, false));
    if (isDesktop.matches) wrapper.classList.remove('is-open');
  };
  const openDrop = (drop) => {
    clearTimeout(closeTimer);
    drops.forEach((d) => setOpen(d, d === drop));
    if (isDesktop.matches) wrapper.classList.add('is-open');
  };

  drops.forEach((drop) => {
    const trigger = drop.querySelector('.nav-drop-trigger');
    trigger.addEventListener('click', () => {
      const open = trigger.getAttribute('aria-expanded') === 'true';
      if (isDesktop.matches) {
        // as on the source, clicking a menu that hover just opened keeps it open
        if (open && openedByHover !== drop) closeAll(); else openDrop(drop);
        openedByHover = null;
      } else {
        drops.forEach((d) => { if (d !== drop) setOpen(d, false); });
        setOpen(drop, true); // mobile: slide in the category sub-panel
        drop.querySelector('.nav-panel-back')?.focus({ preventScroll: true });
      }
    });
    drop.querySelector('.nav-panel-back')?.addEventListener('click', () => {
      setOpen(drop, false);
      trigger.focus({ preventScroll: true });
    });
    drop.addEventListener('mouseenter', () => {
      if (!isDesktop.matches) return;
      if (!drop.classList.contains('is-open')) openedByHover = drop;
      openDrop(drop);
    });
    drop.addEventListener('mouseleave', () => {
      if (!isDesktop.matches) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(closeAll, 150);
    });
  });
  overlay.addEventListener('click', () => {
    closeAll();
    // eslint-disable-next-line no-use-before-define
    if (!isDesktop.matches) toggleMenu(false);
  });

  function toggleMenu(force) {
    const open = force ?? nav.getAttribute('aria-expanded') !== 'true';
    nav.setAttribute('aria-expanded', open);
    hamburger.setAttribute('aria-expanded', open);
    hamburger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    wrapper.classList.toggle('is-open', open);
    document.body.style.overflowY = open && !isDesktop.matches ? 'hidden' : '';
    if (!open) drops.forEach((d) => setOpen(d, false));
  }
  hamburger.addEventListener('click', () => toggleMenu());

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = drops.find((d) => d.classList.contains('is-open'));
    if (open && isDesktop.matches) {
      closeAll();
      open.querySelector('.nav-drop-trigger').focus();
    } else if (nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(false);
      hamburger.focus();
    }
    miniCart.close();
  });
  nav.addEventListener('focusout', (e) => {
    if (isDesktop.matches && !menuList.contains(e.relatedTarget)) closeAll();
  });

  // crossing the breakpoint resets both menus
  isDesktop.addEventListener('change', () => {
    closeAll();
    toggleMenu(false);
    sections.classList.remove('is-sub-open');
    wrapper.classList.remove('is-open');
  });
}
