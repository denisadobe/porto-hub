# columns-video

Custom **columns** block. Purpose: Two-column layout with rich text beside an embedded video.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row, two cells. Cell 1: heading and bulleted list (bold lead-ins). Cell 2: a YouTube, Vimeo or .mp4 link, optionally with a poster image (poster: click to play; no poster: the embed loads when scrolled into view).

## Supported variations

No variations.

## Universal Editor fields

Component `columns-video` (models in `ue/models/blocks/columns-video.json`, built into the root `component-*.json` by `npm run build:json`).

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Texto + vídeo | `text` | Texto | richtext | `div>div:nth-child(1)` |
| Texto + vídeo | `video` | URL do vídeo | text | `div>div:nth-child(2)` |

The video URL is edited as plain text; the player is not interactive in the editor so it doesn't steal clicks.
