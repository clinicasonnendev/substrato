// ============================================================
// SUBSTRATO — Worker único
// Substitui a pasta functions/ (Pages Functions), que não é
// processada nesse tipo de projeto criado pela tela
// "Workers & Pages → Create a Worker".
//
// Rotas dinâmicas tratadas aqui: /, /post/:slug, /livro/:slug,
// /sitemap.xml. Qualquer outra coisa (dashboard.html,
// styles.css, robots.txt) cai no fallback de arquivo estático.
// ============================================================

// ---------- CONFIG ----------
// SUPABASE_URL e SUPABASE_ANON_KEY nas env vars funcionam como "tenant
// padrão" (usado no domínio .workers.dev e como fallback se um domínio
// não tiver entrada no KV). Pra multi-cliente de verdade, cada domínio
// tem sua própria linha no namespace KV "TENANTS" (configurado no
// wrangler.jsonc), com um JSON assim:
//   {
//     "supabase_url": "https://xxxx.supabase.co",
//     "supabase_anon_key": "sb_publishable_...",
//     "demo_mode": false,
//     "showroom_mode": false,
//     "showroom_cta_url": "https://wa.me/5500000000000"
//   }
async function getTenant(env, hostname) {
  const fallback = {
    supabase_url: env.SUPABASE_URL,
    supabase_anon_key: env.SUPABASE_ANON_KEY,
    demo_mode: false,
    showroom_mode: false,
    showroom_cta_url: '',
  };
  if (!env.TENANTS) return fallback; // KV não configurado ainda: comporta como single-tenant

  try {
    const raw = await env.TENANTS.get(hostname);
    if (!raw) return fallback; // domínio sem entrada no KV: usa o padrão
    const tenant = JSON.parse(raw);
    return { ...fallback, ...tenant };
  } catch {
    return fallback;
  }
}

// ---------- SUPABASE (via REST, sem SDK) ----------
function sbHeaders(tenant) {
  return {
    apikey: tenant.supabase_anon_key,
    Authorization: `Bearer ${tenant.supabase_anon_key}`,
  };
}
async function sbSelect(tenant, table, query) {
  const url = `${tenant.supabase_url}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { headers: sbHeaders(tenant) });
  if (!res.ok) return [];
  return res.json();
}
async function sbSingle(tenant, table, query) {
  const rows = await sbSelect(tenant, table, query);
  return rows[0] || null;
}
async function getSiteSettings(tenant) {
  const data = await sbSingle(tenant, 'site_settings', 'id=eq.1&select=*');
  return data || {
    site_name: 'Meu Site', tagline: '',
    color_bg: '#14161A', color_panel: '#1C1F26',
    color_accent: '#C9A24B', color_accent_secondary: '#4E7C7C',
    color_text: '#EDE9E0', color_text_dim: '#9199A8',
    font_display: 'Newsreader', font_body: 'Inter', radius: '10px',
  };
}

// ---------- HELPERS DE RENDERIZAÇÃO ----------
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fontsLinkHref(settings) {
  const fonts = [...new Set([settings.font_display, settings.font_body])].filter(Boolean);
  const familyParam = fonts.map(f => f.replace(/ /g, '+') + ':wght@400;500;600;700').join('&family=');
  return `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;
}
function themeStyleTag(settings) {
  return `<style>
    :root{
      --bg:${settings.color_bg}; --panel:${settings.color_panel};
      --accent:${settings.color_accent}; --accent-2:${settings.color_accent_secondary};
      --text:${settings.color_text}; --text-dim:${settings.color_text_dim};
      --font-display:'${settings.font_display}',serif; --font-body:'${settings.font_body}',sans-serif;
      --radius:${settings.radius || '10px'};
    }
  </style>`;
}
function renderHead({ settings, title, description, url, image, type = 'website' }) {
  const fullTitle = title ? `${escapeHtml(title)} · ${escapeHtml(settings.site_name)}` : escapeHtml(settings.site_name);
  const desc = escapeHtml(description || settings.tagline || '');
  const img = image || settings.logo_url || '';
  return `
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fullTitle}</title>
    <meta name="description" content="${desc}">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="${type}">
    <meta property="og:title" content="${fullTitle}">
    <meta property="og:description" content="${desc}">
    <meta property="og:url" content="${url}">
    ${img ? `<meta property="og:image" content="${escapeHtml(img)}">` : ''}
    <meta name="twitter:card" content="${img ? 'summary_large_image' : 'summary'}">
    ${settings.favicon_url ? `<link rel="icon" href="${escapeHtml(settings.favicon_url)}">` : ''}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="stylesheet" href="${fontsLinkHref(settings)}">
    <link rel="stylesheet" href="/styles.css">
    ${themeStyleTag(settings)}
  `;
}
function renderHeader(settings) {
  return `
  <header>
    <div class="wrap">
      <a class="brand" href="/">
        ${settings.logo_url ? `<img src="${escapeHtml(settings.logo_url)}" alt="">` : ''}
        <span class="brand-name">${escapeHtml(settings.site_name)}</span>
      </a>
      <nav class="site-nav">
        <a href="/#posts">Textos</a>
        <a href="/#livros">Livros</a>
      </nav>
    </div>
  </header>`;
}
function renderFooter(settings) {
  return `<footer><div class="wrap">© ${new Date().getFullYear()} ${escapeHtml(settings.site_name)}</div></footer>`;
}
function renderPage({ settings, title, description, url, image, type, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
${renderHead({ settings, title, description, url, image, type })}
</head>
<body>
${renderHeader(settings)}
<main class="wrap" id="main-content">
${bodyHtml}
</main>
${renderFooter(settings)}
</body>
</html>`;
}

// ---------- BLOCOS / CARDS ----------
function renderLandingBlocks(blocks) {
  return blocks.map((b, i) => renderBlock(b, i === 0)).join('');
}

function renderBlock(b, isHero) {
  const hasImage = b.block_type !== 'text' && !!b.image_url;
  const position = b.image_position || 'right';
  const heading = isHero ? `<h1>${b.title || ''}</h1>` : `<h2>${b.title || ''}</h2>`;
  const textHtml = `${heading}<div class="${isHero ? 'tagline' : ''}">${b.content_html || ''}</div>`;

  // bloco só de imagem, sem texto nenhum
  if (b.block_type === 'image') {
    return b.image_url
      ? `<div class="landing-block image-only"><div class="wrap"><img src="${escapeHtml(b.image_url)}"></div></div>`
      : '';
  }

  // sem imagem: só o texto
  if (!hasImage) {
    return isHero
      ? `<div class="hero-block"><div class="hero-content">${textHtml}</div></div>`
      : `<div class="landing-block text-only"><div class="wrap">${textHtml}</div></div>`;
  }

  // com imagem "atrás", como fundo
  if (position === 'background') {
    const wrapClass = isHero ? 'hero-block has-bg' : 'landing-block has-bg';
    return `
      <div class="${wrapClass}" style="background-image:url('${escapeHtml(b.image_url)}')">
        <div class="hero-overlay"></div>
        <div class="wrap"><div class="hero-content">${textHtml}</div></div>
      </div>`;
  }

  // com imagem "no centro", acima do texto
  if (position === 'center') {
    return `
      <div class="${isHero ? 'hero-block' : 'landing-block'} pos-center">
        <div class="wrap">
          <img class="block-image-center" src="${escapeHtml(b.image_url)}">
          <div class="hero-content" style="margin:0 auto;">${textHtml}</div>
        </div>
      </div>`;
  }

  // esquerda ou direita: lado a lado
  const sideClass = position === 'left' ? 'pos-left' : 'pos-right';
  return `
    <div class="${isHero ? 'hero-block' : 'landing-block'} ${sideClass}">
      <div class="wrap">
        <div class="block-inner">
          <div class="hero-content">${textHtml}</div>
          <img src="${escapeHtml(b.image_url)}">
        </div>
      </div>
    </div>`;
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

// ---------- PÁGINAS ----------
async function renderHome(tenant, origin) {
  const url = origin + '/';
  const [settings, blocks, posts, books] = await Promise.all([
    getSiteSettings(tenant),
    sbSelect(tenant, 'landing_blocks', 'select=*&order=order_index'),
    sbSelect(tenant, 'posts', 'select=title,slug,excerpt,cover_image_url,published_at&status=eq.published&order=published_at.desc&limit=6'),
    sbSelect(tenant, 'books', 'select=title,author,slug,synopsis,cover_image_url,rating,published_at&status=eq.published&order=published_at.desc&limit=6'),
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
    ${tenant.showroom_mode ? `
    <div class="showroom-cta">
      <h2>Gostou do que fez?</h2>
      <a class="btn-cta" href="${escapeHtml(tenant.showroom_cta_url)}" target="_blank" rel="noopener">Clique aqui pra ser seu</a>
    </div>` : ''}
  `;

  const html = renderPage({ settings, title: null, description: settings.tagline, url, bodyHtml });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=120' } });
}

async function renderSingle(tenant, origin, type, slug) {
  const table = type === 'post' ? 'posts' : 'books';
  const url = `${origin}/${type === 'post' ? 'post' : 'livro'}/${slug}`;
  const settings = await getSiteSettings(tenant);
  const item = await sbSingle(tenant, table, `slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=*`);

  if (!item) {
    const bodyHtml = `<div class="article-view"><a class="back-link" href="/">← voltar</a><p>${type === 'post' ? 'Texto' : 'Livro'} não encontrado.</p></div>`;
    const html = renderPage({ settings, title: 'Não encontrado', url, bodyHtml });
    return new Response(html, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  let metaLine, bodyContentHtml;
  if (type === 'post') {
    metaLine = item.published_at ? new Date(item.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    bodyContentHtml = item.content_html || '';
  } else {
    const stars = item.rating ? '★'.repeat(Math.round(item.rating)) + '☆'.repeat(5 - Math.round(item.rating)) : '';
    metaLine = [item.author, stars].filter(Boolean).join(' · ');
    bodyContentHtml = item.review_html || '';
  }

  const bodyHtml = `
    <div class="article-view">
      <a class="back-link" href="/">← voltar</a>
      ${item.cover_image_url ? `<img class="article-cover" src="${escapeHtml(item.cover_image_url)}">` : ''}
      <div class="article-meta">${escapeHtml(metaLine)}</div>
      <h1>${escapeHtml(item.title)}</h1>
      ${item.synopsis && type === 'book' ? `<p class="tagline">${escapeHtml(item.synopsis)}</p>` : ''}
      <div class="article-body">${bodyContentHtml}</div>
    </div>`;

  const html = renderPage({
    settings,
    title: item.meta_title || item.title,
    description: item.meta_description || item.excerpt || item.synopsis,
    image: item.og_image_url || item.cover_image_url,
    url, type: 'article', bodyHtml,
  });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}

async function renderSitemap(tenant, origin) {
  const [posts, books] = await Promise.all([
    sbSelect(tenant, 'posts', 'select=slug,published_at&status=eq.published'),
    sbSelect(tenant, 'books', 'select=slug,published_at&status=eq.published'),
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
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

// ---------- ROTEAMENTO ----------
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname;

    try {
      if (path === '/' ) return await renderHome(env, origin);

      const postMatch = path.match(/^\/post\/([^/]+)\/?$/);
      if (postMatch) return await renderSingle(env, origin, 'post', decodeURIComponent(postMatch[1]));

      const bookMatch = path.match(/^\/livro\/([^/]+)\/?$/);
      if (bookMatch) return await renderSingle(env, origin, 'book', decodeURIComponent(bookMatch[1]));

      if (path === '/sitemap.xml') return await renderSitemap(env, origin);
    } catch (err) {
      return new Response('Erro ao carregar a página: ' + err.message, { status: 500 });
    }

    // qualquer outra rota (dashboard.html, styles.css, robots.txt, imagens locais)
    // cai no fallback de arquivo estático
    return env.ASSETS.fetch(request);
  },
};
