/**
 * columns-video
 * One row, two cells: text column + a video column. The video column holds a
 * YouTube / Vimeo / .mp4 link, optionally with a poster image. With a poster the
 * embed loads on click; without one it loads when scrolled into view.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { IS_UE, claimDecoration, replacePicture } from '../../scripts/ue-utils.js';

/*
 * UE model columns-video: text (rich text, cell 1) and video (plain text URL, cell 2).
 * The cells themselves are kept (they carry the editor fields); only their content is decorated.
 * A cell holding just a video URL (link or plain text, as the editor's text field writes it)
 * becomes the player.
 */

/** A plain-text video URL (the editor's text field) becomes a link the decorator understands. */
function linkPlainUrl(col) {
  if (col.querySelector('a[href]')) return;
  const text = col.textContent.trim();
  if (!/^https?:\/\/\S+$/.test(text)) return;
  const a = document.createElement('a');
  a.href = text;
  a.textContent = text;
  col.replaceChildren(a);
}

function getEmbed(href) {
  let url;
  try {
    url = new URL(href, window.location.href);
  } catch (e) {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    let id = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
    if (!id) {
      const m = url.pathname.match(/\/(?:embed|shorts|v)\/([^/?]+)/);
      if (m) [, id] = m;
    }
    if (!id) return null;
    return { type: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0` };
  }
  if (host.endsWith('vimeo.com')) {
    const m = url.pathname.match(/\/(\d+)/);
    if (!m) return null;
    return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}` };
  }
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { type: 'video', src: url.href };
  return null;
}

function buildPlayer(embed, title, autoplay) {
  if (embed.type === 'video') {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.src = embed.src;
    if (autoplay) video.autoplay = true;
    return video;
  }
  const iframe = document.createElement('iframe');
  const src = new URL(embed.src);
  if (autoplay) src.searchParams.set('autoplay', '1');
  iframe.src = src.href;
  iframe.title = title || 'Vídeo';
  iframe.loading = 'lazy';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  return iframe;
}

function decorateVideo(col, link, embed) {
  const poster = col.querySelector('picture');
  const title = link.title || link.textContent.trim();
  const wrapper = document.createElement('div');
  wrapper.className = 'columns-video-embed';

  if (poster) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'columns-video-poster';
    button.setAttribute('aria-label', `Reproduzir vídeo${title && !/^https?:/.test(title) ? `: ${title}` : ''}`);
    button.append(poster);
    const play = document.createElement('span');
    play.className = 'columns-video-play';
    play.setAttribute('aria-hidden', 'true');
    button.append(play);
    button.addEventListener('click', () => {
      wrapper.replaceChildren(buildPlayer(embed, title, true));
      wrapper.classList.add('is-playing');
    }, { once: true });
    wrapper.append(button);
  } else {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        wrapper.append(buildPlayer(embed, title, false));
      }
    }, { rootMargin: '200px' });
    observer.observe(wrapper);
  }

  col.replaceChildren(wrapper);
  col.classList.add('columns-video-col');
}

export default function decorate(block) {
  if (!claimDecoration(block)) return;
  if (IS_UE) block.classList.add('columns-video-editor');
  const firstRow = block.firstElementChild;
  const cols = firstRow ? [...firstRow.children] : [];
  block.classList.add(`columns-video-${cols.length}-cols`);

  [...block.children].forEach((row) => {
    row.classList.add('columns-video-row');
    [...row.children].forEach((col) => {
      linkPlainUrl(col);
      const embedLink = [...col.querySelectorAll('a[href]')]
        .map((a) => ({ a, embed: getEmbed(a.href) }))
        .find((x) => x.embed);
      if (embedLink && !col.querySelector('h1, h2, h3, h4, h5, h6, ul, ol')) {
        decorateVideo(col, embedLink.a, embedLink.embed);
        return;
      }
      col.classList.add('columns-video-text-col');
      const pic = col.querySelector('picture');
      if (pic && col.children.length === 1) col.classList.add('columns-video-img-col');
    });
  });

  block.querySelectorAll('picture > img').forEach((img) => {
    const url = new URL(img.src, window.location.href);
    if (url.origin !== window.location.origin || /\.svg$/i.test(url.pathname)) return;
    replacePicture(img.closest('picture'), createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));
  });
}
