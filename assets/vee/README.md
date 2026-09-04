# Vee — Assets preparados para a Sprint 6.1

Esta pasta contém somente os assets preparados para a futura implementação das animações do Vee.

## Importante

Nesta preparação **não foi alterada a lógica da RAWG, game.js, home.js, game.css, HTML ou navegação**.
As animações ainda não foram implementadas nesta etapa.

## Estrutura

- `logo/`: logo, cabeça do Vee, favicon e marca G.
- `avatars/`: avatares já prontos para perfil.
- `transition/`: quatro frames de corrida padronizados em 256x256, sprite sheet, salto e idle.
- `states/`: Vee para busca vazia, erro/404, favorito e loading.
- `effects/`: portal e partículas com fundo transparente.
- `manifest.json`: caminhos e metadados para o Codex.

## Regras dos frames

Todos os frames de corrida têm o mesmo canvas (256x256), transparência e alinhamento aproximado dos pés.
O Codex poderá usar os arquivos individuais ou `vee-run-sheet.webp`.

A implementação futura deve ficar preferencialmente em:
- `css/animations.css`
- `js/motion.js`

Não mexer na RAWG nem redesenhar a página de jogo.
