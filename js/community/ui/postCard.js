import { createCommentsSection } from "./comments.js";
import { createSpoilerContent } from "./spoilerContent.js";

const TYPE_LABELS = {
  guide: "Guia",
  art: "Arte",
  screenshot: "Screenshot",
  discussion: "Discussão",
  question: "Pergunta"
};

function safeAssetUrl(value, fallback = "") {
  const url = String(value || "").trim();
  if (!url) return fallback;
  if (/^(https:\/\/|assets\/)/i.test(url)) return url;
  return fallback;
}

function truncate(value, maximum = 560) {
  const text = String(value || "").trim();
  return text.length > maximum ? `${text.slice(0, maximum).trimEnd()}…` : text;
}

export function formatRelativeTime(value, now = Date.now()) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "data indisponível";

  const minutes = Math.max(0, Math.floor((now - createdAt) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  if (hours < 48) return "ontem";

  return `há ${Math.floor(hours / 24)} dias`;
}

function createPostBody(post) {
  const fragment = document.createDocumentFragment();
  const title = document.createElement("h2");
  title.className = "post-title";
  title.textContent = post.title;

  const content = document.createElement("p");
  content.className = "post-content";
  content.textContent = truncate(post.content);

  fragment.append(title, content);

  const mediaItems = (post.media || []).filter((item) => item?.type === "image" && safeAssetUrl(item.url));
  if (mediaItems.length) {
    const media = document.createElement("div");
    media.className = "post-media";
    mediaItems.slice(0, 2).forEach((item) => {
      const image = document.createElement("img");
      image.src = safeAssetUrl(item.thumbnail || item.url, safeAssetUrl(item.url));
      image.alt = item.alt || "Mídia da publicação";
      image.loading = "lazy";
      if (Number(item.width) > 0) image.width = Number(item.width);
      if (Number(item.height) > 0) image.height = Number(item.height);
      media.appendChild(image);
    });
    fragment.appendChild(media);
  }

  if (post.tags?.length) {
    const tags = document.createElement("div");
    tags.className = "post-tags";
    post.tags.forEach((tag) => {
      const label = document.createElement("span");
      label.textContent = `#${tag}`;
      tags.appendChild(label);
    });
    fragment.appendChild(tags);
  }

  return fragment;
}

function setLikeState(button, liked, count) {
  button.classList.toggle("is-active", liked);
  button.setAttribute("aria-pressed", String(liked));
  button.setAttribute("aria-label", `${liked ? "Descurtir" : "Curtir"}. ${count} curtidas.`);
  button.textContent = `${liked ? "♥" : "♡"} ${count}`;
}

function setSavedState(button, saved, count) {
  button.classList.toggle("is-active", saved);
  button.setAttribute("aria-pressed", String(saved));
  button.setAttribute("aria-label", `${saved ? "Remover dos salvos" : "Salvar publicação"}. ${count} salvos.`);
  button.textContent = `🔖 ${saved ? "Salvo" : "Salvar"} · ${count}`;
}

function createOwnerMenu(post, { service, currentUser, onEdit, onDelete }) {
  if (!service.canEditPost(post, currentUser)) return null;

  const details = document.createElement("details");
  details.className = "post-owner-menu";
  const summary = document.createElement("summary");
  summary.textContent = "⋯";
  summary.setAttribute("aria-label", `Ações da publicação ${post.title}`);
  const menu = document.createElement("div");
  menu.className = "post-owner-menu-popover";
  menu.setAttribute("role", "menu");
  const edit = document.createElement("button");
  edit.type = "button";
  edit.setAttribute("role", "menuitem");
  edit.textContent = "Editar";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "is-danger";
  remove.setAttribute("role", "menuitem");
  remove.textContent = "Excluir";
  edit.addEventListener("click", () => {
    details.open = false;
    onEdit(post, edit);
  });
  remove.addEventListener("click", () => {
    details.open = false;
    onDelete(post, remove);
  });
  menu.append(edit, remove);
  details.append(summary, menu);
  return details;
}

export function createPostCard(post, options) {
  const {
    service,
    currentUser,
    confirmDelete,
    notify,
    onEdit,
    onDelete,
    onInteraction
  } = options;
  const article = document.createElement("article");
  article.className = `post-card post-card--${post.type}`;
  article.dataset.postId = post.id;

  const header = document.createElement("header");
  header.className = "post-header";

  const avatar = document.createElement("img");
  avatar.className = "post-avatar";
  avatar.src = safeAssetUrl(post.author.avatar, "assets/vee/avatars/vee-avatar-default.webp");
  avatar.alt = `Avatar de ${post.author.displayName}`;
  avatar.width = 48;
  avatar.height = 48;

  const author = document.createElement("div");
  author.className = "post-author";
  const authorName = document.createElement("strong");
  authorName.textContent = post.author.displayName;
  const handle = document.createElement("span");
  handle.textContent = `@${post.author.handle}`;
  const profileNotice = document.createElement("span");
  profileNotice.className = "post-profile-notice";
  profileNotice.textContent = "Perfis em breve";
  author.append(authorName, handle, profileNotice);

  const metadata = document.createElement("div");
  metadata.className = "post-metadata";
  const time = document.createElement("time");
  time.className = "post-time";
  time.dateTime = post.createdAt;
  time.textContent = formatRelativeTime(post.createdAt);
  metadata.appendChild(time);
  if (new Date(post.updatedAt).getTime() > new Date(post.createdAt).getTime()) {
    const edited = document.createElement("span");
    edited.className = "post-edited";
    edited.textContent = "editado";
    metadata.appendChild(edited);
  }

  header.append(avatar, author, metadata);
  const ownerMenu = createOwnerMenu(post, { service, currentUser, onEdit, onDelete });
  if (ownerMenu) header.appendChild(ownerMenu);

  const context = document.createElement("div");
  context.className = "post-context";
  const type = document.createElement("span");
  type.className = "post-type";
  type.textContent = TYPE_LABELS[post.type] || "Publicação";
  context.appendChild(type);

  if (post.game) {
    const gameName = post.game.name || "Jogo relacionado";
    const game = document.createElement("a");
    game.className = "post-game";
    game.textContent = gameName;
    if (game instanceof HTMLAnchorElement) {
      game.href = `game.html?id=${encodeURIComponent(post.game.id)}`;
      game.setAttribute("aria-label", `Abrir página de ${gameName}`);
    }
    context.appendChild(game);
    const hub = document.createElement("a");
    hub.className = "post-game";
    hub.textContent = "Ver comunidade";
    hub.href = `comunidade-jogo.html?gameId=${encodeURIComponent(post.game.id)}`;
    hub.setAttribute("aria-label", `Ver comunidade de ${gameName}`);
    context.appendChild(hub);
  }

  const body = post.spoiler
    ? createSpoilerContent(post.spoilerLabel, () => createPostBody(post))
    : createPostBody(post);

  const actions = document.createElement("footer");
  actions.className = "post-actions";
  const like = document.createElement("button");
  like.type = "button";
  like.className = "post-stat post-like";
  setLikeState(like, post.likedByCurrentUser, post.likesCount);
  like.addEventListener("click", async () => {
    like.disabled = true;
    try {
      const result = await service.toggleLike(post.id);
      post.likedByCurrentUser = result.liked;
      post.likesCount = result.likesCount;
      setLikeState(like, result.liked, result.likesCount);
      onInteraction?.("like", post, result);
    } catch (error) {
      notify(error.message || "Não foi possível atualizar a curtida.", "error");
    } finally {
      like.disabled = false;
    }
  });

  const comments = createCommentsSection({
    postId: post.id,
    initialCount: post.commentsCount,
    currentUser,
    service,
    confirmDelete,
    notify,
    onCountChange(nextCount) {
      post.commentsCount = nextCount;
    }
  });

  const save = document.createElement("button");
  save.type = "button";
  save.className = "post-stat post-save";
  setSavedState(save, post.savedByCurrentUser, post.savesCount);
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const result = await service.toggleSaved(post.id);
      post.savedByCurrentUser = result.saved;
      post.savesCount = result.savesCount;
      setSavedState(save, result.saved, result.savesCount);
      notify(result.saved ? "Publicação salva." : "Publicação removida dos salvos.");
      onInteraction?.("save", post, result);
    } catch (error) {
      notify(error.message || "Não foi possível atualizar os salvos.", "error");
    } finally {
      save.disabled = false;
    }
  });

  actions.append(like, comments.button, save);
  article.append(header, context, body, actions, comments.panel);
  return article;
}
