# cards-contact

Custom **cards** block. Purpose: Equal-width bordered contact cards with title, description and full-width button.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row per card, single cell: heading, description paragraph, CTA link alone in a paragraph (external links such as wa.me open in a new tab). An optional image cell is supported.

## Supported variations

No variations.

## Universal Editor fields

Component `cards-contact` (models in `ue/models/blocks/cards-contact.json`, built into the root `component-*.json` by `npm run build:json`). Children: `cards-contact-item`.

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Card de atendimento | `text` | Conteúdo | richtext | `div:nth-child(1)` |

Each card is a container item.
