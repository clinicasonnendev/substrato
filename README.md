# Substrato — estrutura do projeto

```
/_worker.js        -> toda a lógica: home, /post/:slug, /livro/:slug,
                       /sitemap.xml, /api/config, e fallback estático
/wrangler.jsonc     -> configuração do Worker (assets, KV, etc)
/.assetsignore        -> impede que arquivos internos (.git, etc) sejam
                          publicados como estáticos
/styles.css            -> CSS compartilhado por todas as páginas
/robots.txt              -> aponta pro sitemap
/dashboard.html            -> painel administrativo (client-side, autenticado)
```

Não existe mais pasta `functions/` (Cloudflare Pages Functions). O projeto
roda como um **Worker único** com arquivos estáticos, porque foi assim que a
tela de criação da Cloudflare gerou o projeto (ver "Por que ficou assim" no
fim deste arquivo).

## Deploy

1. Repositório conectado ao Cloudflare (**Workers & Pages → Create → Connect
   to Git**)
2. Em **Settings → Variables and Secrets**, configure `SUPABASE_URL` e
   `SUPABASE_ANON_KEY` — esses funcionam como o "tenant padrão" (usado no
   domínio `.workers.dev` e em qualquer domínio sem entrada no KV, ver seção
   de multi-cliente abaixo)
3. `dashboard.html` não tem nenhuma credencial fixa: ele busca a configuração
   sozinho, em runtime, na rota `/api/config` do próprio Worker

## Multi-cliente: um Worker só, vários domínios

O mesmo Worker (mesmo deploy, mesmo repositório) atende vários clientes ao
mesmo tempo, cada um com seu próprio Supabase isolado. `dashboard.html`
pergunta pro Worker "qual Supabase eu uso hoje?", baseado no domínio de onde
está sendo acessado — então não precisa editar nada por cliente.

### Configuração inicial (uma vez só)

1. Cloudflare Dashboard → **Storage & databases → KV → Create namespace**
   (nome sugerido: `substrato-tenants`)
2. Copia o **ID** desse namespace
3. Cola esse ID no `wrangler.jsonc`, no lugar de
   `COLE_AQUI_O_ID_DO_NAMESPACE_KV`
4. Commit — o próximo deploy já cria o binding `TENANTS` automaticamente
   (confirma em **Settings → Bindings** depois)

### Onboardando um cliente novo

Sem deploy novo, sem editar código:

1. Cria um projeto Supabase novo pro cliente (roda `schema.sql` e
   `fix-permissions.sql`, configura auth como de costume)
2. No Cloudflare, adiciona o domínio do cliente ao Worker (**Settings →
   Domains & Routes → Add**, ou aponta o DNS dele pra cá)
3. No namespace KV, adiciona uma entrada:
   - **Key**: o domínio exato do cliente (ex: `sitedocliente.com.br`)
   - **Value**: um JSON assim:
     ```json
     {
       "supabase_url": "https://xxxx.supabase.co",
       "supabase_anon_key": "sb_publishable_...",
       "demo_mode": false,
       "showroom_mode": false,
       "showroom_cta_url": ""
     }
     ```
4. Pronto — `dashboard.html` e o site público desse domínio já funcionam,
   puxando desse Supabase específico

## Login com Google (opcional, por cliente)

O dashboard tem um botão "Entrar com Google", além do login por e-mail/senha.
Configura-se **dentro de cada projeto Supabase**, então é por cliente:

1. **Authentication → Providers → Google**, habilita e cola o Client ID e
   Client Secret (criados no
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   como um "OAuth 2.0 Client ID" do tipo "Web application")
2. No Google Cloud Console, em **Authorized redirect URIs**, adiciona a URL
   que o Supabase mostra na mesma tela (algo como
   `https://SEU-PROJETO.supabase.co/auth/v1/callback`)
3. No Supabase, em **Authentication → URL Configuration**, a **Site URL**
   precisa ser o domínio real do site (não `localhost`), e esse mesmo
   domínio precisa estar nas **Redirect URLs**
4. Se algum provider ficar sem configurar, o login por e-mail/senha continua
   funcionando normalmente, o botão do Google só fica sem uso até você
   configurar

## Modo showroom (vitrine de vendas)

O campo `showroom_mode` no JSON de um tenant (ver seção multi-cliente acima)
controla um bloco final na home pública: "Gostou do que fez? Clique aqui pra
ser seu", linkando pro `showroom_cta_url` (WhatsApp, e-mail, ou sua página de
vendas). Serve pra transformar o próprio dashboard num showroom: alguém
testa, monta a aparência e os blocos do jeito que gosta, clica em "Ver site
↗", vê o resultado ao vivo, e no fim da página tem o convite pra fechar
negócio.

**Importante**: em qualquer entrega pra cliente que já comprou,
`showroom_mode` deve ser `false`. O site dele não deve convidar ele a "ser
seu" algo que ele já é dono.

O campo `demo_mode` (mesmo JSON) controla o `dashboard.html` desse domínio:
quando `true`, a tela de login vira só uma fachada (campos preenchidos e
desabilitados, botão "Entrar no showroom", sem autenticação real), aparece
uma faixa dourada no rodapé avisando que é demonstração, e toda escrita usa a
chave anônima (sem sessão de usuário).

Pra `demo_mode: true` funcionar, o projeto Supabase por trás desse tenant
precisa rodar `demo-rls-anon-write.sql`, que libera escrita anônima nas
tabelas. **Nunca rode esse arquivo num projeto de cliente real.**

Na página de vendas (`index.html`, entrega separada, não faz parte deste
repositório), o botão "Testar o showroom ↗" aponta pra `SHOWROOM_URL` —
configure com a URL do domínio que tem `demo_mode: true`.

## Reset automático do showroom

Como qualquer visitante pode escrever no showroom, o conteúdo vai ficando
bagunçado com o tempo. `reset-demo.sql` apaga tudo e devolve um post, um
livro e dois blocos de exemplo (já com opção de imagem), além de resetar as
cores pro padrão.

- Rode manualmente sempre que quiser, direto no SQL Editor
- Ou agende automático: habilite a extensão `pg_cron` em
  **Database → Extensions** e descomente o bloco `cron.schedule` no fim do
  arquivo (por padrão, roda todo dia às 4h da manhã)

Uma limitação a saber: esse reset limpa as tabelas, mas não apaga os arquivos
de imagem já enviados pro bucket do Storage. Eles ficam órfãos, sem custo
alto no curto prazo, mas vale limpar a pasta manualmente em **Storage →
media** de tempos em tempos.

## Posição de imagem nos blocos da landing page

Qualquer bloco com imagem (hero, sobre, ou outro que você criar) tem um
campo de posição no dashboard: **direita**, **esquerda**, **centro** (acima
do texto), ou **atrás** (como fundo, com um degradê escuro por cima pra
manter o texto legível).

## Por que ficou assim

- Esse projeto roda como **Worker com arquivos estáticos**, não como
  "Cloudflare Pages" clássico — foi o que a tela de criação gerou, e em vez
  de forçar o outro modelo, a lógica de rotas foi escrita como um Worker
  único (`_worker.js`) usando o binding `ASSETS` como fallback pros arquivos
  estáticos (`dashboard.html`, `styles.css`, etc)
- `run_worker_first: true` no `wrangler.jsonc` é obrigatório: sem isso, a
  Cloudflare serve arquivos estáticos que combinam com a rota (ex:
  `index.html` na raiz) **antes** de rodar o `_worker.js`, e o site dinâmico
  nunca chega a executar
- As páginas públicas (`/`, `/post/:slug`, `/livro/:slug`) são renderizadas
  no servidor, então o HTML que chega no navegador e no crawler do Google já
  vem com título, descrição e imagem de compartilhamento certos, nada
  depende de JavaScript rodar antes do SEO funcionar
- As URLs são limpas (`/post/nome-do-post`), sem extensão de arquivo e sem
  query string
- `sitemap.xml` é gerado na hora a cada request, direto da tabela de posts e
  livros publicados, então nunca fica desatualizado
- `dashboard.html` roda 100% no navegador (sem SEO pra se preocupar), mas
  busca sua configuração em runtime (`/api/config`) em vez de ter
  credenciais fixas, pra funcionar em qualquer domínio/cliente sem edição

## Arquivos que existem mas não entram no deploy

Esses rodam direto no SQL Editor do Supabase, não fazem parte do site:
`schema.sql`, `fix-permissions.sql`, `seed-landing-blocks.sql`,
`fix-block-types.sql`, `add-image-position-column.sql`,
`demo-rls-anon-write.sql`, `reset-demo.sql`. Já estão listados no
`.assetsignore` pra não serem publicados por engano.
