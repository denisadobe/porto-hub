import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  IS_UE, claimDecoration, isEmptyRow, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

/*
 * Carousel (hero promo)
 * One row per slide (UE model: carousel-hero-promo-slide):
 *   cell 1: desktop banner picture, then an optional mobile picture (fields image, imageMobile)
 *   cell 2: title heading, subtitle, CTA link or coupon ("Cupom: \`CODE\`"), fine print (text)
 * Both pictures stay in the page (each keeps its editor instrumentation); CSS shows the desktop
 * one from 900px and the mobile one below.
 */

let instanceCount = 0;

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  chevron: 'M12.1 20.034c0 .2.067.434.233.6l14.1 14.134c.334.333.867.333 1.167 0a.806.806 0 0 0 0-1.167L14.1 20.068 27.667 6.434c.333-.333.333-.866 0-1.166-.334-.334-.867-.334-1.167 0L12.333 19.434s-.233.367-.233.6',
  copy: 'M32.2 7.533h-2.8V2.8c0-1.533-1.233-2.8-2.767-2.8H15.7c-.933 0-1.8.367-2.467 1.033L6.033 8.2A3.46 3.46 0 0 0 5 10.667v19c0 1.533 1.267 2.8 2.8 2.8h2.8V37.2c0 1.533 1.267 2.8 2.8 2.8h18.833c1.534 0 2.8-1.267 2.8-2.8V10.333c0-1.533-1.266-2.8-2.8-2.8M14.367 2.2v5.967c0 .633-.534 1.166-1.167 1.166H7.233zm-7.7 27.467V11.033H13.2A2.83 2.83 0 0 0 16.033 8.2V1.667h10.6c.634 0 1.134.5 1.134 1.133v26.867c0 .633-.5 1.133-1.134 1.133H7.8c-.633 0-1.133-.5-1.133-1.133M33.333 37.2c0 .633-.5 1.133-1.133 1.133H13.367c-.634 0-1.134-.5-1.134-1.133v-4.733H26.6c1.533 0 2.8-1.267 2.8-2.8V9.2h2.8c.633 0 1.133.5 1.133 1.133z',
};

function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function optimizeImages(container, eager) {
  container.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    const picture = img.closest('picture');
    const optimized = createOptimizedPicture(
      img.src,
      img.alt,
      eager,
      [{ media: '(min-width: 900px)', width: '2000' }, { width: '900' }],
    );
    optimized.className = picture.className;
    replacePicture(picture, optimized);
  });
}

/**
 * Turns an authored coupon paragraph ("Cupom: <code>CODE</code>") into a single
 * outlined copy button: the coupon text plus a "Copiar" action.
 */
function decorateCoupon(content) {
  content.querySelectorAll('code').forEach((code) => {
    const p = code.closest('p') || code.parentElement;
    if (p.querySelector('.carousel-hero-promo-copy')) return;
    p.classList.add('carousel-hero-promo-coupon');
    const value = code.textContent.trim();

    const label = document.createElement('span');
    label.className = 'carousel-hero-promo-copy-label';
    label.append(...p.childNodes);

    const actionText = document.createElement('span');
    actionText.textContent = 'Copiar';
    actionText.setAttribute('aria-live', 'polite');
    const action = document.createElement('span');
    action.className = 'carousel-hero-promo-copy-action';
    action.append(createIcon('copy'), actionText);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'carousel-hero-promo-copy';
    button.append(label, action);
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(value);
        actionText.textContent = 'Copiado!';
        setTimeout(() => { actionText.textContent = 'Copiar'; }, 2000);
      } catch (e) {
        // clipboard unavailable: leave the code selectable
      }
    });
    p.replaceChildren(button);
  });
}

/**
 * A paragraph holding only a link is the slide CTA: render it as Porto's
 * primary-filled button (global a.button styles).
 */
function decorateCta(content) {
  content.querySelectorAll(':scope > p').forEach((p) => {
    const a = p.querySelector('a[href]');
    if (!a || a.querySelector('img') || p.textContent.trim() !== a.textContent.trim()) return;
    p.classList.add('button-wrapper');
    a.classList.add('button');
  });
}

function decorateContent(content) {
  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) heading.classList.add('carousel-hero-promo-title');
  decorateCoupon(content);
  decorateCta(content);

  // paragraphs after the CTA / coupon are fine print
  const paragraphs = [...content.querySelectorAll(':scope > p')];
  const actionIdx = paragraphs.findLastIndex((p) => p.classList.contains('button-wrapper')
    || p.classList.contains('carousel-hero-promo-coupon')
    || (p.children.length === 1 && p.querySelector(':scope > a, :scope > strong > a, :scope > em > a')));
  let subtitleFound = false;
  paragraphs.forEach((p, idx) => {
    if (actionIdx >= 0 && idx > actionIdx) {
      p.classList.add('carousel-hero-promo-disclaimer');
    } else if (!subtitleFound && heading && !p.querySelector('a, code, picture')
      // eslint-disable-next-line no-bitwise
      && (heading.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      subtitleFound = true;
      p.classList.add('carousel-hero-promo-subtitle');
    }
  });
}

/**
 * Art direction: with two pictures, the first is the wide desktop banner and the second the
 * mobile crop. Both stay in the cell (editor fields image / imageMobile); CSS picks one.
 */
function markArtDirection(imageCell) {
  const pictures = [...imageCell.querySelectorAll('picture')];
  if (pictures.length < 2) return;
  pictures[0].classList.add('carousel-hero-promo-image-desktop');
  pictures[1].classList.add('carousel-hero-promo-image-mobile');
}

/**
 * Loading priority: the first slide's image is the LCP candidate; the other
 * slides are hidden until the carousel advances.
 */
function prioritizeImages(container, isFirst) {
  container.querySelectorAll('img').forEach((img) => {
    if (isFirst) {
      img.loading = 'eager';
      img.setAttribute('fetchpriority', 'high');
    } else {
      img.loading = 'lazy';
      img.setAttribute('fetchpriority', 'low');
    }
    img.decoding = 'async';
  });
}

function createSlide(row, idx, id) {
  // slides are groups (aria-roledescription="slide"), so they can't be list items
  const slide = document.createElement('div');
  moveInstrumentation(row, slide);
  slide.className = 'carousel-hero-promo-slide';
  slide.dataset.slideIndex = idx;
  slide.id = `carousel-hero-promo-${id}-slide-${idx}`;
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'slide');

  const cells = [...row.children];
  let imageCell = cells.find((c) => c.querySelector('picture') && !c.querySelector('h1, h2, h3, h4, h5, h6, p a'));
  // positional fallback (a slide just added in the editor, no picture yet): [image | content]
  if (!imageCell && cells.length > 1) [imageCell] = cells;
  const contentCells = cells.filter((c) => c !== imageCell);

  if (imageCell) {
    // the cell element itself is kept, so the instrumented pictures stay where the editor put them
    imageCell.className = 'carousel-hero-promo-slide-image';
    markArtDirection(imageCell);
    optimizeImages(imageCell, idx === 0);
    prioritizeImages(imageCell, idx === 0);
    slide.append(imageCell);
  }
  const content = document.createElement('div');
  content.className = 'carousel-hero-promo-slide-content';
  // the text cell is the editor's "text" field: its instrumentation moves to the content box
  if (contentCells.length === 1) moveInstrumentation(contentCells[0], content);
  contentCells.forEach((cell) => content.append(...cell.childNodes));
  decorateContent(content);
  slide.append(content);

  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading && heading.id) slide.setAttribute('aria-labelledby', heading.id);
  return slide;
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  instanceCount += 1;
  const id = instanceCount;
  const rows = [...block.children].filter((row) => !isEmptyRow(row, 'picture, img'));
  block.id = block.id || `carousel-hero-promo-${id}`;
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'carousel');

  const track = document.createElement('div');
  track.className = 'carousel-hero-promo-slides';
  const slides = rows.map((row, idx) => createSlide(row, idx, id));
  track.append(...slides);

  const viewport = document.createElement('div');
  viewport.className = 'carousel-hero-promo-slides-container';
  viewport.append(track);
  block.replaceChildren(viewport);

  if (IS_UE) block.classList.add('carousel-hero-promo-editor');
  if (slides.length < 2) {
    block.classList.add('carousel-hero-promo-single');
    return;
  }

  const total = slides.length;
  let current = -1;
  let ignoreObserverUntil = 0;

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'carousel-hero-promo-prev';
  prev.setAttribute('aria-label', 'Slide anterior');
  prev.append(createIcon('chevron'));
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'carousel-hero-promo-next';
  next.setAttribute('aria-label', 'Próximo slide');
  next.append(createIcon('chevron'));
  const nav = document.createElement('div');
  nav.className = 'carousel-hero-promo-navigation';
  nav.append(prev, next);

  const indicatorsNav = document.createElement('nav');
  indicatorsNav.setAttribute('aria-label', 'Controles do carrossel');
  const indicators = document.createElement('ol');
  indicators.className = 'carousel-hero-promo-indicators';
  slides.forEach((slide, idx) => {
    const li = document.createElement('li');
    li.className = 'carousel-hero-promo-indicator';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.slideIndex = idx;
    btn.setAttribute('aria-label', `Mostrar slide ${idx + 1} de ${total}`);
    btn.setAttribute('aria-controls', slide.id);
    li.append(btn);
    indicators.append(li);
  });
  indicatorsNav.append(indicators);
  block.append(nav, indicatorsNav);

  // the active dot holds a progress bar; its CSS animation drives autoplay
  const progress = document.createElement('span');
  progress.className = 'carousel-hero-promo-progress';

  function setActive(idx) {
    if (idx === current) return;
    current = idx;
    block.dataset.activeSlide = idx;
    slides.forEach((slide, i) => {
      const active = i === idx;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', !active);
      slide.querySelectorAll('a, button').forEach((el) => {
        if (active) el.removeAttribute('tabindex');
        else el.setAttribute('tabindex', '-1');
      });
    });
    [...indicators.children].forEach((li, i) => {
      const btn = li.querySelector('button');
      li.classList.toggle('active', i === idx);
      li.classList.toggle('passed', i < idx);
      if (i === idx) {
        btn.setAttribute('aria-current', 'true');
        btn.append(progress); // re-inserting restarts the animation
      } else btn.removeAttribute('aria-current');
    });
  }

  function show(idx) {
    const target = ((idx % total) + total) % total;
    ignoreObserverUntil = Date.now() + 1000;
    track.scrollTo({ top: 0, left: slides[target].offsetLeft, behavior: 'smooth' });
    setActive(target);
  }

  block.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !block.contains(btn)) return;
    if (btn === prev) show(current - 1);
    else if (btn === next) show(current + 1);
    else if (btn.closest('.carousel-hero-promo-indicator')) show(parseInt(btn.dataset.slideIndex, 10));
  });

  // no autoplay in the editor: the slide being edited must not move away
  if (!IS_UE) progress.addEventListener('animationend', () => show(current + 1));
  // editor: selecting a slide in the content tree brings it into view (ue/scripts/ue.js)
  block.addEventListener('carousel-hero-promo:show', (e) => {
    const index = Number(e.detail?.index);
    if (Number.isInteger(index) && index >= 0 && index < total) show(index);
  });

  const observer = new IntersectionObserver((entries) => {
    if (Date.now() < ignoreObserverUntil) return;
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActive(parseInt(entry.target.dataset.slideIndex, 10));
    });
  }, { root: track, threshold: 0.6 });
  slides.forEach((slide) => observer.observe(slide));

  setActive(0);
}
