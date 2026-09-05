import { CommunityService } from "./services/community/communityService.js";
import { LocalCommunityRepository } from "./services/community/localCommunityRepository.js";
import { CommunitySession } from "./services/community/communitySession.js";
import { createPostCard } from "./community/ui/postCard.js";
import { createPostFilters } from "./community/ui/postFilters.js";

const repository = new LocalCommunityRepository();
const session = new CommunitySession(repository);
const communityService = new CommunityService(repository, session);

const feed = document.getElementById("communityFeed");
const feedCount = document.getElementById("feedCount");
const loadMoreButton = document.getElementById("loadMorePosts");
const feedStatus = document.getElementById("feedStatus");
let nextCursor = null;
let requestVersion = 0;

function renderSkeletons() {
  feed.replaceChildren();
  Array.from({ length: 3 }).forEach(() => {
    const skeleton = document.createElement("div");
    skeleton.className = "post-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    skeleton.innerHTML = '<span class="skeleton-avatar"></span><span class="skeleton-line skeleton-line--short"></span><span class="skeleton-line"></span><span class="skeleton-line"></span>';
    feed.appendChild(skeleton);
  });
  feed.setAttribute("aria-busy", "true");
}

function renderEmptyState(filters) {
  const empty = document.createElement("div");
  empty.className = "community-state";
  const image = document.createElement("img");
  image.src = "assets/vee/states/vee-search.webp";
  image.alt = "Vee procurando publicações";
  const title = document.createElement("strong");
  title.textContent = "Nenhuma publicação encontrada por aqui.";
  const copy = document.createElement("span");
  copy.textContent = "Experimente voltar para todos os tipos de conteúdo.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-secondary";
  button.textContent = "Ver todas";
  button.addEventListener("click", () => filters.setType("all"));
  empty.append(image, title, copy, button);
  feed.replaceChildren(empty);
}

function renderFeedError(retry) {
  const error = document.createElement("div");
  error.className = "community-state community-state--error";
  const image = document.createElement("img");
  image.src = "assets/vee/states/vee-error.webp";
  image.alt = "Vee avisando sobre um erro";
  const title = document.createElement("strong");
  title.textContent = "Não conseguimos carregar a comunidade.";
  const copy = document.createElement("span");
  copy.textContent = "Seus outros recursos do GameVerse continuam disponíveis.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-secondary";
  button.textContent = "Tentar novamente";
  button.addEventListener("click", retry);
  error.append(image, title, copy, button);
  feed.replaceChildren(error);
}

function renderCurrentUser(user) {
  const container = document.getElementById("communityUser");
  if (!container || !user) return;
  const avatar = document.createElement("img");
  avatar.src = /^(https:\/\/|assets\/)/i.test(user.avatar || "")
    ? user.avatar
    : "assets/vee/avatars/vee-avatar-default.webp";
  avatar.alt = "";
  avatar.width = 32;
  avatar.height = 32;
  const name = document.createElement("span");
  name.textContent = user.displayName;
  container.replaceChildren(avatar, name);
  container.title = "Perfil completo chegando em breve";
}

function createSidebarListItem(primaryText, secondaryText, href = "") {
  const item = document.createElement("li");
  const content = href ? document.createElement("a") : document.createElement("div");
  if (href) content.href = href;
  const primary = document.createElement("strong");
  primary.textContent = primaryText;
  const secondary = document.createElement("span");
  secondary.textContent = secondaryText;
  content.append(primary, secondary);
  item.appendChild(content);
  return item;
}

async function renderDiscovery() {
  const [games, guides, tags] = await Promise.all([
    communityService.listPopularGames(),
    communityService.listPopularGuides(),
    communityService.listPopularTags()
  ]);

  const gamesList = document.getElementById("popularGames");
  gamesList.replaceChildren(...games.map((game) => {
    const identifier = game.slug ? `slug=${encodeURIComponent(game.slug)}` : `id=${game.id}`;
    return createSidebarListItem(game.name, `${game.postsCount} publicações`, `game.html?${identifier}`);
  }));

  const guidesList = document.getElementById("popularGuides");
  guidesList.replaceChildren(...guides.map((post) => (
    createSidebarListItem(post.title, `${post.game?.name || "GameVerse"} · ${post.savesCount} salvos`)
  )));

  const tagsList = document.getElementById("popularTags");
  tagsList.replaceChildren(...tags.map(({ tag, postsCount }) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.className = "topic-chip";
    label.textContent = `#${tag}`;
    label.title = `${postsCount} publicações`;
    item.appendChild(label);
    return item;
  }));
}

const filters = createPostFilters({
  tabsContainer: document.getElementById("feedTabs"),
  typesContainer: document.getElementById("postFilters"),
  onChange: () => loadPosts({ append: false })
});

async function loadPosts({ append = false } = {}) {
  const currentRequest = ++requestVersion;
  const activeFilters = filters.getState();
  const cursor = append ? nextCursor : null;

  if (!append) {
    feed.classList.add("is-updating");
    feedStatus.textContent = "Atualizando publicações";
  } else {
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Carregando…";
  }

  try {
    const result = await communityService.listPosts({ ...activeFilters, cursor, limit: 6 });
    if (currentRequest !== requestVersion) return;

    nextCursor = result.nextCursor;
    if (!append) feed.replaceChildren();

    if (!result.items.length && !append) {
      renderEmptyState(filters);
    } else {
      const fragment = document.createDocumentFragment();
      result.items.forEach((post) => fragment.appendChild(createPostCard(post)));
      feed.appendChild(fragment);
    }

    feedCount.textContent = `${result.total} ${result.total === 1 ? "publicação" : "publicações"}`;
    loadMoreButton.hidden = !nextCursor;
    feedStatus.textContent = result.items.length ? "Publicações atualizadas" : "Nenhuma publicação encontrada";
  } catch (error) {
    if (currentRequest !== requestVersion) return;
    nextCursor = null;
    loadMoreButton.hidden = true;
    renderFeedError(() => loadPosts({ append: false }));
    feedStatus.textContent = "Falha ao carregar publicações";
  } finally {
    if (currentRequest === requestVersion) {
      feed.classList.remove("is-updating");
      feed.removeAttribute("aria-busy");
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Carregar mais";
    }
  }
}

loadMoreButton.addEventListener("click", () => loadPosts({ append: true }));

async function initializeCommunity() {
  renderSkeletons();
  try {
    await communityService.initialize();
    const currentUser = await communityService.getCurrentUser();
    renderCurrentUser(currentUser);
    await Promise.all([loadPosts(), renderDiscovery()]);
  } catch (error) {
    renderFeedError(initializeCommunity);
    feedStatus.textContent = "Falha ao carregar publicações";
  }
}

initializeCommunity();
