/* eslint-disable */
/* global WebImporter */
/**
 * Parser: accordion-link-list
 * Source: section[class*='styles_wrapper'] details.desk-only
 * (the details.mobile-only duplicate is removed by the cleanup transformer)
 * One row: [title] [unordered list of links (73 on /servicos)]
 */
export default function parse(element, { document }) {
  const cells = [];

  const titleEl = element.querySelector('summary h1, summary h2, summary h3, summary h4, summary');
  const titleText = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
  const title = document.createElement('p');
  title.textContent = titleText;

  const ul = document.createElement('ul');
  element.querySelectorAll('ul li a[href]').forEach((link) => {
    const text = link.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = link.getAttribute('href');
    a.textContent = text;
    li.append(a);
    ul.append(li);
  });

  cells.push([[title], [ul]]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-link-list', cells });
  element.replaceWith(block);
}
