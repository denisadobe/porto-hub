/**
 * cards-contact
 * One row per card. Usually a single cell: H3 title, description, CTA link.
 * An optional image cell is supported.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';

export default function decorate(block) {
  const ul = document.createElement('ul');
  ul.className = 'cards-contact-list';
  [...block.children].forEach((row) => {
    if (!row.textContent.trim() && !row.querySelector('picture')) return;
    const li = document.createElement('li');
    li.className = 'cards-contact-card';
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture') && !div.textContent.trim()) {
        div.className = 'cards-contact-card-image';
        return;
      }
      div.className = 'cards-contact-card-body';
      const heading = div.querySelector('h1, h2, h3, h4, h5, h6');
      if (heading) heading.classList.add('cards-contact-title');
      div.querySelectorAll(':scope > p').forEach((p) => {
        const link = p.querySelector('a[href]');
        if (link && p.textContent.trim() === link.textContent.trim()) {
          p.classList.add('cards-contact-cta');
          // Porto outlined (primary-stroke) CTA; decorateButtons only handles bold/italic links
          if (!link.classList.contains('button')) link.classList.add('button', 'secondary');
          if (/^https?:\/\//.test(link.href) && new URL(link.href).origin !== window.location.origin) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
          }
        }
      });
    });
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    img.closest('picture').replaceWith(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });

  block.replaceChildren(ul);
}
