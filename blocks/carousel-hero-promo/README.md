# carousel-hero-promo

Custom **carousel** block. Purpose: Full-width rotating promo banner with a photo background per slide, prev/next arrows, dot pagination and autoplay (pauses on hover/focus).

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row per slide. Cell 1: desktop image (1920×300) followed by the mobile image (430×764); the desktop one shows from 900px, the mobile one below. A single image is used at every width. Cell 2: heading (title), subtitle paragraph, CTA link, optional coupon as inline code (`PORTOPLUS`, rendered with a Copiar button), fine-print paragraphs after the CTA/coupon become the disclaimer.

## Supported variations

No variations.

## Universal Editor fields

Component `carousel-hero-promo` (models in `ue/models/blocks/carousel-hero-promo.json`, built into the root `component-*.json` by `npm run build:json`). Children: `carousel-hero-promo-slide`.

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Slide | `image` | Imagem desktop (1920×300) | reference | `div:nth-child(1)>picture:nth-of-type(1)>img[src]` |
| Slide | `imageAlt` | Texto alternativo da imagem desktop | text | `div:nth-child(1)>picture:nth-of-type(1)>img[alt]` |
| Slide | `imageMobile` | Imagem mobile (430×764) | reference | `div:nth-child(1)>picture:nth-of-type(2)>img[src]` |
| Slide | `imageMobileAlt` | Texto alternativo da imagem mobile | text | `div:nth-child(1)>picture:nth-of-type(2)>img[alt]` |
| Slide | `text` | Conteúdo | richtext | `div:nth-child(2)` |

Each slide is a container item (add, remove and reorder slides in the content tree). In the editor autoplay is off; selecting a slide in the tree shows it.
