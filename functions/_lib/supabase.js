// Cliente mínimo pra falar com o Supabase via REST dentro de Cloudflare Pages Functions.
// Não usamos o SDK @supabase/supabase-js aqui de propósito: no edge, um fetch direto
// é mais leve e mais rápido de gelar (cold start) do que carregar o SDK inteiro.

function headers(env) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
  };
}

export async function sbSelect(env, table, query) {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, { headers: headers(env) });
  if (!res.ok) return [];
  return res.json();
}

export async function sbSingle(env, table, query) {
  const rows = await sbSelect(env, table, query);
  return rows[0] || null;
}

export async function getSiteSettings(env) {
  const data = await sbSingle(env, 'site_settings', 'id=eq.1&select=*');
  // valores de segurança caso a linha ainda não exista
  return data || {
    site_name: 'Meu Site',
    tagline: '',
    color_bg: '#14161A',
    color_panel: '#1C1F26',
    color_accent: '#C9A24B',
    color_accent_secondary: '#4E7C7C',
    color_text: '#EDE9E0',
    color_text_dim: '#9199A8',
    font_display: 'Newsreader',
    font_body: 'Inter',
    radius: '10px',
  };
}

// ============================================================
// MODO SHOWROOM
// Deixe true só no seu ambiente de demonstração/vitrine, onde
// quem estiver testando o dashboard vê um convite pra virar
// cliente ao final da home. Em qualquer entrega pra cliente
// real, mude pra false (o site dele não deve convidar ele a
// "comprar" o que ele já comprou).
// ============================================================
export const SHOWROOM_MODE = true;
export const SHOWROOM_CTA_URL = 'https://wa.me/5500000000000'; // troque pelo link de venda/contato real
