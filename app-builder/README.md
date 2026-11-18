# Porto Serviço – App Builder

Demo services for the Porto Serviço purchase journey: **coverage by CEP → scheduling → installation address → cart → checkout**.

Not served by the site (excluded in `.hlxignore`). Deployed to the App Builder project **"flosi Porto Serviço App"** (org Adobe Demo System), workspace **Stage**, by `.github/workflows/app-builder-deploy-stage.yaml` on every push to `main` that touches `app-builder/`.

## Deployment

One repository secret: `AIO_STAGE_WORKSPACE_JSON` holds the contents of Developer Console → project → **Stage** → **Download all**. The workspace needs Runtime and at least one API with an **OAuth Server-to-Server** credential (used to sign in the deploy). If the secret is missing, the deploy job is skipped with a notice.

Base URL: `https://<namespace>.adobeioruntime.net/api/v1/web/porto-servico` (printed in the workflow summary).

## API (public web actions; CORS `*` added by I/O Runtime — actions must not set it)

| Action | Method | Input | Output |
| --- | --- | --- | --- |
| `coverage` | GET | `cep`, `sku` (optional) | `{ cep, served, reason?, region, address, addressLookup, message }` |
| `slots` | GET | `cep`, `sku`, `days` (optional, 1–60) | `{ region, holdMinutes, days: [{ date, weekday, label, shifts: [{ id, label, window, remaining, available }] }] }` |
| `reserve` | POST JSON | `cep`, `sku`, `date` (YYYY-MM-DD), `shift`, `clientId` (UUID kept by the browser), `replaces` (optional previous reservation id) | reservation `{ id, status: "held", date, shift, region, expiresAt, … }` |
| `release` | POST JSON | `reservationId` | `{ released }` (held reservations only) |
| `reservation` | GET | `id` | reservation (`held` or `confirmed`) |

Errors: `{ error: { code, message } }`, with `message` in Portuguese, ready to show to the customer. Codes include `invalid_cep`, `cep_not_found`, `not_served_region`, `not_served_service`, `invalid_date`, `invalid_shift`, `slot_full`, `too_many_holds`, `invalid_client`, `reservation_not_found`, `reservation_confirmed`.

## Data

App Builder State (key-value with TTL):

- `cfg.coverage`, `cfg.agenda`: configuration (falls back to `actions/lib/defaults.js`). Written later by the Admin UI SDK screens in the Commerce admin.
- `slot.<region>.<date>.<shift>.<unit>`: one key per booked unit, claimed atomically (`ifNotExists`), so a shift can never be overbooked.
- `hold.<clientId>.<id>`: a customer's active holds; at most 2 at a time (`too_many_holds`), so one session can't fill the agenda. In production, tie this to the Commerce cart and add rate limiting / bot protection in front (API Mesh or CDN).
- `rsv.<id>`: the reservation. Held: expires after `holdMinutes` (15). Confirmed (`confirmReservation`, called when the order is placed, next stage): kept until 30 days after the visit.

Address lookup: [ViaCEP](https://viacep.com.br) (real). Coverage still answers if ViaCEP is down (`addressLookup: "unavailable"`).

`simulatedOccupancy` pre-fills part of each shift (stable per region/day/shift, some shifts full) so the demo agenda looks realistic; turn it off in the agenda configuration.

## Tests

`npm test` (Jest, in-memory store and mocked ViaCEP), also run by the workflow before deploying.

## Commerce webhooks (order placement)

These are raw-http web actions. Every call is checked: the `x-adobe-commerce-webhook-signature` header must match the public key in `commerce-webhook-public-key.pem`. The key comes from Stores > Configuration > Adobe Services > Webhooks. It is public by design, so it is committed. Without the key, every call is rejected.

| Action | Webhook method (System > Webhooks > Webhooks Subscriptions) | Type | Required | What it does |
| --- | --- | --- | --- | --- |
| `webhook-order-validate` | `observer.sales_order_place_before` | before | yes | Blocks the order unless every item has a live `porto_reservation_id` for the same SKU and the shipping CEP matches. It returns `op: exception`, and its message is shown at checkout. A valid hold gets 10 more minutes. |
| `webhook-order-placed` | `plugin.sales.api.order_management.place` | after | no | Confirms the reservation with the order number. The booking is kept until 30 days after the visit. It also indexes the order (`ord.<entity_id>`) for the cancel webhook. |
| `webhook-order-cancel` | `plugin.sales.api.order_management.cancel` | after | no | Releases the booked shift. This method only sends `{ id }`, so the reservations come from the `ord.<entity_id>` index. |

**Hook fields:** none, so Commerce sends the full payload. The parser finds the order items (objects with a `sku`) and reads the `porto_reservation_id` custom attribute, whatever its shape. Commerce copies the cart item custom attributes set by the storefront to the order items.

**`REQUIRE_BOOKING`:** blocks items without a booking. Default: `true`.
