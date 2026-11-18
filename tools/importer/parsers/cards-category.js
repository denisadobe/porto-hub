/* eslint-disable */
/* global WebImporter */
/**
 * Parser: cards-category
 * Source: .section_products_by_category__categories
 * One row per chip: [icon image] [label linked to #<category-slug>]
 * Icon-font chips (<i class="icon ...">) have no authorable image; their icon cell is left empty.
 */
function slugify(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function parse(element, { document }) {
  const cells = [];
  const items = element.querySelectorAll('.section_products_by_category__categories-item');

  items.forEach((item) => {
    const labelEl = item.querySelector('.section_products_by_category__categories-item-text');
    const label = labelEl ? labelEl.textContent.replace(/\s+/g, ' ').trim() : '';
    if (!label) return;

    const iconCell = [];
    const img = item.querySelector('.chip img');
    if (img && img.getAttribute('src')) {
      const icon = document.createElement('img');
      icon.src = img.getAttribute('src');
      icon.alt = img.getAttribute('alt') || '';
      iconCell.push(icon);
    }

    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = `#${slugify(label)}`;
    a.textContent = label;
    p.append(a);

    cells.push([iconCell, [p]]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-category', cells });
  element.replaceWith(block);
}
