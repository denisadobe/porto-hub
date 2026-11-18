# cards-category

Custom **cards** block. Purpose: Horizontal track of round icon chips that filter the cards-product cards on the same page by category.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row per chip. Cell 1: icon image. Cell 2: label, optionally linked to #<category-slug> (e.g. #ar-condicionado). The slug is the link hash, or the label slugified (accents removed). The first chip (Destaques) is the default and shows all cards; other chips show cards whose category eyebrow slug matches. The URL hash selects a chip, so links elsewhere on the page (hero CTAs) to #<slug> activate it.

## Supported variations

No variations.

## Universal Editor fields

Component `cards-category` (models in `ue/models/blocks/cards-category.json`, built into the root `component-*.json` by `npm run build:json`). Children: `cards-category-item`.

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Categoria | `icon` | Ícone (SVG) | reference | `div:nth-child(1)>picture>img[src]` |
| Categoria | `label` | Nome da categoria | text | `div:nth-child(2)` |

Each chip is a container item. The label is also the filter key, so keep it equal to the card category text.
