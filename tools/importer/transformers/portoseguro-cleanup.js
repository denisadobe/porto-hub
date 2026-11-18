/* eslint-disable */
/* global WebImporter */

/**
 * Cleanup transformer for portoseguro.com.br (template: servicos).
 * Removes non-authorable chrome. Selectors taken from migration-work/cleaned.html.
 */
export default function transform(hookName, element, payload) {
  if (hookName === 'beforeTransform') {
    WebImporter.DOMUtils.remove(element, [
      // Cookie consent banner (Securiti CMP)
      '.cc-revoke',
      '.cc-window',
      '.cmp-loader',
      // Carousel controls (hero banner)
      '.s-banner-hero__slider__arrows',
      '.s-banner-hero__slider__dots',
      // Mobile duplicate of "Todos os nossos serviços" list (desk-only copy is kept)
      "section[class*='styles_wrapper'] details.mobile-only",
      // Mobile duplicate CTAs inside product cards (desk-only copy is kept)
      "div[class*='Cards_wrapper'] div.mobile-only",
    ]);

    // Section titles the source styles as headings but marks up as <p> become <h2>
    element.querySelectorAll('.s-title > p').forEach((p) => {
      const h2 = element.ownerDocument.createElement('h2');
      h2.innerHTML = p.innerHTML;
      p.replaceWith(h2);
    });
  }

  if (hookName === 'afterTransform') {
    WebImporter.DOMUtils.remove(element, [
      // Global header and footer
      'header.header__root',
      'footer.footer__root',
      // Floating WhatsApp button rendered after the footer
      "div[class*='styles_wrapper__1YtRf']",
      // Engagement widget
      '#engagement-wrapper',
      // Empty spacer divs
      'div.s-spacing',
      // Misc non-content nodes
      'next-route-announcer',
      'iframe:not([src*="youtube"]):not([src*="vimeo"])',
      'script',
      'style',
      'noscript',
      'link',
    ]);

    // Strip tracking / framework attributes
    element.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((attr) => {
        if (/^(data-(gtm|track|analytics|testid|nscript)|onclick|onload)/i.test(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }
}
