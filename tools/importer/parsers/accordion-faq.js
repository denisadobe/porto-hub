/* eslint-disable */
/* global WebImporter */
/**
 * Parser: accordion-faq
 * Source: section.s-accordion
 * One row per item: [question] [answer rich text]. Plus/minus icon images are dropped.
 */
export default function parse(element, { document }) {
  const cells = [];
  const items = element.querySelectorAll('details.s-accordion__item');

  items.forEach((item) => {
    const summary = item.querySelector('summary');
    const questionEl = summary ? (summary.querySelector('span') || summary) : null;
    const question = questionEl ? questionEl.textContent.replace(/\s+/g, ' ').trim() : '';
    if (!question) return;

    const q = document.createElement('p');
    q.textContent = question;

    const answer = item.querySelector('.s-accordion__content');
    const answerCell = answer ? [...answer.children] : [];

    cells.push([[q], answerCell]);
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'accordion-faq', cells });
  element.replaceWith(block);
}
