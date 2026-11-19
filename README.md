# GameVerse

Site de descoberta, avaliação e comunidade de jogos feito em HTML, CSS e JavaScript puro (ES Modules, sem framework). Projeto escolar pensado para rodar localmente.

## Como rodar

1. Crie `js/config.local.js` (já está no `.gitignore`) com as chaves das APIs:

   ```js
   export const LOCAL_CONFIG = {
     RAWG_API_KEY: "sua-chave-rawg",
     YOUTUBE_API_KEY: "sua-chave-youtube"
   };
   ```

2. Sirva a pasta com um servidor HTTP estático (por exemplo, a extensão Live Server do VS Code).
3. Abra o endereço mostrado pelo servidor (ex.: `http://127.0.0.1:5500/`). Não abra por `file://`, porque os ES Modules não carregam assim.

O computador precisa de internet para buscar os jogos na RAWG e os trailers no YouTube.

## O que tem

- **Home** com destaque rotativo (com pausa), atalhos por gênero e plataforma, "Me surpreenda", "Em breve", "Sua coleção" e carrosséis com setas.
- **Categorias** com filtros combinados (estilo, plataforma, época, nota Metacritic), busca, ordenação, contador e filtros salvos no endereço da página.
- **Página de cada jogo** (`game.html?slug=...`): trailer (RAWG, com YouTube como reserva), capturas, lojas, nota, análise e status na coleção.
- **Minha coleção** (`favoritos.html`): favoritos e status *Quero jogar / Jogando / Zerado / Abandonado*, com estatísticas.
- **Comparar jogos** (`comparar.html`): dois jogos lado a lado.
- **Comunidade** com posts, comentários, curtidas, salvos, Game Hubs por jogo e perfis com seguidores.
- **Busca no topo** de todas as páginas (Enter abre todos os resultados no catálogo).

## Acessibilidade

Botão ♿ no canto inferior esquerdo (ou **Alt + A**) em todas as páginas:

- tamanho do texto, fonte legível (Atkinson Hyperlegible) ou para dislexia (OpenDyslexic), cores suaves ou em cinza;
- alto contraste, reduzir animações, espaçamento maior, destacar links e foco;
- as escolhas ficam salvas no navegador (`js/a11y-boot.js` aplica antes da página aparecer).

Também: link "Pular para o conteúdo", cards navegáveis por teclado (Tab + Enter), contorno de foco visível, carrossel com pausa e nomes acessíveis nos controles. As fontes ficam em `assets/fonts/` (licença SIL OFL).

## Modo apresentação (sem depender da RAWG)

Antes de apresentar, com internet, abra **`modo-apresentacao.html`** pelo Live Server (Chrome ou Edge), clique em **Gerar cópia** e escolha a pasta do projeto. Quem tiver Node também pode rodar `node tools/modo-apresentacao.mjs`.

Isso salva uma cópia dos dados em `data/offline/rawg-snapshot.json` e as imagens dos jogos principais em `assets/offline/`. Se a RAWG cair (ou faltar internet, ou a chave), o site usa essa cópia automaticamente e mostra um aviso "📦 Modo apresentação". Os filtros e a busca do catálogo funcionam sobre os jogos salvos. Trailers e capturas de tela continuam vindo da internet.

Essas duas pastas ficam fora do Git (`.gitignore`): gere a cópia de novo em cada computador.

Para testar com a internet ligada, use o botão **"Testar como se a RAWG estivesse fora"** na mesma página, ou no console do navegador (F12):

```js
localStorage.setItem('gameverse:forcar-offline', '1')  // liga
localStorage.removeItem('gameverse:forcar-offline')    // desliga
```

Todos os dados pessoais e da comunidade ficam no `localStorage` do navegador, com o usuário local `user-veemaster`. Não há servidor nem banco de dados.

## Testes

```powershell
node --test tests\*.test.mjs
```

A pasta `supabase/` guarda o estudo de banco de dados (schema, RLS e testes) feito na Sprint 9.0B. Ela não é usada pelo site.
