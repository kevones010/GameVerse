import { CommunityService } from "./services/community/communityService.js";
import { LocalCommunityRepository } from "./services/community/localCommunityRepository.js";
import { CommunitySession } from "./services/community/communitySession.js";
import { createConfirmDialog } from "./community/ui/confirmDialog.js";
import { createPostCard } from "./community/ui/postCard.js";
import { createPostComposer } from "./community/ui/postComposer.js";
import { createProfileEditor } from "./community/ui/profileEditor.js";
import { createReportDialog } from "./community/ui/reportDialog.js";
import { createToastRegion } from "./community/ui/toast.js";

const TYPE_LABELS = {
  guide: "Guias",
  art: "Artes",
  screenshot: "Screenshots",
  discussion: "Discussões",
  question: "Perguntas"
};
const BASE_TABS = [
  ["posts", "Publicações"],
  ["guide", "Guias"],
  ["art", "Artes"],
  ["screenshot", "Screenshots"],
  ["discussion", "Discussões"],
  ["question", "Perguntas"]
];

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

async function reloadProfile({ keepFeed = false } = {}) {
  profile = await communityService.getUserProfile(targetUserId);
  if (!profile) return renderInvalidProfile();
  renderProfileHeader();
  renderTabs();
  await Promise.all([renderSocialLists(), keepFeed ? Promise.resolve() : loadPosts()]);
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
    await Promise.all([renderSocialLists(), loadPosts()]);
  } catch (error) {
    notify(error.message || "Não foi possível abrir o perfil.", "error");
    renderInvalidProfile();
  }
}

initialize();
