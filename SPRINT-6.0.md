# Sprint 6.0 — Identidade e movimento

Implementação isolada para preservar a página de jogo e a integração RAWG aprovadas.

## Assets
- `assets/brand/gameverse-mark.svg`: símbolo/favIcon GameVerse.
- `assets/brand/logo-lockup.webp`: lockup conceitual com Vee.
- `assets/brand/vee-run-sprite.webp`: sequência usada na transição.
- `assets/brand/vee-avatar-*.webp`: pacote inicial de avatares.
- `assets/brand/vee-search.webp`, `vee-404.webp`, `vee-hero.webp`: estados futuros.

## Movimento
- `js/motion.js`: intercepta navegação interna e executa a transição Vee → portal.
- `css/animations.css`: portal, partículas, corrida e microinterações.
- Respeita `prefers-reduced-motion`.

## Importante
A animação acontece na troca de páginas, não durante cada chamada da RAWG. O layout de `game.html` e a lógica do serviço RAWG não foram reestruturados.
