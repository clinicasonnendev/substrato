import { getSiteSettings, sbSingle } from '../_lib/supabase.js';
import { renderPage, escapeHtml } from '../_lib/layout.js';

export async function onRequestGet(context) {
  const { env, request, params } = context;
  const origin = new URL(request.url).origin;
  const url = `${origin}/post/${params.slug}`;

  const settings = await getSiteSettings(env);
  const post = await sbSingle(env, 'posts', `slug=eq.${encodeURIComponent(params.slug)}&status=eq.published&select=*`);

  if (!post) {
    const bodyHtml = `<div class="article-view"><a class="back-link" href="/">← voltar</a><p>Texto não encontrado.</p></div>`;
    const html = renderPage({ settings, title: 'Não encontrado', url, bodyHtml });
    return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const dateLine = post.published_at
    ? new Date(post.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '';

  const bodyHtml = `
    <div class="article-view">
      <a class="back-link" href="/">← voltar</a>
      ${post.cover_image_url ? `<img class="article-cover" src="${escapeHtml(post.cover_image_url)}">` : ''}
      <div class="article-meta">${dateLine}</div>
      <h1>${escapeHtml(post.title)}</h1>
      <div class="article-body">${post.content_html || ''}</div>
    </div>`;

  const html = renderPage({
    settings,
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    image: post.og_image_url || post.cover_image_url,
    url,
    type: 'article',
    bodyHtml,
  });

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
