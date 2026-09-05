import { CommunityService } from "./services/community/communityService.js";
import { LocalCommunityRepository } from "./services/community/localCommunityRepository.js";
import { CommunitySession } from "./services/community/communitySession.js";
import { normalizeGameId } from "./services/community/communityValidation.js";
import { getGame } from "./services/rawgService.js";
import { createConfirmDialog } from "./community/ui/confirmDialog.js";
import { createPostCard } from "./community/ui/postCard.js";
import { createPostComposer } from "./community/ui/postComposer.js";
import { createPostFilters } from "./community/ui/postFilters.js";
import { createToastRegion } from "./community/ui/toast.js";
import { createReportDialog } from "./community/ui/reportDialog.js";

const SORTS = [
  { value: "trending", label: "Em alta" },
  { value: "recent", label: "Recentes" }
];
const TYPES = [
  { value: "all", label: "Visão geral" },
  { value: "guide", label: "Guias" },
  { value: "art", label: "Artes" },
  { value: "screenshot", label: "Screenshots" },
  { value: "discussion", label: "Discussões" },
  { value: "question", label: "Perguntas" }
];

const gameId = normalizeGameId(new URLSearchParams(location.search).get("gameId"));
const notify = createToastRegion();
const confirmDelete = createConfirmDialog();
const byId = (id) => document.getElementById(id);
const feed = byId("communityFeed");
const feedCount = byId("feedCount");
const feedStatus = byId("feedStatus");
const loadMoreButton = byId("loadMorePosts");
const createPostButton = byId("createPostButton");
let communityService = null;
let composer = null;
let currentUser = null;
let snapshotGame = null;
let rawgGame = null;
let rawgState = "pending";
let stats = null;
let hasLocalPosts = false;
let nextCursor = null;
let feedRequest = 0;
let statsRequest = 0;
let initializationPending = false;
let restoringHistory = false;
let reportDialog = null;

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function countLabel(count) {
  return `${count} ${count === 1 ? "publicação" : "publicações"}`;
}

function locationFilters() {
  const params = new URLSearchParams(location.search);
  return {
    tab: SORTS.some(({ value }) => value === params.get("sort")) ? params.get("sort") : "trending",
    type: TYPES.some(({ value }) => value === params.get("type")) ? params.get("type") : "all"
  };
}

function rememberFilters(state) {
  if (restoringHistory || !gameId) return;
  const url = new URL(location.href);
  url.searchParams.set("gameId", String(gameId));
  if (state.type === "all") url.searchParams.delete("type");
  else url.searchParams.set("type", state.type);
  if (state.tab === "trending") url.searchParams.delete("sort");
  else url.searchParams.set("sort", state.tab);
  if (url.href !== location.href) history.pushState(null, "", url);
}

const filters = createPostFilters({
  tabsContainer: byId("feedTabs"),
  typesContainer: byId("postFilters"),
  tabs: SORTS,
  types: TYPES,
  initialState: locationFilters(),
  onChange(state) {
    rememberFilters(state);
    if (gameId && currentUser) loadPosts();
  }
});

function unknownGame() {
  return rawgState === "not-found" && !snapshotGame && !hasLocalPosts;
}

function updateHeader() {
  const game = rawgGame || snapshotGame;
  const name = game?.name || "Comunidade do jogo";
  byId("hubHeaderSkeleton").hidden = true;
  byId("hubTitle").hidden = false;
  byId("hubTitle").textContent = name;
  byId("hubBreadcrumbName").textContent = name;
  byId("hubHero").removeAttribute("aria-busy");
  document.title = `${game?.name ? `${name} · Comunidade` : name} | GameVerse`;
  byId("hubGameLink").href = `game.html?id=${gameId}`;
  byId("hubGameLink").hidden = !gameId;
  createPostButton.disabled = !composer || !currentUser;
  createPostButton.hidden = unknownGame();
  if (stats) byId("hubPostCount").textContent = countLabel(stats.total);

  const status = byId("hubGameStatus");
  if (rawgState === "pending") status.textContent = "Atualizando informações do jogo…";
  else if (unknownGame()) status.textContent = "Não encontramos esse jogo.";
  else if (rawgState === "error" || rawgState === "not-found") {
    status.textContent = "As informações do jogo estão indisponíveis. Você pode continuar usando a comunidade.";
  } else status.textContent = "";
  byId("retryGameDetails").hidden = !["error", "not-found"].includes(rawgState);
  if (feed.dataset.view === "empty") renderEmptyState();
}

function rememberSnapshot(game) {
  if (normalizeGameId(game?.id) === gameId && typeof game?.name === "string" && game.name.trim()) {
    snapshotGame = { id: gameId, name: game.name.trim(), slug: game.slug || "" };
  }
}

async function enrichHeader() {
  rawgState = "pending";
  byId("retryGameDetails").disabled = true;
  updateHeader();
  try {
    const game = await getGame(gameId);
    if (normalizeGameId(game?.id) !== gameId || !game.name) throw new Error("Identidade do jogo indisponível.");
    rawgGame = game;
    rawgState = "ready";
    const image = byId("hubGameImage");
    if (typeof game.background_image === "string" && /^https:\/\//i.test(game.background_image)) {
      image.addEventListener("error", () => { image.hidden = true; }, { once: true });
      image.src = game.background_image;
      image.hidden = false;
    }
    byId("hubGenres").replaceChildren(...(game.genres || [])
      .filter((genre) => typeof genre?.name === "string")
      .map((genre) => element("span", "topic-chip", genre.name)));
  } catch (error) {
    rawgState = error.status === 404 ? "not-found" : "error";
  } finally {
    byId("retryGameDetails").disabled = false;
    updateHeader();
  }
}

function statePanel(title, copy, { error = false, label = "", action = null, href = "" } = {}) {
  const panel = element("div", `community-state${error ? " community-state--error" : ""}`);
  const image = element("img");
  image.src = `assets/vee/states/vee-${error ? "error" : "search"}.webp`;
  image.alt = "";
  panel.append(image, element("strong", "", title), element("span", "", copy));
  if (label) {
    const control = element(href ? "a" : "button", "btn btn-secondary", label);
    if (href) control.href = href;
    else {
      control.type = "button";
      control.addEventListener("click", () => action?.(control));
    }
    panel.appendChild(control);
  }
  return panel;
}

function renderSkeletons() {
  feed.replaceChildren(...Array.from({ length: 3 }, () => {
    const skeleton = element("div", "post-skeleton");
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.append(element("span", "skeleton-avatar"), element("span", "skeleton-line skeleton-line--short"),
      element("span", "skeleton-line"), element("span", "skeleton-line"));
    return skeleton;
  }));
  feed.dataset.view = "loading";
  feed.setAttribute("aria-busy", "true");
}

function renderEmptyState() {
  feed.dataset.view = "empty";
  if (unknownGame()) {
    feed.replaceChildren(statePanel("Não encontramos esse jogo.", "Confira o endereço ou explore outras comunidades.", {
      error: true, label: "Voltar para Comunidade", href: "comunidade.html"
    }));
    return;
  }
  const filtered = filters.getState().type !== "all";
  feed.replaceChildren(statePanel(filtered ? "Nenhuma publicação deste tipo." : "Nenhuma publicação ainda.",
    filtered ? "Explore os outros tipos de conteúdo deste jogo." : "Compartilhe um guia, uma imagem ou comece uma conversa.", {
      label: filtered ? "Ver visão geral" : "Criar primeira publicação",
      action: filtered ? () => filters.setType("all") : openComposer
    }));
}

function renderFeedError(retry) {
  feed.dataset.view = "error";
  feed.replaceChildren(statePanel("Não conseguimos carregar as publicações.", "Tente carregar novamente a comunidade deste jogo.", {
    error: true, label: "Tentar novamente", action: retry
  }));
  feedCount.textContent = "Indisponível";
  feedStatus.textContent = "Falha ao carregar publicações";
}

function renderCurrentUser(user) {
  const avatar = element("img");
  avatar.src = /^(https:\/\/|assets\/)/i.test(user.avatar || "")
    ? user.avatar : "assets/vee/avatars/vee-avatar-default.webp";
  avatar.alt = "";
  avatar.width = 32;
  avatar.height = 32;
  const userLink = byId("communityUser");
  userLink.replaceChildren(avatar, element("span", "", user.displayName));
  userLink.href = `perfil.html?userId=${encodeURIComponent(user.id)}`;
  userLink.title = "Abrir meu perfil";
}

async function loadStats() {
  if (!communityService) return;
  const request = ++statsRequest;
  byId("retryHubStats").disabled = true;
  try {
    const result = await communityService.getCommunityGameStats(gameId);
    if (request !== statsRequest) return;
    stats = result;
    hasLocalPosts = result.total > 0;
    rememberSnapshot(result.game);
    byId("hubStatsTotal").textContent = countLabel(result.total);
    byId("hubTypeCounts").replaceChildren(...TYPES.filter(({ value }) => value !== "all").map(({ value, label }) => {
      const row = element("div");
      row.append(element("dt", "", label), element("dd", "", String(result.counts[value] || 0)));
      return row;
    }));
    byId("hubTags").replaceChildren(...result.tags.map(({ tag, postsCount }) => {
      const item = element("li");
      const chip = element("span", "topic-chip", `#${tag}`);
      chip.title = countLabel(postsCount);
      item.appendChild(chip);
      return item;
    }));
    byId("hubTagsEmpty").textContent = result.tags.length ? "" : "Os tópicos aparecerão nas publicações.";
    byId("hubTagsEmpty").hidden = result.tags.length > 0;
    byId("hubCreators").replaceChildren(...result.creators.map((user) => {
      const item = element("li");
      const content = element("a");
      content.href = `perfil.html?userId=${encodeURIComponent(user.id)}`;
      content.append(element("strong", "", user.displayName), element("span", "", countLabel(user.postsCount)));
      item.appendChild(content);
      return item;
    }));
    byId("hubCreatorsEmpty").textContent = result.creators.length ? "" : "Seja a primeira pessoa a publicar.";
    byId("hubCreatorsEmpty").hidden = result.creators.length > 0;
    byId("retryHubStats").hidden = true;
    updateHeader();
  } catch {
    if (request !== statsRequest) return;
    byId("retryHubStats").hidden = false;
    if (!stats) {
      byId("hubStatsTotal").textContent = "Contagem indisponível.";
      byId("hubPostCount").textContent = "Contagem indisponível.";
      byId("hubTagsEmpty").textContent = "Tópicos indisponíveis no momento.";
      byId("hubCreatorsEmpty").textContent = "Criadores indisponíveis no momento.";
    }
  } finally {
    if (request === statsRequest) byId("retryHubStats").disabled = false;
  }
}

async function openComposer(trigger) {
  if (!composer) return;
  const game = rawgGame || snapshotGame;
  try {
    await composer.openCreate(trigger, { id: gameId, name: game?.name || "", slug: game?.slug || "" });
  } catch (error) {
    notify(error.message || "Não foi possível abrir o composer.", "error");
  }
}

async function deletePost(post, trigger) {
  if (!await confirmDelete({ title: "Excluir esta publicação?", description: "Essa ação removerá a publicação da sua comunidade local.", trigger })) return;
  try {
    await communityService.deletePost(post.id);
    notify("Publicação excluída.");
    await Promise.all([loadPosts(), loadStats()]);
  } catch (error) {
    notify(error.message || "Não foi possível excluir a publicação.", "error");
  }
}

function feedCard(post) {
  return createPostCard(post, {
    service: communityService, currentUser, confirmDelete, notify,
    async onEdit(editablePost, trigger) {
      try { await composer.openEdit(editablePost, trigger); }
      catch (error) { notify(error.message || "Não foi possível editar a publicação.", "error"); }
    },
    onDelete: deletePost,
    onReport(post, trigger) { reportDialog?.open({ type: "post", id: post.id }, trigger); }
  });
}

async function loadPosts({ append = false } = {}) {
  const request = ++feedRequest;
  feed.setAttribute("aria-busy", "true");
  feed.classList.add("is-updating");
  feedStatus.textContent = "Atualizando publicações";
  loadMoreButton.disabled = true;
  if (append) loadMoreButton.textContent = "Carregando…";
  try {
    const result = await communityService.listPostsByGame(gameId, {
      ...filters.getState(), cursor: append ? nextCursor : null, limit: 6
    });
    if (request !== feedRequest) return;
    nextCursor = result.nextCursor;
    if (result.items.length) {
      hasLocalPosts = true;
      rememberSnapshot(result.items.find((post) => post.game?.name)?.game);
    }
    if (!append) feed.replaceChildren();
    if (!result.items.length && !append) renderEmptyState();
    else {
      feed.dataset.view = "posts";
      feed.append(...result.items.map(feedCard));
    }
    feedCount.textContent = countLabel(result.total);
    loadMoreButton.hidden = !nextCursor;
    feedStatus.textContent = result.items.length ? "Publicações atualizadas" : "Nenhuma publicação encontrada";
    updateHeader();
  } catch {
    if (request !== feedRequest) return;
    if (append) {
      notify("Não foi possível carregar mais publicações. Tente novamente.", "error");
      feedStatus.textContent = "Falha ao carregar mais publicações";
    } else {
      nextCursor = null;
      loadMoreButton.hidden = true;
      renderFeedError(() => loadPosts());
    }
  } finally {
    if (request === feedRequest) {
      feed.classList.remove("is-updating");
      feed.removeAttribute("aria-busy");
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Carregar mais";
    }
  }
}

async function initializeCommunity() {
  if (initializationPending) return;
  initializationPending = true;
  renderSkeletons();
  try {
    if (!communityService) {
      const repository = new LocalCommunityRepository();
      communityService = new CommunityService(repository, new CommunitySession(repository));
    }
    await communityService.initialize();
    currentUser = await communityService.getCurrentUser();
    renderCurrentUser(currentUser);
    reportDialog ||= createReportDialog({
      service: communityService,
      onReported() { notify("Denúncia registrada neste navegador."); },
      onError(error) { if (error.code !== "validation-error") notify(error.message || "Não foi possível registrar a denúncia.", "error"); }
    });
    composer ||= createPostComposer({
      service: communityService,
      async onSaved(post, mode) {
        const inThisHub = normalizeGameId(post.game?.id) === gameId;
        notify(mode === "edit" ? "Publicação atualizada." : "Publicação criada.");
        if (!inThisHub) notify("A publicação foi salva fora desta comunidade. Ela está no feed geral.");
        if (mode === "create") filters.setState({ tab: "recent", type: "all" });
        else await loadPosts();
        await loadStats();
      },
      onError(error) {
        if (error.code !== "validation-error") notify(error.message || "Não foi possível salvar a publicação.", "error");
      }
    });
    // Local data and snapshots render before RAWG is requested. Neither depends on enrichment.
    await Promise.all([loadPosts(), loadStats()]);
  } catch {
    renderFeedError(initializeCommunity);
    byId("hubPostCount").textContent = "Publicações indisponíveis no momento.";
    byId("hubStatsTotal").textContent = "Contagem indisponível.";
    byId("hubTagsEmpty").textContent = "Tópicos indisponíveis no momento.";
    byId("hubCreatorsEmpty").textContent = "Criadores indisponíveis no momento.";
    feed.removeAttribute("aria-busy");
  } finally {
    initializationPending = false;
    updateHeader();
  }
}

createPostButton.addEventListener("click", () => openComposer(createPostButton));
loadMoreButton.addEventListener("click", () => loadPosts({ append: true }));
byId("retryGameDetails").addEventListener("click", enrichHeader);
byId("retryHubStats").addEventListener("click", loadStats);
window.addEventListener("popstate", () => {
  if (normalizeGameId(new URLSearchParams(location.search).get("gameId")) !== gameId) {
    location.reload();
    return;
  }
  restoringHistory = true;
  filters.setState(locationFilters());
  restoringHistory = false;
});

if (!gameId) {
  byId("hubHero").hidden = true;
  byId("hubContent").hidden = true;
  const invalid = byId("hubInvalidState");
  invalid.hidden = false;
  invalid.appendChild(statePanel("Jogo inválido.", "Abra uma comunidade usando um jogo do catálogo.", {
    error: true, label: "Voltar para Comunidade", href: "comunidade.html"
  }));
} else {
  initializeCommunity().then(enrichHeader);
}
