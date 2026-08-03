import { getSiteSettings, sbSingle } from '../_lib/supabase.js';
import { renderPage, escapeHtml } from '../_lib/layout.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const origin = new URL(request.url).origin;
  const url = `${origin}/livro/${params.slug}`;

  const settings = await getSiteSettings(env);
  const book = await sbSingle(env, 'books', `slug=eq.${encodeURIComponent(params.slug)}&status=eq.published&select=*`);

  if (!book) {
    const bodyHtml = `<div class="article-view"><a class="back-link" href="/">← voltar</a><p>Livro não encontrado.</p></div>`;
    const html = renderPage({ settings, title: 'Não encontrado', url, bodyHtml });
    return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const stars = book.rating ? '★'.repeat(Math.round(book.rating)) + '☆'.repeat(5 - Math.round(book.rating)) : '';
  const metaLine = [book.author, stars].filter(Boolean).join(' · ');

  const bodyHtml = `
    <div class="article-view">
      <a class="back-link" href="/">← voltar</a>
      ${book.cover_image_url ? `<img class="article-cover" src="${escapeHtml(book.cover_image_url)}">` : ''}
      <div class="article-meta">${escapeHtml(metaLine)}</div>
      <h1>${escapeHtml(book.title)}</h1>
      ${book.synopsis ? `<p class="tagline">${escapeHtml(book.synopsis)}</p>` : ''}
      <div class="article-body">${book.review_html || ''}</div>
    </div>`;

  const html = renderPage({
    settings,
    title: book.meta_title || book.title,
    description: book.meta_description || book.synopsis,
    image: book.og_image_url || book.cover_image_url,
    url,
    type: 'article',
    bodyHtml,
  });

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
