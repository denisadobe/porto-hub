# cards-category

Custom **cards** block. Purpose: Horizontal track of round icon chips that filter the cards-product cards on the same page by category.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row per chip. Cell 1: icon image. Cell 2: label, optionally linked to #<category-slug> (e.g. #ar-condicionado). The slug is the link hash, or the label slugified (accents removed). The first chip (Destaques) is the default and shows all cards; other chips show cards whose category eyebrow slug matches. The URL hash selects a chip, so links elsewhere on the page (hero CTAs) to #<slug> activate it.

## Supported variations

No variations.

## Universal Editor fields

N/A (Document Authoring project)
