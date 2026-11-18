/**
 * accordion-faq
 * One row per item: cell 1 question, cell 2 answer (rich text).
 * Renders native <details> items and emits FAQPage structured data.
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
  const items = [];
  [...block.children].forEach((row) => {
    const [label, body] = row.children;
    if (!label || !label.textContent.trim()) {
      row.remove();
      return;
    }

    const summary = document.createElement('summary');
    summary.className = 'accordion-faq-item-label';
    // drop decorative icons authored next to the question
    label.querySelectorAll('picture, img, .icon').forEach((el) => el.remove());
    const labelText = document.createElement('span');
    labelText.className = 'accordion-faq-item-title';
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
    details.className = 'accordion-faq-item';
    details.append(summary, content);
    row.replaceWith(details);

    items.push({
      question: labelText.textContent.trim(),
      answer: content.innerHTML.trim(),
    });
  });

  addStructuredData(block, items);
}
