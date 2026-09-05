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

function truncate(value, maximum = 280) {
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

function createStat(icon, value, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "post-stat";
  button.disabled = true;
  button.title = `${label} — disponível em breve`;
  button.setAttribute("aria-label", `${value} ${label}. Recurso disponível em breve.`);
  button.textContent = `${icon} ${value}`;
  return button;
}

export function createPostCard(post) {
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

  const time = document.createElement("time");
  time.className = "post-time";
  time.dateTime = post.createdAt;
  time.textContent = formatRelativeTime(post.createdAt);

  header.append(avatar, author, time);

  const context = document.createElement("div");
  context.className = "post-context";
  const type = document.createElement("span");
  type.className = "post-type";
  type.textContent = TYPE_LABELS[post.type] || "Publicação";
  context.appendChild(type);

  if (post.game) {
    const game = document.createElement(post.game.slug || post.game.id ? "a" : "span");
    game.className = "post-game";
    game.textContent = post.game.name;
    if (game instanceof HTMLAnchorElement) {
      const identifier = post.game.slug
        ? `slug=${encodeURIComponent(post.game.slug)}`
        : `id=${encodeURIComponent(post.game.id)}`;
      game.href = `game.html?${identifier}`;
      game.setAttribute("aria-label", `Abrir página de ${post.game.name}`);
    }
    context.appendChild(game);
  }

  const body = post.spoiler
    ? createSpoilerContent(post.spoilerLabel, () => createPostBody(post))
    : createPostBody(post);

  const actions = document.createElement("footer");
  actions.className = "post-actions";
  actions.append(
    createStat("♥", post.likesCount, "curtidas"),
    createStat("Comentários", post.commentsCount, "comentários"),
    createStat("Salvar", post.savesCount, "salvos")
  );

  article.append(header, context, body, actions);
  return article;
}
