/**
 * cards-category
 * One row per chip: cell 1 icon image, cell 2 label (optionally linked to
 * #<category-slug>). The first chip is the default "all" filter (Destaques).
 * Selecting a chip dispatches `services:category` on document; cards-product
 * listens and filters its cards. The URL hash (#ar-condicionado) selects a chip.
 * UE model cards-category-item: icon (image, cell 1) and label (plain text, cell 2); the
 * category is the label slug (or the #hash of a link in the label cell).
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import {
  claimDecoration, isEmptyRow, moveInstrumentation, replacePicture,
} from '../../scripts/ue-utils.js';

function slugify(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readHash() {
  try {
    return slugify(decodeURIComponent(window.location.hash.replace(/^#/, '')));
  } catch (e) {
    return '';
  }
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const ul = document.createElement('ul');
  ul.className = 'cards-category-list';
  // a labelled list of toggle buttons (aria-pressed); a toolbar role would
  // require arrow-key navigation and breaks the list semantics
  ul.setAttribute('aria-label', 'Categorias de serviços');

  [...block.children].forEach((row, idx) => {
    if (isEmptyRow(row)) return;
    const cells = [...row.children];
    let iconCell = cells.find((c) => c.querySelector('picture, img, .icon') && !c.textContent.trim());
    let labelCell = cells.find((c) => c !== iconCell && c.textContent.trim());
    // editor: an item just added is still empty, keep [icon | label] by position
    if (!iconCell && !labelCell && cells.length > 1) [iconCell, labelCell] = cells;
    else if (!labelCell && cells.length > 1) labelCell = cells.find((c) => c !== iconCell);

    const link = labelCell?.querySelector('a[href]');
    const label = (labelCell?.textContent || '').trim();
    let slug = '';
    if (link) {
      const { hash } = new URL(link.href, window.location.href);
      if (hash) slug = slugify(decodeURIComponent(hash.slice(1)));
    }
    if (!slug) slug = slugify(label);

    const li = document.createElement('li');
    moveInstrumentation(row, li);
    li.className = 'cards-category-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cards-category-chip';
    button.dataset.category = slug;
    if (idx === 0) button.dataset.all = 'true';
    button.setAttribute('aria-pressed', 'false');

    // the round icon tile is always rendered so chips keep their shape when
    // authors leave the icon cell empty
    const iconSource = iconCell || labelCell?.querySelector('picture, .icon');
    const icon = document.createElement('span');
    icon.className = 'cards-category-icon';
    icon.setAttribute('aria-hidden', 'true');
    if (iconCell) icon.append(...iconCell.childNodes);
    else if (iconSource) icon.append(iconSource);
    button.append(icon);
    const text = document.createElement('span');
    text.className = 'cards-category-label';
    text.textContent = label;
    // the label is the editor's "label" text field
    moveInstrumentation(labelCell, text);
    button.append(text);

    li.append(button);
    ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    replacePicture(img.closest('picture'), createOptimizedPicture(img.src, img.alt, false, [{ width: '96' }]));
  });

  block.replaceChildren(ul);

  const chips = [...ul.querySelectorAll('.cards-category-chip')];
  if (!chips.length) return;

  const select = (chip, { updateHash = false, scroll = false } = {}) => {
    chips.forEach((c) => c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'));
    chips.forEach((c) => c.closest('li').classList.toggle('active', c === chip));
    const all = chip.dataset.all === 'true';
    block.dataset.activeCategory = chip.dataset.category;
    block.dataset.activeAll = all ? 'true' : 'false';
    if (updateHash) {
      const url = new URL(window.location.href);
      url.hash = all ? '' : chip.dataset.category;
      window.history.replaceState(null, '', url);
    }
    if (scroll) block.scrollIntoView({ behavior: 'smooth', block: 'start' });
    chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    document.dispatchEvent(new CustomEvent('services:category', {
      detail: { category: chip.dataset.category, all },
    }));
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => select(chip, { updateHash: true }));
  });

  // arrow-key navigation inside the toolbar
  ul.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const idx = chips.indexOf(document.activeElement);
    if (idx < 0) return;
    e.preventDefault();
    let nextIdx = idx;
    if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + chips.length) % chips.length;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % chips.length;
    if (e.key === 'Home') nextIdx = 0;
    if (e.key === 'End') nextIdx = chips.length - 1;
    chips[nextIdx].focus();
  });

  const fromHash = () => chips.find((c) => c.dataset.category === readHash());
  select(fromHash() || chips[0]);

  window.addEventListener('hashchange', () => {
    const chip = fromHash();
    if (chip) select(chip, { scroll: true });
  });
}
