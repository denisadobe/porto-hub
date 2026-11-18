import { isMultistore } from '@dropins/tools/lib/aem/configs.js';

/*
 * Porto footer. footer.plain.html sections (all copy, links and images live there):
 *   1. heading + list of icon links            (quick links)
 *   2. heading + one or more link lists        (link columns)
 *   3. heading + social icon list, heading + store badges paragraph
 *   4. paragraph (drawer trigger label), heading + link list (drawer content)
 *   5. list of legal links
 *   6. company paragraphs
 */

const isDesktop = window.matchMedia('(width >= 900px)');
const CHEVRON = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
let accordionId = 0;

/**
 * Mobile: column titles become accordion toggles (several can be open);
 * desktop: plain headings with the lists always visible.
 */
function setupAccordion(col) {
  const title = col.querySelector('.footer-col-title');
  const content = title?.nextElementSibling;
  if (!title || !content) return;
  accordionId += 1;
  content.id = content.id || `footer-col-content-${accordionId}`;
  const label = title.textContent.trim();

  const toMobile = () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'footer-col-toggle';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', content.id);
    button.innerHTML = `<span></span><span class="footer-col-toggle-icon">${CHEVRON}</span>`;
    button.firstElementChild.textContent = label;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', open);
      col.classList.toggle('is-open', open);
    });
    title.replaceChildren(button);
    col.classList.remove('is-open');
  };
  const toDesktop = () => {
    title.textContent = label;
    col.classList.remove('is-open');
  };
  const apply = () => (isDesktop.matches ? toDesktop() : toMobile());
  apply();
  isDesktop.addEventListener('change', apply);
}

const CLOSE_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M4 4l16 16M20 4L4 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

/** Fetches the footer fragment: /content first (local preview), then the site root (DA/EDS). */
async function fetchFooter() {
  let resp = await fetch('/content/footer.plain.html');
  if (!resp.ok) resp = await fetch('/footer.plain.html');
  if (!resp.ok) return null;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = await resp.text();
  const base = new URL(resp.url);
  wrapper.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), base).href;
    img.loading = 'lazy';
  });
  return wrapper;
}

function column(className, ...nodes) {
  const col = document.createElement('div');
  col.className = `footer-col ${className}`;
  col.append(...nodes.filter(Boolean));
  return col;
}

function withClass(el, className) {
  if (el) el.classList.add(className);
  return el;
}

/** Builds a side drawer (dialog) from a heading + list of links. */
function buildDrawer(heading, list) {
  const overlay = document.createElement('div');
  overlay.className = 'footer-drawer-overlay';
  overlay.hidden = true;

  const drawer = document.createElement('div');
  drawer.className = 'footer-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.hidden = true;
  drawer.id = 'footer-drawer';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'footer-drawer-close';
  close.setAttribute('aria-label', 'Fechar');
  close.innerHTML = CLOSE_ICON;

  if (heading) {
    heading.className = 'footer-drawer-title';
    heading.id = 'footer-drawer-title';
    drawer.setAttribute('aria-labelledby', heading.id);
  }
  if (list) list.className = 'footer-drawer-links';
  drawer.append(close, ...[heading, list].filter(Boolean));

  let opener;
  const setOpen = (open) => {
    if (open) {
      opener = document.activeElement;
      overlay.hidden = false;
      drawer.hidden = false;
      // next frame so the slide-in transition runs
      requestAnimationFrame(() => requestAnimationFrame(() => {
        drawer.classList.add('is-open');
        overlay.classList.add('is-open');
      }));
      document.body.style.overflowY = 'hidden';
      close.focus({ preventScroll: true });
    } else {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      document.body.style.overflowY = '';
      setTimeout(() => {
        drawer.hidden = true;
        overlay.hidden = true;
      }, 500);
      opener?.focus({ preventScroll: true });
    }
  };
  close.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key !== 'Tab') return;
    // keep focus inside the dialog
    const focusables = [...drawer.querySelectorAll('a[href], button')];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  return { overlay, drawer, open: () => setOpen(true) };
}

export default async function decorate(block) {
  const fragment = await fetchFooter();
  if (!fragment) return;
  const [quick, about, brand, partners, legal, company] = [...fragment.children];

  const main = document.createElement('div');
  main.className = 'footer-main';

  // 1. quick links (icon + label)
  if (quick) {
    main.append(column('footer-quick', withClass(quick.querySelector('h3'), 'footer-col-title'), withClass(quick.querySelector('ul'), 'footer-links')));
  }

  // 2. link columns (one or more lists side by side)
  if (about) {
    const lists = document.createElement('div');
    lists.className = 'footer-link-columns';
    about.querySelectorAll(':scope > ul').forEach((ul) => lists.append(withClass(ul, 'footer-links')));
    main.append(column('footer-about', withClass(about.querySelector('h3'), 'footer-col-title'), lists));
  }

  // 3. social + app stores + partners drawer
  const brandCol = column('footer-brand');
  if (brand) {
    const [socialTitle, storesTitle] = brand.querySelectorAll('h3');
    withClass(socialTitle, 'footer-brand-title');
    withClass(storesTitle, 'footer-brand-title');
    brandCol.append(socialTitle, withClass(brand.querySelector('ul'), 'footer-social-links'), storesTitle, withClass(brand.querySelector('p'), 'footer-stores'));
  }
  let drawer;
  if (partners) {
    const label = partners.querySelector('p')?.textContent.trim();
    drawer = buildDrawer(partners.querySelector('h2'), partners.querySelector('ul'));
    const holder = document.createElement('div');
    holder.className = 'footer-partners';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'footer-partners-button';
    button.textContent = label;
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', drawer.drawer.id);
    button.addEventListener('click', drawer.open);
    holder.append(button);
    brandCol.append(holder);
  }
  main.append(brandCol);

  // 4. bottom bar: rule, legal links, company details
  const bottom = document.createElement('div');
  bottom.className = 'footer-bottom';
  bottom.append(document.createElement('hr'));
  if (legal) bottom.append(withClass(legal.querySelector('ul'), 'footer-legal'));
  if (company) {
    const details = document.createElement('div');
    details.className = 'footer-company';
    details.append(...company.querySelectorAll('p'));
    bottom.append(details);
  }
  main.append(bottom);

  main.querySelectorAll('.footer-quick, .footer-about').forEach(setupAccordion);

  block.textContent = '';
  block.append(main);
  if (drawer) block.append(drawer.overlay, drawer.drawer);

  if (isMultistore()) {
    const { default: renderStoreSwitcher } = await import('./store-switcher.js');
    await renderStoreSwitcher(bottom);
  }
}
