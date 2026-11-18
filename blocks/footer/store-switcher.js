// Commerce multistore switcher (from the boilerplate footer).
// Rendered only when the store is multistore.
import { getRootPath } from '@dropins/tools/lib/aem/configs.js';
import { Button, provider as UI } from '@dropins/tools/components.js';
import createModal from '../modal/modal.js';
import { loadFragment } from '../fragment/fragment.js';

function toggleStoreDropdown(sections, expanded = false) {
  sections
    .querySelectorAll('.storeview-modal .default-content-wrapper > ul > li')
    .forEach((section) => section.setAttribute('aria-expanded', expanded));
}

/**
 * Renders the store switcher button (and its modal) into the given container.
 * @param {Element} container
 */
export default async function renderStoreSwitcher(container) {
  const root = getRootPath();
  const buttonHolder = document.createElement('div');
  buttonHolder.className = 'storeview-switcher-button';
  container.append(buttonHolder);

  let fragmentStoreView;
  try {
    fragmentStoreView = await loadFragment('/store-switcher');
    if (!fragmentStoreView) throw new Error('Store Switcher fragment (/store-switcher) not found');
  } catch (error) {
    console.error('Error loading store switcher fragment:', error);
    buttonHolder.remove();
    return;
  }

  const storeSwitcher = document.createElement('div');
  const selected = [...fragmentStoreView.querySelectorAll('a')]
    .find((a) => new URL(a.href).pathname.startsWith(root));
  storeSwitcher.id = 'storeview-modal';
  while (fragmentStoreView.firstElementChild) {
    storeSwitcher.append(fragmentStoreView.firstElementChild);
  }

  ['storeview-title', 'storeview-list'].forEach((c, i) => {
    const section = storeSwitcher.children[i];
    if (section) section.classList.add(`storeview-modal-${c}`);
  });

  const title = storeSwitcher.querySelector('.storeview-modal-storeview-title h3');
  if (title) {
    title.className = 'storeview-modal-storeview-title';
    title.setAttribute('tabindex', '0');
  }

  const storeViewList = storeSwitcher.querySelector('.storeview-modal-storeview-list');
  if (!storeViewList || !storeViewList.children.length) return;

  storeViewList.querySelectorAll(':scope .default-content-wrapper > ul').forEach((storeView) => {
    if (storeView.querySelector('ul')) storeView.classList.add('storeview-selection');
  });

  storeViewList.querySelectorAll('.default-content-wrapper > ul > li > ul').forEach((storeRegion) => {
    if (storeRegion.children.length <= 1) return;
    if (storeRegion.querySelector('ul')) storeRegion.classList.add('storeviews');
    storeViewList.querySelectorAll(':scope li').forEach((storeView) => {
      const link = storeView.closest('a');
      if (link) link.setAttribute('tabindex', '0');
      const toggle = () => {
        const expanded = storeView.getAttribute('aria-expanded') === 'true';
        toggleStoreDropdown(storeViewList);
        storeView.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      };
      storeView.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(); });
      storeView.addEventListener('click', toggle);
    });
  });

  storeViewList.querySelectorAll('.default-content-wrapper > ul > li > ul').forEach((storeRegion) => {
    const li = storeRegion.closest('li');
    if (storeRegion.children.length <= 1) {
      li.classList.add('storeview-single-store');
      const ulParent = li.closest('ul');
      const replacedChild = storeRegion.firstElementChild;
      replacedChild.className = 'storeview-single-store';
      ulParent.replaceChild(replacedChild, li);
      ulParent.setAttribute('tabindex', '0');
    } else {
      li.classList.add('storeview-multiple-stores');
      li.setAttribute('tabindex', '0');
    }
  });

  UI.render(Button, {
    children: `${selected?.text ?? ''}`,
    'data-testid': 'storeview-switcher-button',
    className: 'storeview-switcher-button',
    size: 'medium',
    variant: 'teritary',
    onClick: async () => {
      const modal = await createModal([storeSwitcher]);
      modal.showModal();
    },
  })(buttonHolder);
}
