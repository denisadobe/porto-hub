/**
 * accordion-faq
 * One row per item: cell 1 question, cell 2 answer (rich text).
 * Renders native <details> items and emits FAQPage structured data.
 */

import { IS_UE, claimDecoration, moveInstrumentation } from '../../scripts/ue-utils.js';

/*
 * UE model accordion-faq-item: question (plain text, cell 1) and answer (rich text, cell 2).
 * The row's instrumentation moves to the <details>, the question's to its title span; the answer
 * cell element itself becomes the body (it keeps its own).
 */

function addStructuredData(block, items) {
  if (!items.length || document.querySelector('script[data-accordion-faq]')) return;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.dataset.accordionFaq = '';
  script.textContent = JSON.stringify(data);
  document.head.append(script);
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  if (IS_UE) block.classList.add('accordion-faq-editor');
  const items = [];
  [...block.children].forEach((row) => {
    const [firstCell, body] = row.children;
    let label = firstCell;
    // editor: a question just added is still empty and must stay selectable
    if (!IS_UE && (!label || !label.textContent.trim())) {
      row.remove();
      return;
    }
    if (!label) {
      label = document.createElement('div');
      row.append(label);
    }

    const summary = document.createElement('summary');
    summary.className = 'accordion-faq-item-label';
    // drop decorative icons authored next to the question
    label.querySelectorAll('picture, img, .icon').forEach((el) => el.remove());
    const labelText = document.createElement('span');
    labelText.className = 'accordion-faq-item-title';
    moveInstrumentation(label, labelText);
    const headings = label.querySelectorAll('h1, h2, h3, h4, h5, h6, p');
    if (headings.length === 1 && label.children.length === 1) {
      labelText.append(...headings[0].childNodes);
    } else {
      labelText.append(...label.childNodes);
    }
    const icon = document.createElement('span');
    icon.className = 'accordion-faq-item-icon';
    icon.setAttribute('aria-hidden', 'true');
    summary.append(labelText, icon);

    const content = body || document.createElement('div');
    content.className = 'accordion-faq-item-body';

    const details = document.createElement('details');
    moveInstrumentation(row, details);
    details.className = 'accordion-faq-item';
    details.append(summary, content);
    row.replaceWith(details);

    if (!labelText.textContent.trim()) return;
    items.push({
      question: labelText.textContent.trim(),
      answer: content.innerHTML.trim(),
    });
  });

  // the editor page is never indexed: no structured data there
  if (!IS_UE) addStructuredData(block, items);
}
