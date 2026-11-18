/* eslint-disable */
/* global WebImporter */

/**
 * Section transformer for portoseguro.com.br.
 * Inserts <hr> section breaks in beforeTransform (while parser targets still exist)
 * and Section Metadata blocks in afterTransform for styled sections.
 */
const MARKER = 'data-excat-section-id';

function findSection(root, section) {
  const selectors = Array.isArray(section.selector) ? section.selector : [section.selector];
  for (const sel of selectors) {
    if (!sel) continue;
    try {
      const el = root.querySelector(sel);
      if (el) return el;
    } catch (e) {
      // invalid selector in this DOM implementation; try next
    }
  }
  return null;
}

export default function transform(hookName, element, payload) {
  const sections = (payload && payload.template && payload.template.sections) || [];
  if (sections.length < 2) return;
  const doc = element.ownerDocument || document;

  if (hookName === 'beforeTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      const el = findSection(element, section);
      if (!el || !el.parentNode) continue;
      if (i > 0) {
        const hr = doc.createElement('hr');
        if (section.style) hr.setAttribute(MARKER, section.id);
        el.parentNode.insertBefore(hr, el);
      } else if (section.style) {
        // Temporary marker for a styled first section; removed in afterTransform.
        const hr = doc.createElement('hr');
        hr.setAttribute(MARKER, section.id);
        hr.setAttribute('data-excat-first', 'true');
        el.parentNode.insertBefore(hr, el);
      }
    }
  }

  if (hookName === 'afterTransform') {
    for (let i = sections.length - 1; i >= 0; i -= 1) {
      const section = sections[i];
      if (!section.style) continue;
      const marker = element.querySelector(`hr[${MARKER}="${section.id}"]`);
      const metadata = WebImporter.Blocks.createBlock(doc, {
        name: 'Section Metadata',
        cells: { style: section.style },
      });

      // Place metadata at the end of the section: just before the next <hr> break.
      let anchor = marker ? marker.nextElementSibling : findSection(element, section);
      let last = anchor;
      if (marker) {
        let node = marker.nextElementSibling;
        while (node && node.tagName !== 'HR') {
          last = node;
          node = node.nextElementSibling;
        }
      }
      if (last && last.parentNode) {
        last.parentNode.insertBefore(metadata, last.nextSibling);
      } else if (marker && marker.parentNode) {
        marker.parentNode.insertBefore(metadata, marker.nextSibling);
      }

      if (marker) {
        if (marker.getAttribute('data-excat-first') === 'true') {
          marker.remove();
        } else {
          marker.removeAttribute(MARKER);
        }
      }
    }
  }
}
