import { CommunityService } from "./services/community/communityService.js";
import { LocalCommunityRepository } from "./services/community/localCommunityRepository.js";
import { CommunitySession } from "./services/community/communitySession.js";
import { createConfirmDialog } from "./community/ui/confirmDialog.js";
import { createPostCard } from "./community/ui/postCard.js";
import { createPostComposer } from "./community/ui/postComposer.js";
import { createPostFilters } from "./community/ui/postFilters.js";
import { createToastRegion } from "./community/ui/toast.js";
import { createReportDialog } from "./community/ui/reportDialog.js";

const repository = new LocalCommunityRepository();
const session = new CommunitySession(repository);
const communityService = new CommunityService(repository, session);

const feed = document.getElementById("communityFeed");
const feedCount = document.getElementById("feedCount");
const loadMoreButton = document.getElementById("loadMorePosts");
const feedStatus = document.getElementById("feedStatus");
const createPostButton = document.getElementById("createPostButton");
const notify = createToastRegion();
const confirmDelete = createConfirmDialog();
const reportDialog = createReportDialog({
  service: communityService,
  onReported() { notify("Denúncia registrada neste navegador."); },
  onError(error) { if (error.code !== "validation-error") notify(error.message || "Não foi possível registrar a denúncia.", "error"); }
});
let nextCursor = null;
let requestVersion = 0;
let currentUser = null;
let composer = null;

function renderSkeletons() {
  feed.replaceChildren();
  Array.from({ length: 3 }).forEach(() => {
    const skeleton = document.createElement("div");
    skeleton.className = "post-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    const avatar = document.createElement("span");
    avatar.className = "skeleton-avatar";
    const shortLine = document.createElement("span");
    shortLine.className = "skeleton-line skeleton-line--short";
    const lineOne = document.createElement("span");
    lineOne.className = "skeleton-line";
    const lineTwo = document.createElement("span");
    lineTwo.className = "skeleton-line";
    skeleton.append(avatar, shortLine, lineOne, lineTwo);
    feed.appendChild(skeleton);
  });
  feed.setAttribute("aria-busy", "true");
}

function renderEmptyState(filters) {
  const state = filters.getState();
  const isSaved = state.tab === "saved";
  const isFollowing = state.tab === "following";
  const empty = document.createElement("div");
  empty.className = "community-state";
  const image = document.createElement("img");
  image.src = isSaved ? "assets/vee/states/vee-favorite.webp" : "assets/vee/states/vee-search.webp";
  image.alt = isSaved ? "Vee aguardando publicações salvas" : (isFollowing ? "Vee procurando pessoas seguidas" : "Vee procurando publicações");
  const title = document.createElement("strong");
  title.textContent = isSaved
    ? "Você ainda não salvou nenhuma publicação."
    : (isFollowing ? "Seu feed de Seguindo ainda está vazio." : "Nenhuma publicação encontrada por aqui.");
  const copy = document.createElement("span");
  copy.textContent = isSaved
    ? "Explore o feed e use o botão Salvar para montar sua coleção local."
    : (isFollowing ? "Siga criadores na lateral ou abra um perfil para começar a montar esse feed." : "Experimente voltar para todos os tipos de conteúdo.");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-secondary";
  button.textContent = (isSaved || isFollowing) ? "Explorar publicações" : "Ver todas";
  button.addEventListener("click", () => {
    if (isSaved || isFollowing) filters.setState({ tab: "for-you", type: "all" });
    else filters.setType("all");
  });
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
  container.href = `perfil.html?userId=${encodeURIComponent(user.id)}`;
  container.title = "Abrir meu perfil";
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
  const [games, guides, tags, suggestions] = await Promise.all([
    communityService.listPopularGames(),
    communityService.listPopularGuides(),
    communityService.listPopularTags(),
    communityService.listSuggestedUsers()
  ]);

  const gamesList = document.getElementById("popularGames");
  gamesList.replaceChildren(...games.map((game) => {
    return createSidebarListItem(game.name, `${game.postsCount} publicações`, `comunidade-jogo.html?gameId=${encodeURIComponent(game.id)}`);
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

  const suggestedList = document.getElementById("suggestedUsers");
  suggestedList.replaceChildren(...suggestions.map((user) => {
    const item = document.createElement("li");
    item.className = "people-suggestion";
    const profile = document.createElement("a");
    profile.className = "people-suggestion-profile";
    profile.href = `perfil.html?userId=${encodeURIComponent(user.id)}`;
    const avatar = document.createElement("img");
    avatar.src = /^(https:\/\/|assets\/)/i.test(user.avatar || "") ? user.avatar : "assets/vee/avatars/vee-avatar-default.webp";
    avatar.alt = "";
    avatar.width = 36;
    avatar.height = 36;
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = user.displayName;
    const handle = document.createElement("small");
    handle.textContent = `@${user.handle}`;
    copy.append(name, handle);
    profile.append(avatar, copy);
    const follow = document.createElement("button");
    follow.type = "button";
    follow.className = "btn btn-secondary btn-small";
    follow.textContent = "Seguir";
    follow.addEventListener("click", async () => {
      follow.disabled = true;
      try {
        await communityService.toggleFollow(user.id);
        notify(`Agora você segue ${user.displayName}.`);
        await renderDiscovery();
        if (["following", "for-you"].includes(filters.getState().tab)) await loadPosts({ append: false });
      } catch (error) {
        follow.disabled = false;
        notify(error.message || "Não foi possível seguir este perfil.", "error");
      }
    });
    item.append(profile, follow);
    return item;
  }));
  if (!suggestions.length) {
    const item = document.createElement("li");
    item.className = "discovery-empty";
    item.textContent = "Você já segue todos os criadores disponíveis nesta demonstração.";
    suggestedList.appendChild(item);
  }
}

async function requestPostDeletion(post, trigger) {
  const confirmed = await confirmDelete({
    title: "Excluir esta publicação?",
    description: "Essa ação removerá a publicação da sua comunidade local.",
    trigger
  });
  if (!confirmed) return;

  try {
    await communityService.deletePost(post.id);
    notify("Publicação excluída.");
    await loadPosts({ append: false });
    renderDiscovery().catch(() => {});
  } catch (error) {
    notify(error.message || "Não foi possível excluir a publicação.", "error");
  }
}

function createFeedCard(post) {
  return createPostCard(post, {
    service: communityService,
    currentUser,
    confirmDelete,
    notify,
    onEdit: (editablePost, trigger) => composer.openEdit(editablePost, trigger),
    onDelete: requestPostDeletion,
    onReport(post, trigger) { reportDialog.open({ type: "post", id: post.id }, trigger); },
    onInteraction(type, changedPost, result) {
      renderDiscovery().catch(() => {});
      if (type === "save" && filters.getState().tab === "saved" && !result.saved) {
        loadPosts({ append: false });
      }
    }
  });
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
      result.items.forEach((post) => fragment.appendChild(createFeedCard(post)));
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
  createPostButton.disabled = true;
  try {
    await communityService.initialize();
    currentUser = await communityService.getCurrentUser();
    renderCurrentUser(currentUser);
    if (!composer) {
      composer = createPostComposer({
        service: communityService,
        async onSaved(post, mode) {
          notify(mode === "edit" ? "Publicação atualizada." : "Publicação criada.");
          if (mode === "create") filters.setState({ tab: "recent", type: "all" });
          else await loadPosts({ append: false });
          renderDiscovery().catch(() => {});
        },
        onError(error) {
          if (error.code !== "validation-error") {
            notify(error.message || "Não foi possível salvar a publicação.", "error");
          }
        }
      });
    }
    createPostButton.disabled = false;
    await loadPosts();
    renderDiscovery().catch(() => {});
  } catch (error) {
    renderFeedError(initializeCommunity);
    feedStatus.textContent = "Falha ao carregar publicações";
    createPostButton.disabled = true;
  }
}

createPostButton.addEventListener("click", async () => {
  try {
    await composer?.openCreate(createPostButton);
  } catch (error) {
    notify(error.message || "Não foi possível abrir o composer.", "error");
  }
});

initializeCommunity();
