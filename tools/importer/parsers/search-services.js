/* eslint-disable */
/* global WebImporter */
/**
 * Parser: search-services
 * Source: .section_products_by_category__search-bar
 * Single row: placeholder text. No query-index row is authored because the
 * servicos page has a cards-product block, which the search filters in place.
 */
export default function parse(element, { document }) {
  const cells = [];
  const label = element.querySelector('.input__label, label');
  const input = element.querySelector('input');
  const placeholder = (label && label.textContent.trim())
    || (input && (input.getAttribute('placeholder') || '').trim())
    || 'Encontre o serviço que precisa';

  const p = document.createElement('p');
  p.textContent = placeholder;
  cells.push([p]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'search-services', cells });
  element.replaceWith(block);
}
