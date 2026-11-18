# cards-product

Custom **cards** block. Purpose: Grid of product/service cards with a generated "N serviços disponíveis" count, filtered by cards-category and search-services.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row per card. Cell 1: image. Cell 2: optional badge paragraph(s) (NOVIDADE, Compre e Ganhe!), category eyebrow paragraph (the last paragraph before the heading; comma-separate several categories), heading (title), price label paragraph ("A partir de"), price as a bold-only paragraph (**R$ 299,90**), optional instalment paragraph(s), benefit paragraph (the last text paragraph after the price), CTA link "Compre agora" alone in a paragraph. Do not author the count line; the block generates it.

Cell 3 (optional): the Adobe Commerce product SKU (plain text, e.g. `protege-casa-basico`). When set, the card is an AEM + Commerce mix:

- From Commerce (live, Catalog Service): product name (title), price (replaces the authored price and drops the authored instalments), image (only when the catalog has one; otherwise the authored image stays), stock, and the "Compre agora" link to the product page (`/products/{urlKey}/{sku}`). Out-of-stock products show "Indisponível".
- From AEM: badge, category (used by the chip filter), price label ("A partir de") and benefit text.
- If the SKU isn't found in Commerce, the card shows the authored content as-is.

## Supported variations

No variations.

## Universal Editor fields

Component `cards-product` (models in `ue/models/blocks/cards-product.json`, built into the root `component-*.json` by `npm run build:json`). Children: `cards-product-item`.

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Card de serviço | `image` | Imagem | reference | `div:nth-child(1)>picture>img[src]` |
| Card de serviço | `imageAlt` | Texto alternativo da imagem | text | `div:nth-child(1)>picture>img[alt]` |
| Card de serviço | `text` | Conteúdo | richtext | `div:nth-child(2)` |
| Card de serviço | `sku` | SKU do produto no Commerce | text | `div:nth-child(3)` |

Each card is a container item. In the editor the card shows the authored content (not the Commerce data) plus a dashed "Commerce · SKU" box with the SKU field; Commerce data is merged only on preview/live.
