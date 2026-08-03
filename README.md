# Substrato — estrutura do projeto

```
/functions/
  _lib/supabase.js     -> helper de leitura no Supabase via REST
  _lib/layout.js        -> head/header/footer compartilhados (tema, SEO, fontes)
  index.js               -> GET /            (home: landing blocks + listas)
  post/[slug].js          -> GET /post/:slug   (artigo individual)
  livro/[slug].js         -> GET /livro/:slug  (livro individual)
  sitemap.xml.js          -> GET /sitemap.xml  (gerado a partir dos publicados)
/styles.css               -> CSS compartilhado por todas as páginas
/robots.txt                -> aponta pro sitemap
/dashboard.html             -> painel administrativo (client-side, autenticado)
```

## Deploy no Cloudflare Pages

1. Suba essa pasta inteira num repositório (GitHub/GitLab) ou arraste direto no
   dashboard do Cloudflare Pages.
2. Build settings: **framework preset "None"**, sem build command, diretório
   de output é a raiz (`/`).
3. Em **Settings → Environment variables**, adicione (em Production e Preview):
   - `SUPABASE_URL` = URL do projeto Supabase do cliente
   - `SUPABASE_ANON_KEY` = anon key do mesmo projeto
4. `dashboard.html` continua usando as constantes hardcoded no topo do arquivo
   (`SUPABASE_URL` / `SUPABASE_ANON_KEY`) porque ele roda 100% no navegador —
   edite essas duas linhas com os mesmos valores do passo 3.

## Por que ficou assim

- As páginas públicas (`/`, `/post/:slug`, `/livro/:slug`) são renderizadas
  no servidor (Cloudflare Pages Functions), então o HTML que chega no
  navegador e no crawler do Google já vem com título, descrição e imagem de
  compartilhamento certos — nada depende de JavaScript rodar antes do SEO
  funcionar.
- As URLs são limpas (`/post/nome-do-post`), sem extensão de arquivo e sem
  query string, porque o roteamento é por pasta (`functions/post/[slug].js`),
  não por parâmetro.
- O `dashboard.html` continua puramente client-side de propósito: é uma
  ferramenta interna, autenticada, sem necessidade de SEO — não precisa do
  custo extra de rodar no edge.
- `sitemap.xml` é gerado na hora a cada request, direto da tabela de posts e
  livros publicados, então nunca fica desatualizado.

## O antigo `site.html`

O arquivo `site.html` (versão anterior, client-side, com `?post=slug`) fica
obsoleto com essa estrutura. Pode ser descartado.
