/* eslint-disable */
/* global WebImporter */

import carouselHeroPromoParser from './parsers/carousel-hero-promo.js';
import searchServicesParser from './parsers/search-services.js';
import cardsCategoryParser from './parsers/cards-category.js';
import cardsProductParser from './parsers/cards-product.js';
import columnsVideoParser from './parsers/columns-video.js';
import accordionFaqParser from './parsers/accordion-faq.js';
import cardsContactParser from './parsers/cards-contact.js';
import accordionLinkListParser from './parsers/accordion-link-list.js';
import cleanupTransformer from './transformers/portoseguro-cleanup.js';
import sectionsTransformer from './transformers/portoseguro-sections.js';

const PAGE_TEMPLATE = {
  "name": "servicos",
  "urls": [
    "https://www.portoseguro.com.br/servicos"
  ],
  "representativeUrl": "https://www.portoseguro.com.br/servicos",
  "description": "Porto Serviço landing page: hero promo carousel, service finder (search, category chips, product cards), video, FAQ, customer service cards and full services link list",
  "urlPattern": "/*",
  "blocks": [
    {
      "name": "carousel-hero-promo",
      "instances": [
        ".s-banner-hero"
      ]
    },
    {
      "name": "search-services",
      "instances": [
        ".section_products_by_category__search-bar"
      ]
    },
    {
      "name": "cards-category",
      "instances": [
        ".section_products_by_category__categories"
      ]
    },
    {
      "name": "cards-product",
      "instances": [
        ".Cards_wrapper__ujPK7",
        "div[class*='Cards_wrapper']"
      ]
    },
    {
      "name": "columns-video",
      "instances": [
        ".s-video-embed-card"
      ]
    },
    {
      "name": "accordion-faq",
      "instances": [
        "section.s-accordion"
      ]
    },
    {
      "name": "cards-contact",
      "instances": [
        ".s-customer-service-cards__content"
      ]
    },
    {
      "name": "accordion-link-list",
      "instances": [
        "section.styles_wrapper__tVD39 details.desk-only",
        "section[class*='styles_wrapper'] details.desk-only"
      ]
    }
  ],
  "sections": [
    {
      "id": "rc1",
      "name": "Breadcrumb",
      "selector": [
        "section.s-breadcrumb"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".s-breadcrumb nav"
      ]
    },
    {
      "id": "rc2",
      "name": "Hero promo carousel",
      "selector": [
        "div.s-banner-hero"
      ],
      "style": null,
      "blocks": [
        "carousel-hero-promo"
      ],
      "defaultContent": []
    },
    {
      "id": "rc4",
      "name": "Service finder",
      "selector": [
        "#product-search-bar",
        "section.section_products_by_category"
      ],
      "style": null,
      "blocks": [
        "search-services",
        "cards-category",
        "cards-product"
      ],
      "defaultContent": []
    },
    {
      "id": "rc6",
      "name": "Cuidado Porto (text + video)",
      "selector": [
        "section:has(.s-video-embed-card)",
        "#root > div:nth-of-type(4) > main.template-vitrine > section:nth-of-type(3)"
      ],
      "style": null,
      "blocks": [
        "columns-video"
      ],
      "defaultContent": []
    },
    {
      "id": "rc8",
      "name": "FAQ heading",
      "selector": [
        "main.template-vitrine > section:nth-of-type(4)",
        "#root > div:nth-of-type(4) > main.template-vitrine > section:nth-of-type(4)"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".s-title"
      ]
    },
    {
      "id": "rc10",
      "name": "FAQ accordion",
      "selector": [
        "section.s-accordion"
      ],
      "style": null,
      "blocks": [
        "accordion-faq"
      ],
      "defaultContent": []
    },
    {
      "id": "rc12",
      "name": "Atendimento heading",
      "selector": [
        "main.template-vitrine > section:nth-of-type(6)",
        "#root > div:nth-of-type(4) > main.template-vitrine > section:nth-of-type(6)"
      ],
      "style": null,
      "blocks": [],
      "defaultContent": [
        ".s-title"
      ]
    },
    {
      "id": "rc14",
      "name": "Customer service cards",
      "selector": [
        "section.s-customer-service-cards"
      ],
      "style": null,
      "blocks": [
        "cards-contact"
      ],
      "defaultContent": []
    },
    {
      "id": "rc16",
      "name": "Todos os nossos serviços",
      "selector": [
        "section.styles_wrapper__tVD39",
        "section[class*='styles_wrapper']"
      ],
      "style": null,
      "blocks": [
        "accordion-link-list"
      ],
      "defaultContent": []
    }
  ]
};

const parsers = {
  'carousel-hero-promo': carouselHeroPromoParser,
  'search-services': searchServicesParser,
  'cards-category': cardsCategoryParser,
  'cards-product': cardsProductParser,
  'columns-video': columnsVideoParser,
  'accordion-faq': accordionFaqParser,
  'cards-contact': cardsContactParser,
  'accordion-link-list': accordionLinkListParser,
};
// Late transformers change the DOM (section <hr> markers, shared fragments), so their beforeTransform
// runs after block discovery.
const sectionTransformers = [sectionsTransformer];
const fragmentTransformers = [];
const lateTransformers = [...sectionTransformers, ...fragmentTransformers];
const transformers = [cleanupTransformer, ...lateTransformers];
const earlyTransformers = transformers.filter((fn) => !lateTransformers.includes(fn));
// Catalog selectors (pageInstances, pageCleanup) count the <script> and <hr> elements the importer
// removes before transform, so a catalog template finds its targets in preprocess.
const CATALOG = Boolean(PAGE_TEMPLATE.pageCleanup || PAGE_TEMPLATE.blocks.some((b) => b.pageInstances));

function executeTransformers(hookName, element, payload, list = transformers) {
  const enhancedPayload = { ...payload, template: payload.params?.targets?.template || PAGE_TEMPLATE };
  list.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); }
    catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template, url) {
  const pageBlocks = [];
  const pageKey = (u) => {
    try { const { origin, pathname } = new URL(u); return `${origin}${pathname.replace(/\/$/, '')}`; }
    catch { return u; }
  };
  const key = pageKey(url);
  const claim = (blockDef, selector) => {
    let matches = [];
    try { matches = document.querySelectorAll(selector); } catch { return; }
    matches.forEach((element) => {
      if (pageBlocks.some((b) => b.element === element || b.element.contains(element) || element.contains(b.element))) return;
      pageBlocks.push({ name: blockDef.name, selector, element });
    });
  };
  template.blocks.forEach((blockDef) => {
    const entry = Object.entries(blockDef.pageInstances || {}).find(([u]) => pageKey(u) === key);
    (entry ? entry[1] : []).forEach((selector) => claim(blockDef, selector));
  });
  template.blocks.forEach((blockDef) => (blockDef.instances || []).forEach((selector) => claim(blockDef, selector)));
  return pageBlocks;
}

// Runs the early transformers, then marks each block and section target with an attribute: the
// importer re-creates the body before transform, so only attributes survive, not element references.
function markPageTargets(payload) {
  const { document, params } = payload;
  executeTransformers('beforeTransform', document.body, payload, earlyTransformers);
  const blocks = findBlocksOnPage(document, PAGE_TEMPLATE, params.originalURL).map(({ name, selector, element }, i) => {
    element.setAttribute('data-excat-block', String(i));
    return { name, selector };
  });
  const sections = (PAGE_TEMPLATE.sections || []).map((section, i) => {
    const target = (section.selector || []).map((s) => { try { return document.querySelector(s); } catch { return null; } }).find(Boolean);
    if (!target) return section;
    target.setAttribute('data-excat-section', String(i));
    return { ...section, selector: [`[data-excat-section="${i}"]`] };
  });
  params.targets = { blocks, template: { ...PAGE_TEMPLATE, sections } };
}

export default {
  preprocess: (payload) => {
    if (CATALOG) markPageTargets(payload);
  },
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;
    params.fragments = [];

    if (!params.targets) markPageTargets(payload);
    const pageBlocks = params.targets.blocks
      .map((block, i) => ({ ...block, element: document.querySelector(`[data-excat-block="${i}"]`) }))
      .filter((block) => block.element);
    executeTransformers('beforeTransform', main, { ...payload, pageBlocks }, lateTransformers);

    pageBlocks.forEach((block) => {
      if (!main.contains(block.element)) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); }
      catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    main.appendChild(document.createElement('hr'));
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // A fragment's nodes left `main` before afterTransform: finalize it the same way, without the
    // page-only section breaks and metadata.
    params.fragments.forEach(({ element }) => {
      executeTransformers('afterTransform', element, payload, earlyTransformers);
      WebImporter.rules.transformBackgroundImages(element, document);
      WebImporter.rules.adjustImageUrls(element, url, params.originalURL);
    });

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    // The Porto Serviço landing page (/servicos) is this site's home page.
    const HOME_PATHS = ['', '/servicos'];
    const path = WebImporter.FileUtils.sanitizePath(HOME_PATHS.includes(rawPath) ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: pageBlocks.map((b) => b.name) },
    }, ...params.fragments];
  },
};
