/* eslint-disable */
/* global WebImporter */
/**
 * Parser: columns-video
 * Source: .s-video-embed-card
 * One row, two cells: [heading + bulleted list] [video link (YouTube watch URL)]
 */
function toWatchUrl(src) {
  if (!src) return '';
  const m = src.match(/(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([\w-]{6,})/);
  if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  const v = src.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (v) return `https://vimeo.com/${v[1]}`;
  return src;
}

export default function parse(element, { document }) {
  const cells = [];

  // Cell 1: text
  const textCell = [];
  const textCol = element.querySelector('.s-video-embed-card__text-content');
  if (textCol) {
    const heading = textCol.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) textCell.push(heading);
    const description = textCol.querySelector('.s-video-embed-card__description');
    if (description) textCell.push(...description.children);
  }

  // Cell 2: video link
  const videoCell = [];
  const videoCol = element.querySelector('.s-video-embed-card__video');
  if (videoCol) {
    const iframe = videoCol.querySelector('iframe[src]');
    const link = videoCol.querySelector('a[href]');
    const href = iframe ? toWatchUrl(iframe.getAttribute('src')) : (link ? link.getAttribute('href') : '');
    if (href) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = href;
      if (iframe && iframe.getAttribute('title')) a.title = iframe.getAttribute('title');
      const p = document.createElement('p');
      p.append(a);
      videoCell.push(p);
    }
  }

  cells.push([textCell, videoCell]);

  const block = WebImporter.Blocks.createBlock(document, { name: 'columns-video', cells });
  element.replaceWith(block);
}
