# booking-flow

Sell a few services directly on any page (for example a partner landing page): the customer picks a service and books it there — CEP coverage, day and shift, address — then goes to a prefilled checkout. Same flow as the product page (`scripts/service-booking.js`), backed by the App Builder services and the Commerce cart.

## Authoring (Document Authoring)

Model: `standalone`

One row per service. Cell 1: the Commerce SKU (e.g. `ADB201`). Cell 2 (optional): the name to show instead of the catalog name. Name, image and price come from Commerce; services whose SKU is not in the catalog are shown disabled. The layout follows the number of rows: one service is shown as a product summary (beside the flow on desktop); two or three appear as equal cards in one row above the flow; more than three wrap into rows of four (desktop) or three (tablet). On mobile, two or more services become a swipeable row.

| booking-flow | |
| --- | --- |
| ADB201 | Limpeza de ar-condicionado |
| ADB220 | Instalação de ar-condicionado |

## Supported variations

No variations.

## Universal Editor fields

Component `booking-flow` (models in `ue/models/blocks/booking-flow.json`, built into the root `component-*.json` by `npm run build:json`). Children: `booking-flow-item`.

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Serviço | `sku` | SKU do serviço no Commerce | text | `div:nth-child(1)` |
| Serviço | `label` | Nome exibido (opcional) | text | `div:nth-child(2)` |

Each service is a container item (add, remove and reorder in the content tree); edit the SKU and name in the properties panel.
