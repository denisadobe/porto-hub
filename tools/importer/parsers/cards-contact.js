/* eslint-disable */
/* global WebImporter */
/**
 * Parser: cards-contact
 * Source: .s-customer-service-cards__content
 * One single-cell row per card: H3 title, description paragraph, CTA link alone in a paragraph.
 */
export default function parse(element, { document }) {
  const cells = [];
  const cards = element.querySelectorAll('article.s-customer-service-cards__card');

  cards.forEach((card) => {
    const content = [];
    const heading = card.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      const h3 = document.createElement('h3');
      h3.textContent = heading.textContent.replace(/\s+/g, ' ').trim();
      content.push(h3);
    }
    card.querySelectorAll('p').forEach((p) => {
      if (p.textContent.trim()) content.push(p);
    });
    const cta = card.querySelector('a[href]');
    if (cta && cta.textContent.trim()) {
      const a = document.createElement('a');
      a.href = cta.getAttribute('href').trim();
      a.textContent = cta.textContent.trim();
      const p = document.createElement('p');
      p.append(a);
      content.push(p);
    }
    if (content.length) cells.push([content]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-contact', cells });
  element.replaceWith(block);
}
