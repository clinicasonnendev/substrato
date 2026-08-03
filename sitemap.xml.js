import { sbSelect } from './_lib/supabase.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const origin = new URL(request.url).origin;

  const [posts, books] = await Promise.all([
    sbSelect(env, 'posts', 'select=slug,published_at&status=eq.published'),
    sbSelect(env, 'books', 'select=slug,published_at&status=eq.published'),
  ]);

  const urls = [
    { loc: `${origin}/`, lastmod: new Date().toISOString() },
    ...posts.map(p => ({ loc: `${origin}/post/${p.slug}`, lastmod: p.published_at })),
    ...books.map(b => ({ loc: `${origin}/livro/${b.slug}`, lastmod: b.published_at })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
}
