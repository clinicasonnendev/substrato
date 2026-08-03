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
   edite essas duas linhas com os mesmos valores do passo 3. Edite também
   `PUBLIC_SITE_URL` pra apontar pro endereço real do site publicado (é o que
   o botão "Ver site ↗" no menu lateral abre).

## Modo showroom (vitrine de vendas)

Em `functions/_lib/supabase.js` existe uma flag `SHOWROOM_MODE`. Quando
`true`, a home do site público ganha um bloco final "Gostou do que fez?
Clique aqui pra ser seu", linkando pra `SHOWROOM_CTA_URL` (WhatsApp, e-mail,
ou sua página de vendas). Serve pra transformar o próprio dashboard num
showroom: alguém testa, monta a aparência e os blocos do jeito que gosta,
clica em "Ver site ↗", vê o resultado ao vivo, e no fim da página tem o
convite pra fechar negócio.

**Importante**: em qualquer entrega pra cliente que já comprou, mude
`SHOWROOM_MODE` pra `false`. O site dele não deve convidar ele a "ser seu"
algo que ele já é dono.

## Showroom: testar sem login

Além do CTA na home, o `dashboard.html` tem sua própria flag, `DEMO_MODE`
(perto do topo do `<script>`). Quando `true`:

- a tela de login vira só uma fachada: os campos já vêm preenchidos e
  desabilitados, o botão diz "Entrar no showroom", e clicar nele não faz
  nenhuma autenticação de verdade, só libera o painel
- aparece uma faixa dourada fixa no rodapé avisando que é modo demonstração
- toda escrita (posts, livros, aparência, blocos) passa a usar a chave
  anônima, porque não existe sessão de usuário nenhuma

Pra isso funcionar, o projeto Supabase por trás dessa instância precisa
rodar `demo-rls-anon-write.sql`, que libera escrita anônima nas tabelas.
**Nunca rode esse arquivo num projeto de cliente real** — ele remove
completamente a proteção de login nas escritas.

Na página de vendas (`index.html`, entrega separada), o botão "Testar o
showroom ↗" no hero aponta pra `SHOWROOM_URL` — troque pela URL real do seu
`dashboard.html?` publicado com `DEMO_MODE = true`.

## Reset automático do showroom

Como qualquer visitante pode escrever no showroom, o conteúdo vai ficando
bagunçado com o tempo. `reset-demo.sql` apaga tudo e devolve um post, um
livro e dois blocos de exemplo, além de resetar as cores pro padrão.

- Rode manualmente sempre que quiser, direto no SQL Editor
- Ou agende automático: habilite a extensão `pg_cron` em
  **Database → Extensions** e descomente o bloco `cron.schedule` no fim do
  arquivo (por padrão, roda todo dia às 4h da manhã)

Uma limitação a saber: esse reset limpa as tabelas (o que aparece no
dashboard), mas não apaga os arquivos de imagem já enviados pro bucket do
Storage. Eles ficam órfãos, sem custo alto no curto prazo, mas vale limpar
a pasta manualmente em **Storage → media** de tempos em tempos.

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
