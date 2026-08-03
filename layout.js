export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Monta a tag <link> do Google Fonts a partir das fontes escolhidas em Aparência
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

export function renderHead({ settings, title, description, url, image, type = 'website' }) {
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

export function renderHeader(settings) {
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

export function renderFooter(settings) {
  return `
  <footer>
    <div class="wrap">© ${new Date().getFullYear()} ${escapeHtml(settings.site_name)}</div>
  </footer>`;
}

export function renderPage({ settings, title, description, url, image, type, bodyHtml }) {
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
