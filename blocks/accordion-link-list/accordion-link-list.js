/**
 * accordion-link-list
 * One row: cell 1 title, cell 2 list of links. Rendered as a single <details>
 * that is open on desktop and collapsed on mobile (until the user toggles it).
 * Extra rows become additional items with the same behaviour.
 */

import { IS_UE, claimDecoration, moveInstrumentation } from '../../scripts/ue-utils.js';

/*
 * UE model accordion-link-list-item: title (plain text, cell 1) and links (rich text, cell 2).
 * The row's instrumentation moves to the <details>, the title's to its span; the links cell
 * element itself becomes the body.
 */

const DESKTOP = window.matchMedia('(min-width: 900px)');

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  if (IS_UE) block.classList.add('accordion-link-list-editor');
  const items = [];
  [...block.children].forEach((row) => {
    const [firstCell, body] = row.children;
    let label = firstCell;
    // editor: an item just added is still empty and must stay selectable
    if (!IS_UE && (!label || (!label.textContent.trim() && !body))) {
      row.remove();
      return;
    }
    if (!label) {
      label = document.createElement('div');
      row.append(label);
    }

    const summary = document.createElement('summary');
    summary.className = 'accordion-link-list-label';
    const title = document.createElement('span');
    title.className = 'accordion-link-list-title';
    moveInstrumentation(label, title);
    const only = label.children.length === 1 ? label.firstElementChild : null;
    if (only && /^(H[1-6]|P)$/.test(only.tagName)) title.append(...only.childNodes);
    else title.append(...label.childNodes);
    const icon = document.createElement('span');
    icon.className = 'accordion-link-list-icon';
    icon.setAttribute('aria-hidden', 'true');
    summary.append(title, icon);

    const content = body || document.createElement('div');
    content.className = 'accordion-link-list-body';
    content.querySelectorAll('ul, ol').forEach((list) => list.classList.add('accordion-link-list-links'));
    // links in a list should stay plain text links, not buttons
    content.querySelectorAll('a.button').forEach((a) => {
      a.classList.remove('button', 'primary', 'secondary');
      const container = a.closest('.button-container');
      if (container) container.classList.remove('button-container');
    });

    const details = document.createElement('details');
    moveInstrumentation(row, details);
    details.className = 'accordion-link-list-item';
    details.append(summary, content);
    row.replaceWith(details);

    summary.addEventListener('click', (e) => {
      // the list is always expanded on desktop (in the editor the title stays selectable)
      if (DESKTOP.matches && !IS_UE) {
        e.preventDefault();
        return;
      }
      details.dataset.userToggled = 'true';
    });
    items.push(details);
  });

  const sync = () => {
    items.forEach((details) => {
      if (details.dataset.userToggled) return;
      details.open = DESKTOP.matches || IS_UE;
    });
  };
  sync();
  DESKTOP.addEventListener('change', () => {
    items.forEach((details) => { delete details.dataset.userToggled; });
    sync();
  });
}
