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
| `reserve` | POST JSON | `cep`, `sku`, `date` (YYYY-MM-DD), `shift`, `replaces` (optional previous reservation id) | reservation `{ id, status: "held", date, shift, region, expiresAt, … }` |
| `release` | POST JSON | `reservationId` | `{ released }` (held reservations only) |
| `reservation` | GET | `id` | reservation (`held` or `confirmed`) |

Errors: `{ error: { code, message } }`, with `message` in Portuguese, ready to show to the customer. Codes include `invalid_cep`, `cep_not_found`, `not_served_region`, `not_served_service`, `invalid_date`, `invalid_shift`, `slot_full`, `reservation_not_found`, `reservation_confirmed`.

## Data

App Builder State (key-value with TTL):

- `cfg.coverage`, `cfg.agenda`: configuration (falls back to `actions/lib/defaults.js`). Written later by the Admin UI SDK screens in the Commerce admin.
- `slot.<region>.<date>.<shift>.<unit>`: one key per booked unit, claimed atomically (`ifNotExists`), so a shift can never be overbooked.
- `rsv.<id>`: the reservation. Held: expires after `holdMinutes` (15). Confirmed (`confirmReservation`, called when the order is placed, next stage): kept until 30 days after the visit.

Address lookup: [ViaCEP](https://viacep.com.br) (real). Coverage still answers if ViaCEP is down (`addressLookup: "unavailable"`).

`simulatedOccupancy` pre-fills part of each shift (stable per region/day/shift, some shifts full) so the demo agenda looks realistic; turn it off in the agenda configuration.

## Tests

`npm test` (Jest, in-memory store and mocked ViaCEP), also run by the workflow before deploying.
