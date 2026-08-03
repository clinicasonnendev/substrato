import { getSiteSettings, sbSelect } from './_lib/supabase.js';
import { renderPage, escapeHtml } from './_lib/layout.js';

function renderLandingBlocks(blocks) {
  return blocks.map((b, i) => {
    if (i === 0 && b.block_type !== 'image') {
      return `
        <div class="hero-block">
          <h1>${b.title || ''}</h1>
          <div class="tagline">${b.content_html || ''}</div>
          ${b.image_url ? `<img src="${escapeHtml(b.image_url)}" class="hero-image">` : ''}
        </div>`;
    }
    const cls = b.block_type === 'text' ? 'text-only' : b.block_type === 'image' ? 'image-only' : '';
    const textPart = b.block_type !== 'image' ? `<div><h2>${b.title || ''}</h2><div>${b.content_html || ''}</div></div>` : '';
    const imgPart = b.block_type !== 'text' && b.image_url ? `<img src="${escapeHtml(b.image_url)}">` : '';
    return `<div class="landing-block ${cls}"><div class="block-inner">${textPart}${imgPart}</div></div>`;
  }).join('');
}

function renderPostCard(p) {
  return `
    <a class="card" href="/post/${p.slug}">
      ${p.cover_image_url ? `<img src="${escapeHtml(p.cover_image_url)}" loading="lazy">` : ''}
      <div class="card-body">
        <div class="card-title">${escapeHtml(p.title)}</div>
        ${p.excerpt ? `<div class="card-excerpt">${escapeHtml(p.excerpt)}</div>` : ''}
      </div>
    </a>`;
}

function renderBookCard(b) {
  const stars = b.rating ? '★'.repeat(Math.round(b.rating)) + '☆'.repeat(5 - Math.round(b.rating)) : '';
  return `
    <a class="card" href="/livro/${b.slug}">
      ${b.cover_image_url ? `<img src="${escapeHtml(b.cover_image_url)}" loading="lazy">` : ''}
      <div class="card-body">
        <div class="card-title">${escapeHtml(b.title)}</div>
        ${b.author ? `<div class="card-author">${escapeHtml(b.author)}</div>` : ''}
        ${stars ? `<div class="stars">${stars}</div>` : ''}
      </div>
    </a>`;
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url).origin + '/';

  const [settings, blocks, posts, books] = await Promise.all([
    getSiteSettings(env),
    sbSelect(env, 'landing_blocks', 'select=*&order=order_index'),
    sbSelect(env, 'posts', 'select=title,slug,excerpt,cover_image_url,published_at&status=eq.published&order=published_at.desc&limit=6'),
    sbSelect(env, 'books', 'select=title,author,slug,synopsis,cover_image_url,rating,published_at&status=eq.published&order=published_at.desc&limit=6'),
  ]);

  const bodyHtml = `
    ${renderLandingBlocks(blocks)}
    <div class="section-title" id="posts"><h2>Textos recentes</h2></div>
    <div class="card-grid">
      ${posts.length ? posts.map(renderPostCard).join('') : '<div class="empty-note">Nenhum texto publicado ainda.</div>'}
    </div>
    <div class="section-title" id="livros"><h2>Livros</h2></div>
    <div class="card-grid">
      ${books.length ? books.map(renderBookCard).join('') : '<div class="empty-note">Nenhum livro publicado ainda.</div>'}
    </div>
  `;

  const html = renderPage({
    settings,
    title: null,
    description: settings.tagline,
    url,
    bodyHtml,
  });

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=120' },
  });
}
