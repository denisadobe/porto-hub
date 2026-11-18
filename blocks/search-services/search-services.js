/**
 * search-services
 * Row 1 (optional): link/URL to a query index (used only when the page has no
 *   cards-product block to filter).
 * Row 2 (optional): placeholder text for the input.
 * On pages with a cards-product block, typing filters those cards in place by
 * dispatching a `services:search` event on document.
 */

import { IS_UE, claimDecoration, moveInstrumentation } from '../../scripts/ue-utils.js';

const DEFAULT_PLACEHOLDER = 'Encontre o serviço que precisa';

function normalize(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function readConfig(block) {
  let indexUrl;
  let placeholder;
  let placeholderCell;
  [...block.querySelectorAll(':scope > div > div')].forEach((cell) => {
    const link = cell.querySelector('a[href]');
    const text = cell.textContent.trim();
    if (!indexUrl && link && /\.json(\?|$)/.test(link.href)) {
      indexUrl = link.href;
    } else if (!indexUrl && /^(https?:\/\/|\/)\S+\.json(\?\S*)?$/.test(text)) {
      indexUrl = text;
    } else if (!placeholder && text) {
      placeholder = text;
      placeholderCell = cell;
    }
  });
  // editor: the (first) cell is the "placeholder" field, even while it is still empty
  if (!placeholderCell) placeholderCell = block.querySelector(':scope > div > div[data-aue-prop]');
  return { indexUrl, placeholder: placeholder || DEFAULT_PLACEHOLDER, placeholderCell };
}

let indexCache;
async function fetchIndex(url) {
  if (!indexCache) {
    indexCache = fetch(url)
      .then((resp) => (resp.ok ? resp.json() : { data: [] }))
      .then((json) => json.data || [])
      .catch(() => []);
  }
  return indexCache;
}

function renderIndexResults(results, list, query) {
  list.replaceChildren();
  if (!query) {
    list.hidden = true;
    return;
  }
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const matches = results.filter((item) => {
    const haystack = normalize(`${item.title || ''} ${item.description || ''}`);
    return terms.every((t) => haystack.includes(t));
  }).slice(0, 10);
  matches.forEach((item) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.path;
    a.textContent = item.title || item.path;
    li.append(a);
    list.append(li);
  });
  if (!matches.length) {
    const li = document.createElement('li');
    li.className = 'search-services-no-results';
    li.textContent = 'Nenhum serviço encontrado';
    list.append(li);
  }
  list.hidden = false;
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  const { indexUrl, placeholder, placeholderCell } = readConfig(block);

  const form = document.createElement('form');
  form.className = 'search-services-box';
  form.setAttribute('role', 'search');

  const label = document.createElement('label');
  label.className = 'search-services-label';
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'search-services-input';
  // a blank placeholder lets CSS float the visible label via :placeholder-shown
  input.placeholder = ' ';
  input.setAttribute('aria-label', placeholder);
  input.autocomplete = 'off';
  const labelText = document.createElement('span');
  labelText.className = 'search-services-placeholder';
  labelText.textContent = placeholder;
  // the visible placeholder is the editor's "placeholder" text field
  moveInstrumentation(placeholderCell, labelText);
  if (IS_UE) block.classList.add('search-services-editor');
  label.append(input, labelText);

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'search-services-submit';
  submit.setAttribute('aria-label', 'Buscar');
  const icon = document.createElement('span');
  icon.className = 'search-services-icon';
  icon.setAttribute('aria-hidden', 'true');
  submit.append(icon);

  form.append(label, submit);

  const results = document.createElement('ul');
  results.className = 'search-services-results';
  results.hidden = true;

  block.replaceChildren(form, results);

  const hasCards = () => !!document.querySelector('.cards-product');

  const apply = async () => {
    const query = input.value;
    block.dataset.query = query;
    if (hasCards()) {
      document.dispatchEvent(new CustomEvent('services:search', { detail: { query } }));
      return;
    }
    if (indexUrl) {
      const data = await fetchIndex(indexUrl);
      renderIndexResults(data, results, query);
    }
  };

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(apply, 150);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(debounce);
    apply();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      apply();
    }
  });
}
