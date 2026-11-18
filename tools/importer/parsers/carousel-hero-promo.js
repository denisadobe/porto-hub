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
    // Cell 1: background image only
    const imageCell = [];
    const img = slide.querySelector('picture.s-banner-hero__banner__background img, .s-banner-hero__banner img');
    // prefer the desktop rendition from <source media="(min-width...)"> when present
    let src = img ? img.getAttribute('src') : '';
    const desktopSource = [...slide.querySelectorAll('picture source[srcset]')]
      .find((s) => /min-width/.test(s.getAttribute('media') || ''));
    if (desktopSource) {
      const first = desktopSource.getAttribute('srcset').split(',')[0].trim().split(/\s+/)[0];
      if (first && !first.startsWith('data:')) src = first;
    }
    if (img && src && !src.startsWith('data:')) {
      const image = document.createElement('img');
      image.src = src;
      image.alt = img.getAttribute('alt') || '';
      imageCell.push(image);
    }

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
