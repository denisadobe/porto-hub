# search-services

Custom **search** block. Purpose: Service finder input that filters the cards-product cards on the same page as the user types.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: optional row with a query-index URL (/servicos/query-index.json), used only when the page has no cards-product block (shows a link dropdown instead); optional row with the placeholder text (default: "Encontre o serviço que precisa").

## Supported variations

No variations.

## Universal Editor fields

Component `search-services` (models in `ue/models/blocks/search-services.json`, built into the root `component-*.json` by `npm run build:json`).

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Busca de serviços | `placeholder` | Texto do campo de busca | text | `div>div` |

Click the field placeholder text on the page to edit it in place.
