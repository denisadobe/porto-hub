/*
 * Universal Editor (Author Bus) behaviors. Loaded by scripts/scripts.js only in the editor
 * (*.ue.da.live, see IS_UE in scripts/ue-utils.js), before the page decorates.
 * Blocks keep their own instrumentation (moveInstrumentation in scripts/ue-utils.js); this file
 * re-renders edited blocks and makes interactive blocks react to what the author selects.
 *
 * Edits of DA content (urn:ab:…): after a properties-panel or inline edit, the editor script only
 * swaps the raw value in (innerHTML of the text/richtext element, src of the image), so a
 * decorated block would lose its structure and styles, and the next edit would target markup
 * that no longer exists. The edited block (or default-content text) is instead taken again from
 * the page as the editor serves it after the save, decorated and loaded; the event stops at
 * body. Anything else (block options, sections, page metadata, adding/removing/moving items)
 * keeps the editor's default: a page reload, which also refreshes its properties panel.
 *
 * Blocks are reached through DOM events (no block module imports):
 *   carousel-hero-promo                 listens to "carousel-hero-promo:show" { detail: { index } }
 *   accordion-faq, accordion-link-list  <details> items are opened directly
 *   cards-category, cards-product       the selected item is scrolled into view
 */

const AB_PREFIX = 'urn:ab:';
// a block's own resource (columns blocks are instrumented as …/columns-N)
const BLOCK_RESOURCE = /^urn:ab:section-\d+\/(?:block|columns)-\d+$/;

/** The decorated part of the page an edit belongs to: its block, or its default-content text. */
function editedPart(target) {
  const block = target?.closest?.('.block[data-aue-resource]');
  if (block) return BLOCK_RESOURCE.test(block.dataset.aueResource) ? block : null;
  return target?.closest?.('.default-content-wrapper[data-aue-resource]') || null;
}

/** The page as the editor serves it now (instrumented, after the save). */
async function fetchEditorPage() {
  const resp = await fetch(window.location.href, { cache: 'no-store' });
  if (!resp.ok) throw new Error(`page ${resp.status}`);
  return new DOMParser().parseFromString(await resp.text(), 'text/html');
}

/** Replaces a block / text with its saved markup, then decorates and loads it. */
async function renderAgain(part) {
  const resource = part.dataset.aueResource;
  const fresh = (await fetchEditorPage()).querySelector(`[data-aue-resource="${resource}"]`);
  if (!fresh) throw new Error(`${resource} not in the page`);
  const el = document.adoptNode(fresh);
  if (el.classList.contains('richtext')) {
    // default content: the wrapper decorateSections makes of an instrumented div.richtext
    el.classList.replace('richtext', 'default-content-wrapper');
  }
  part.replaceWith(el);
  // imported here, not at the top: scripts.js awaits this module before the page decorates,
  // so a static import of it would never resolve (and the page would stay blank)
  const { decorateEditorContent } = await import('../../scripts/scripts.js');
  await decorateEditorContent(el);
}

const IN_PLACE_TYPES = ['text', 'richtext', 'media'];

/**
 * Whether the editor would apply this patch in place (the element of the patched prop is text,
 * richtext or media). Anything else (e.g. "classes", block options) makes the editor reload the
 * page, which also refreshes its properties panel: left to the editor, or the panel keeps the
 * old values and the next change fails ("Failed to apply patch").
 */
function patchedInPlace(target, name) {
  let el = target;
  if (name && el?.getAttribute?.('data-aue-prop') !== name) el = el?.querySelector?.(`[data-aue-prop="${name}"]`);
  return IN_PLACE_TYPES.includes(el?.getAttribute('data-aue-type'));
}

function setupDaContentHandlers() {
  ['aue:content-patch', 'aue:content-update'].forEach((type) => {
    document.body.addEventListener(type, (event) => {
      const resource = event.detail?.request?.target?.resource;
      if (!resource?.startsWith(AB_PREFIX)) return;
      if (type === 'aue:content-patch' && !patchedInPlace(event.target, event.detail?.patch?.name)) return;
      const part = editedPart(event.target);
      if (!part) return; // section, page metadata…: editor default
      event.stopPropagation();
      // the saved content could not be read: a reload shows it (the editor's own fallback)
      renderAgain(part).catch(() => window.location.reload());
    });
  });
}

function setupSelectionHandlers() {
  document.body.addEventListener('aue:ui-select', ({ detail }) => {
    const resource = detail?.resource;
    if (!resource) return;
    const element = document.querySelector(`[data-aue-resource="${resource}"]`);
    if (!element) return;
    const blockEl = element.closest('.block');
    if (!blockEl) return;

    if (blockEl.classList.contains('carousel-hero-promo')) {
      const slide = element.closest('.carousel-hero-promo-slide');
      if (slide) {
        blockEl.dispatchEvent(new CustomEvent('carousel-hero-promo:show', {
          detail: { index: parseInt(slide.dataset.slideIndex, 10) },
        }));
      }
    } else if (blockEl.classList.contains('accordion-faq') || blockEl.classList.contains('accordion-link-list')) {
      element.closest('details')?.setAttribute('open', '');
    } else if (blockEl.classList.contains('cards-category') || blockEl.classList.contains('cards-product')) {
      element.closest('li')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  });
}

export default () => {
  setupDaContentHandlers();
  setupSelectionHandlers();
};
