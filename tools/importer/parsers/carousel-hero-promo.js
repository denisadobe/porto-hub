/* eslint-disable */
/* global WebImporter */
/**
 * Parser: carousel-hero-promo
 * Source: .s-banner-hero (https://www.portoseguro.com.br/servicos)
 * One row per slide: [background image] [title heading, subtitle, CTA / coupon, disclaimer]
 */
export default function parse(element, { document }) {
  const cells = [];
  const slides = element.querySelectorAll('.s-banner-hero__slider__item');

  slides.forEach((slide) => {
    // Cell 1: desktop banner image, then the mobile image (block model: image, imageMobile).
    // The source picture holds the wide banner in <source media="(width >= 1025px)">
    // (srcset, or data-srcset before hydration) and the tall mobile crop in <img>.
    const imageCell = [];
    const img = slide.querySelector('picture.s-banner-hero__banner__background img, .s-banner-hero__banner img');
    const firstUrl = (value) => (value || '').split(',')[0].trim().split(/\s+/)[0];
    const desktopSource = [...slide.querySelectorAll('picture source')]
      .map((s) => ({ media: s.getAttribute('media') || '', url: firstUrl(s.getAttribute('srcset') || s.getAttribute('data-srcset')) }))
      .find((s) => /1025|min-width|>=/.test(s.media) && s.url && !s.url.startsWith('data:'));
    const mobileSrc = img ? img.getAttribute('src') : '';
    const alt = img ? img.getAttribute('alt') || '' : '';
    [desktopSource?.url, mobileSrc].forEach((src) => {
      if (!src || src.startsWith('data:')) return;
      const image = document.createElement('img');
      image.src = src;
      image.alt = alt;
      imageCell.push(image);
    });

    // Cell 2: text content
    const contentCell = [];
    const headings = [...slide.querySelectorAll('.s-banner-hero__banner__content__header h1, .s-banner-hero__banner__content__header h2, .s-banner-hero__banner__content__header h3')];
    headings.forEach((h, idx) => {
      if (idx === 0) {
        // keep only the first heading as the slide title
        const title = document.createElement('h2');
        title.innerHTML = h.innerHTML.trim();
        contentCell.push(title);
      } else {
        const p = document.createElement('p');
        p.textContent = h.textContent.replace(/\s+/g, ' ').trim();
        if (p.textContent) contentCell.push(p);
      }
    });

    const footer = slide.querySelector('.s-banner-hero__banner__content__footer');
    if (footer) {
      const cta = footer.querySelector('a[href]');
      if (cta && cta.textContent.trim()) {
        const p = document.createElement('p');
        const a = document.createElement('a');
        a.href = cta.getAttribute('href');
        a.textContent = cta.textContent.trim();
        p.append(a);
        contentCell.push(p);
      }

      // Coupon: "Cupom: PORTOPLUS" -> text + inline code
      const coupon = footer.querySelector('.s-banner-hero__copy-button > span');
      if (coupon) {
        const text = coupon.textContent.replace(/\s+/g, ' ').trim();
        const match = text.match(/^(.*?:)\s*(\S+)$/);
        const p = document.createElement('p');
        const code = document.createElement('code');
        if (match) {
          p.append(document.createTextNode(`${match[1]} `));
          code.textContent = match[2];
        } else {
          code.textContent = text;
        }
        p.append(code);
        contentCell.push(p);
      }

      footer.querySelectorAll('p').forEach((legend) => {
        const text = legend.textContent.replace(/\s+/g, ' ').trim();
        if (!text) return;
        const p = document.createElement('p');
        p.textContent = text;
        contentCell.push(p);
      });
    }

    if (imageCell.length || contentCell.length) {
      cells.push([imageCell, contentCell]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-hero-promo', cells });
  element.replaceWith(block);
}
