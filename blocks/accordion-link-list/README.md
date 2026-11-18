# accordion-link-list

Custom **accordion** block. Purpose: Disclosure holding a long link list that flows into 4 columns; open on desktop, collapsed on mobile.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row. Cell 1: title ("Todos os nossos serviços"). Cell 2: unordered list of links. Extra rows add more disclosures with the same behaviour.

## Supported variations

No variations.

## Universal Editor fields

Component `accordion-link-list` (models in `ue/models/blocks/accordion-link-list.json`, built into the root `component-*.json` by `npm run build:json`). Children: `accordion-link-list-item`.

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Grupo de links | `title` | Título | text | `div:nth-child(1)` |
| Grupo de links | `links` | Links | richtext | `div:nth-child(2)` |

Each group is a container item. In the editor all groups are open so the links can be edited.
