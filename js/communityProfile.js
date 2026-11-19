import { CommunityService } from "./services/community/communityService.js";
import { LocalCommunityRepository } from "./services/community/localCommunityRepository.js";
import { CommunitySession } from "./services/community/communitySession.js";
import { createConfirmDialog } from "./community/ui/confirmDialog.js";
import { createPostCard } from "./community/ui/postCard.js";
import { createPostComposer } from "./community/ui/postComposer.js";
import { createProfileEditor } from "./community/ui/profileEditor.js";
import { createReportDialog } from "./community/ui/reportDialog.js";
import { createToastRegion } from "./community/ui/toast.js";
import { formatRelativeTime } from "./community/ui/postCard.js";
import { POST_TYPE_LABELS, POST_TYPE_PLURALS } from "./services/community/postTypes.js";
import { getPlayerStats } from "./services/playerStats.js";
import { computeAchievements } from "./services/achievements.js";
import { statusInfo } from "./services/collectionStorage.js";
import { genreLabel } from "./utils.js";

const TYPE_LABELS = POST_TYPE_PLURALS;
const BASE_TABS = [["posts", "Publicações"], ...Object.entries(POST_TYPE_PLURALS)];

const repository = new LocalCommunityRepository();
const communityService = new CommunityService(repository, new CommunitySession(repository));
const notify = createToastRegion();
const confirmDelete = createConfirmDialog();
const feed = document.getElementById("profileFeed");
const feedCount = document.getElementById("profileFeedCount");
const feedStatus = document.getElementById("profileFeedStatus");
const loadMoreButton = document.getElementById("profileLoadMore");
const tabsContainer = document.getElementById("profileTabs");

let currentUser = null;
let profile = null;
let targetUserId = null;
let activeTab = "posts";
let nextCursor = null;
let requestVersion = 0;
let composer = null;
let profileEditor = null;
let reportDialog = null;

function safeAvatar(value) {
  return /^(https:\/\/|assets\/)/i.test(String(value || "")) ? value : "assets/vee/avatars/vee-avatar-default.webp";
}

function countLabel(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function renderTopbarUser(user) {
  const link = document.getElementById("communityUser");
  const image = document.createElement("img");
  image.src = safeAvatar(user.avatar);
  image.alt = "";
  image.width = 32;
  image.height = 32;
  const name = document.createElement("span");
  name.textContent = user.displayName;
  link.replaceChildren(image, name);
  link.href = `perfil.html?userId=${encodeURIComponent(user.id)}`;
}

function renderSkeletons() {
  feed.replaceChildren(...Array.from({ length: 3 }, () => {
    const skeleton = document.createElement("div");
    skeleton.className = "post-skeleton";
    skeleton.setAttribute("aria-hidden", "true");
    ["skeleton-avatar", "skeleton-line skeleton-line--short", "skeleton-line", "skeleton-line"].forEach((className) => {
      const span = document.createElement("span");
      span.className = className;
      skeleton.appendChild(span);
    });
    return skeleton;
  }));
  feed.setAttribute("aria-busy", "true");
}

function renderInvalidProfile() {
  document.getElementById("profileShowcase").hidden = true;
  document.getElementById("profileAchievements").hidden = true;
  document.getElementById("profileHero").hidden = true;
  document.getElementById("profileContent").hidden = true;
  document.getElementById("profileInvalid").hidden = false;
  document.title = "Perfil não encontrado | GameVerse";
}

function renderPersonList(id, emptyId, users, emptyText) {
  const list = document.getElementById(id);
  list.replaceChildren(...users.map((user) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "profile-person-link";
    link.href = `perfil.html?userId=${encodeURIComponent(user.id)}`;
    const avatar = document.createElement("img");
    avatar.src = safeAvatar(user.avatar);
    avatar.alt = "";
    avatar.width = 38;
    avatar.height = 38;
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = user.displayName;
    const handle = document.createElement("small");
    handle.textContent = `@${user.handle}`;
    copy.append(name, handle);
    link.append(avatar, copy);
    item.appendChild(link);
    return item;
  }));
  const empty = document.getElementById(emptyId);
  empty.textContent = users.length ? "" : emptyText;
  empty.hidden = users.length > 0;
}

async function renderSocialLists() {
  const [followers, following] = await Promise.all([
    communityService.listFollowers(targetUserId),
    communityService.listFollowing(targetUserId)
  ]);
  renderPersonList("profileFollowers", "profileFollowersEmpty", followers, "Ainda não há seguidores.");
  renderPersonList("profileFollowing", "profileFollowingEmpty", following, "Este perfil ainda não segue ninguém.");
}

function renderProfileHeader() {
  const avatar = document.getElementById("profileAvatar");
  const avatarSkeleton = document.getElementById("profileAvatarSkeleton");
  const fallbackAvatar = "assets/vee/avatars/vee-avatar-default.webp";
  const requestedAvatar = safeAvatar(profile.avatar);

  const showAvatar = () => {
    avatar.hidden = false;
    avatarSkeleton.hidden = true;
  };

  avatar.alt = `Avatar de ${profile.displayName}`;
  avatar.hidden = true;
  avatarSkeleton.hidden = false;
  avatar.onerror = () => {
    if (avatar.src.endsWith(fallbackAvatar)) {
      avatar.hidden = true;
      avatarSkeleton.hidden = false;
      return;
    }
    avatar.src = fallbackAvatar;
  };
  avatar.onload = showAvatar;
  avatar.src = requestedAvatar;
  if (avatar.complete && avatar.naturalWidth > 0) showAvatar();

  document.getElementById("profileHeadingSkeleton").hidden = true;
  const name = document.getElementById("profileName");
  name.textContent = profile.displayName;
  name.hidden = false;
  document.getElementById("profileHandle").textContent = `@${profile.handle}`;
  document.getElementById("profileBio").textContent = profile.bio || "Este perfil ainda não escreveu uma bio.";
  document.getElementById("profileBreadcrumb").textContent = profile.displayName;
  document.getElementById("profilePostsCount").textContent = String(profile.postsCount);
  document.getElementById("profileFollowersCount").textContent = String(profile.followersCount);
  document.getElementById("profileFollowingCount").textContent = String(profile.followingCount);
  document.getElementById("profileStats").hidden = false;
  document.getElementById("profileActions").hidden = false;
  document.getElementById("profileHero").removeAttribute("aria-busy");
  document.title = `${profile.displayName} (@${profile.handle}) | GameVerse`;

  const breakdown = document.getElementById("profileBreakdown");
  breakdown.replaceChildren(...Object.entries(TYPE_LABELS).map(([type, label]) => {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = String(profile.counts[type] || 0);
    row.append(dt, dd);
    return row;
  }));

  const follow = document.getElementById("followProfileButton");
  const edit = document.getElementById("editProfileButton");
  const create = document.getElementById("createProfilePostButton");
  const report = document.getElementById("reportProfileButton");
  follow.hidden = profile.isCurrentUser;
  edit.hidden = !profile.isCurrentUser;
  create.hidden = !profile.isCurrentUser;
  report.hidden = profile.isCurrentUser;
  follow.textContent = profile.followedByCurrentUser ? "Seguindo" : "Seguir";
  follow.classList.toggle("is-following", profile.followedByCurrentUser);
  follow.setAttribute("aria-pressed", String(profile.followedByCurrentUser));
}

function renderTabs() {
  const tabs = [...BASE_TABS];
  if (profile.isCurrentUser) tabs.push(["liked", "Curtidas"], ["saved", "Salvos"]);
  tabsContainer.replaceChildren(...tabs.map(([value, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "profile-tab";
    button.dataset.value = value;
    button.textContent = label;
    const active = activeTab === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.addEventListener("click", () => {
      if (activeTab === value) return;
      activeTab = value;
      renderTabs();
      loadPosts();
    });
    return button;
  }));
}

function renderEmptyState() {
  const state = document.createElement("div");
  state.className = "community-state";
  const image = document.createElement("img");
  image.src = activeTab === "saved" ? "assets/vee/states/vee-favorite.webp" : "assets/vee/states/vee-search.webp";
  image.alt = "Vee procurando conteúdo no perfil";
  const title = document.createElement("strong");
  title.textContent = activeTab === "saved" ? "Você ainda não salvou nenhuma publicação." : "Nenhum conteúdo nesta seção ainda.";
  const copy = document.createElement("span");
  copy.textContent = profile.isCurrentUser ? "Quando você interagir ou publicar, o conteúdo aparecerá por aqui." : "Explore outras seções deste perfil ou volte para a comunidade.";
  state.append(image, title, copy);
  feed.replaceChildren(state);
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
    await reloadProfile();
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
    onEdit(editablePost, trigger) { composer?.openEdit(editablePost, trigger); },
    onDelete: requestPostDeletion,
    onReport(postToReport, trigger) { reportDialog?.open({ type: "post", id: postToReport.id }, trigger); },
    onInteraction(type, changedPost, result) {
      if (activeTab === "saved" && type === "save" && !result.saved) loadPosts();
      if (activeTab === "liked" && type === "like" && !result.liked) loadPosts();
    }
  });
}

async function fetchPage(cursor) {
  if (activeTab === "liked" && profile.isCurrentUser) return communityService.listCurrentUserLikedPosts({ cursor, limit: 6 });
  if (activeTab === "saved" && profile.isCurrentUser) return communityService.listSavedPosts({ cursor, limit: 6 });
  const type = TYPE_LABELS[activeTab] ? activeTab : "all";
  return communityService.listUserPosts(targetUserId, { type, cursor, limit: 6, tab: "recent" });
}

async function loadPosts({ append = false } = {}) {
  const request = ++requestVersion;
  if (!append) {
    feed.classList.add("is-updating");
    feedStatus.textContent = "Atualizando perfil";
  } else {
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Carregando…";
  }
  try {
    const result = await fetchPage(append ? nextCursor : null);
    if (request !== requestVersion) return;
    nextCursor = result.nextCursor;
    if (!append) feed.replaceChildren();
    if (!result.items.length && !append) renderEmptyState();
    else feed.append(...result.items.map(createFeedCard));
    feedCount.textContent = countLabel(result.total, "publicação", "publicações");
    loadMoreButton.hidden = !nextCursor;
    feedStatus.textContent = result.items.length ? "Conteúdo atualizado" : "Nenhum conteúdo encontrado";
  } catch (error) {
    if (request !== requestVersion) return;
    const state = document.createElement("div");
    state.className = "community-state community-state--error";
    const title = document.createElement("strong");
    title.textContent = "Não foi possível carregar este perfil.";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-secondary";
    retry.textContent = "Tentar novamente";
    retry.addEventListener("click", () => loadPosts());
    state.append(title, retry);
    feed.replaceChildren(state);
    feedCount.textContent = "Indisponível";
  } finally {
    if (request === requestVersion) {
      feed.classList.remove("is-updating");
      feed.removeAttribute("aria-busy");
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Carregar mais";
    }
  }
}

// ---------- Vitrine, conquistas e atividade ----------
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function gameTile(game, badge) {
  const link = el("a", "showcase-game");
  link.href = game.slug ? `game.html?slug=${encodeURIComponent(game.slug)}` : `game.html?id=${encodeURIComponent(game.id)}`;
  const image = document.createElement("img");
  image.src = /^(https:\/\/|assets\/)/i.test(game.image || "") ? game.image : "assets/brand/vee-hero.webp";
  image.alt = "";
  image.loading = "lazy";
  const copy = el("span", "showcase-game-copy");
  copy.append(el("strong", "", game.name));
  if (badge) copy.append(el("small", "", badge));
  link.append(image, copy);
  return link;
}

function showcaseColumn(title, items, emptyText) {
  const column = el("div", "showcase-column");
  column.append(el("h3", "", title));
  if (items.length) {
    const list = el("div", "showcase-games");
    list.append(...items);
    column.append(list);
  } else {
    column.append(el("p", "showcase-empty", emptyText));
  }
  return column;
}

function renderShowcase(player, community) {
  const section = document.getElementById("profileShowcase");
  section.replaceChildren();
  const heading = el("div", "profile-section-heading");
  const titleBox = el("div");
  titleBox.append(el("span", "eyebrow", profile.isCurrentUser ? "Sua coleção" : "Jogos em destaque"));
  const title = el("h2", "", profile.isCurrentUser ? "Vitrine do jogador" : `Do que ${profile.displayName} mais fala`);
  title.id = "profileShowcaseTitle";
  titleBox.append(title);
  heading.append(titleBox);

  if (profile.isCurrentUser && player) {
    const link = el("a", "btn btn-secondary", "Ver coleção completa");
    link.href = "favoritos.html";
    heading.append(link);
    section.append(heading);

    const numbers = el("dl", "showcase-numbers");
    [
      ["Na coleção", player.total],
      ["Zerados", player.completed],
      ["Jogando", player.playing],
      ["Nota média", player.ratingsCount ? `${player.averageRating.toFixed(1)} ★` : "—"],
      ["Gênero favorito", player.topGenre ? genreLabel(player.topGenre) : "—"]
    ].forEach(([label, value]) => {
      const item = el("div");
      item.append(el("dt", "", label), el("dd", "", String(value)));
      numbers.append(item);
    });

    const columns = el("div", "showcase-columns");
    columns.append(
      showcaseColumn("🎮 Jogando agora", player.nowPlaying.map((game) => gameTile(game, "Jogando")), "Nada marcado como “Jogando”. Marque na página de um jogo."),
      showcaseColumn("⭐ Favoritos em destaque", player.favorites.map((game) => gameTile(game, "Favorito")), "Favorite jogos para montar sua vitrine.")
    );
    section.append(numbers, columns);
  } else {
    section.append(heading);
    const games = community.topGames.map((game) => {
      const link = el("a", "showcase-chip");
      link.href = `comunidade-jogo.html?gameId=${encodeURIComponent(game.id)}`;
      link.append(el("strong", "", game.name), el("small", "", `${game.posts} ${game.posts === 1 ? "publicação" : "publicações"}`));
      return link;
    });
    if (games.length) {
      const list = el("div", "showcase-chips");
      list.append(...games);
      section.append(list);
    } else {
      section.append(el("p", "showcase-empty", "Este perfil ainda não publicou sobre nenhum jogo."));
    }
  }
  section.hidden = false;
}

function renderAchievements(player, community) {
  const achievements = computeAchievements({ community, player: profile.isCurrentUser ? player : null });
  const unlocked = achievements.filter((item) => item.unlocked).length;
  document.getElementById("achievementsCount").textContent = `${unlocked} de ${achievements.length} desbloqueadas`;
  document.getElementById("achievementsList").replaceChildren(...achievements.map((achievement) => {
    const item = el("li", `achievement ${achievement.unlocked ? "is-unlocked" : "is-locked"}`);
    const image = document.createElement("img");
    image.src = achievement.icon;
    image.alt = "";
    const copy = el("div", "achievement-copy");
    copy.append(el("strong", "", achievement.title), el("span", "", achievement.description));
    const bar = el("div", "achievement-progress");
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", String(achievement.goal));
    bar.setAttribute("aria-valuenow", String(achievement.progress));
    bar.setAttribute("aria-label", `Progresso de ${achievement.title}`);
    const fill = el("span");
    fill.style.width = `${(achievement.progress / achievement.goal) * 100}%`;
    bar.append(fill);
    copy.append(bar, el("small", "achievement-status", achievement.unlocked ? "✓ Desbloqueada" : `${achievement.progress}/${achievement.goal}`));
    item.append(image, copy);
    return item;
  }));
  document.getElementById("profileAchievements").hidden = false;
}

const COLLECTION_VERBS = { want: "Quer jogar", playing: "Começou a jogar", completed: "Zerou", dropped: "Abandonou" };

function renderActivity(events, player) {
  const items = events.map((event) => {
    if (event.kind === "review") {
      return { at: event.createdAt, icon: "⭐", text: `Analisou ${event.gameName || "um jogo"}${event.rating ? ` · ${"★".repeat(event.rating)}` : ""}` };
    }
    if (event.kind === "comment") return { at: event.createdAt, icon: "💬", text: `Comentou em “${event.title}”` };
    return { at: event.createdAt, icon: "📝", text: `Publicou ${(POST_TYPE_LABELS[event.postType] || "post").toLowerCase()}: “${event.title}”` };
  });
  if (profile.isCurrentUser && player) {
    player.collectionEvents.forEach((entry) => {
      const info = statusInfo(entry.status);
      if (info) items.push({ at: entry.updatedAt, icon: info.icon, text: `${COLLECTION_VERBS[entry.status]} ${entry.name}` });
    });
  }
  items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const list = document.getElementById("profileActivity");
  if (!items.length) {
    list.replaceChildren(el("li", "activity-empty", "Nenhuma atividade ainda."));
    return;
  }
  list.replaceChildren(...items.slice(0, 8).map((item) => {
    const li = el("li", "activity-item");
    li.append(el("span", "activity-icon", item.icon));
    const copy = el("span", "activity-copy");
    const time = el("time", "", formatRelativeTime(item.at));
    time.dateTime = item.at;
    copy.append(el("span", "", item.text), time);
    li.append(copy);
    return li;
  }));
}

async function renderProfileExtras() {
  const [community, events] = await Promise.all([
    communityService.getUserCommunityStats(targetUserId),
    communityService.getUserActivity(targetUserId, 10)
  ]);
  const player = profile.isCurrentUser ? getPlayerStats() : null;
  renderShowcase(player, community);
  renderAchievements(player, community);
  renderActivity(events, player);
}

async function reloadProfile({ keepFeed = false } = {}) {
  profile = await communityService.getUserProfile(targetUserId);
  if (!profile) return renderInvalidProfile();
  renderProfileHeader();
  renderTabs();
  await Promise.all([renderSocialLists(), renderProfileExtras(), keepFeed ? Promise.resolve() : loadPosts()]);
}

loadMoreButton.addEventListener("click", () => loadPosts({ append: true }));
document.getElementById("followProfileButton").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await communityService.toggleFollow(targetUserId);
    notify(result.followed ? `Agora você segue ${profile.displayName}.` : `Você deixou de seguir ${profile.displayName}.`);
    await reloadProfile({ keepFeed: true });
  } catch (error) {
    notify(error.message || "Não foi possível atualizar o follow.", "error");
  } finally { button.disabled = false; }
});
document.getElementById("editProfileButton").addEventListener("click", (event) => profileEditor?.open(profile, event.currentTarget));
document.getElementById("createProfilePostButton").addEventListener("click", (event) => composer?.openCreate(event.currentTarget));
document.getElementById("reportProfileButton").addEventListener("click", (event) => reportDialog?.open({ type: "user", id: targetUserId }, event.currentTarget));

async function initialize() {
  renderSkeletons();
  try {
    await communityService.initialize();
    currentUser = await communityService.getCurrentUser();
    renderTopbarUser(currentUser);
    targetUserId = new URLSearchParams(location.search).get("userId") || currentUser.id;
    profile = await communityService.getUserProfile(targetUserId);
    if (!profile) return renderInvalidProfile();

    composer = createPostComposer({
      service: communityService,
      async onSaved(post, mode) {
        notify(mode === "edit" ? "Publicação atualizada." : "Publicação criada.");
        activeTab = "posts";
        await reloadProfile();
      },
      onError(error) { if (error.code !== "validation-error") notify(error.message || "Não foi possível salvar a publicação.", "error"); }
    });
    profileEditor = createProfileEditor({
      service: communityService,
      async onSaved(updatedUser) {
        currentUser = updatedUser;
        renderTopbarUser(currentUser);
        notify("Perfil atualizado.");
        await reloadProfile();
      },
      onError(error) { if (error.code !== "validation-error") notify(error.message || "Não foi possível atualizar o perfil.", "error"); }
    });
    reportDialog = createReportDialog({
      service: communityService,
      onReported() { notify("Denúncia registrada neste navegador."); },
      onError(error) { if (error.code !== "validation-error") notify(error.message || "Não foi possível registrar a denúncia.", "error"); }
    });

    renderProfileHeader();
    renderTabs();
    await Promise.all([renderSocialLists(), renderProfileExtras(), loadPosts()]);
  } catch (error) {
    notify(error.message || "Não foi possível abrir o perfil.", "error");
    renderInvalidProfile();
  }
}

initialize();
