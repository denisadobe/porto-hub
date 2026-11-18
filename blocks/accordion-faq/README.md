# accordion-faq

Custom **accordion** block. Purpose: Stacked collapsible FAQ panels with a plus/minus indicator; also emits FAQPage structured data.

## Authoring (Document Authoring)

Model: `standalone`

Single block table. Content: one row per item. Cell 1: question. Cell 2: answer (paragraphs, lists, bold, links). Icons in the question cell are dropped.

## Supported variations

No variations.

## Universal Editor fields

Component `accordion-faq` (models in `ue/models/blocks/accordion-faq.json`, built into the root `component-*.json` by `npm run build:json`). Children: `accordion-faq-item`.

| Component | Field | Label | Type | Cell selector |
| --- | --- | --- | --- | --- |
| Pergunta | `question` | Pergunta | text | `div:nth-child(1)` |
| Pergunta | `answer` | Resposta | richtext | `div:nth-child(2)` |

Each question is a container item. In the editor the FAQ JSON-LD is not generated and empty items show a placeholder.
