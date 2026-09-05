export const COMMUNITY_SCHEMA_VERSION = 2;
export const POST_TYPES = Object.freeze(["guide", "art", "screenshot", "discussion", "question"]);
export const FEED_TABS = Object.freeze(["for-you", "trending", "recent", "saved"]);

const COLLECTIONS = ["users", "posts", "comments", "likes", "savedPosts", "follows", "reports"];
const POST_TITLE_MIN = 4;
const POST_TITLE_MAX = 120;
const POST_CONTENT_MIN = 5;
const POST_CONTENT_MAX = 5000;
const COMMENT_CONTENT_MAX = 1000;
const SPOILER_LABEL_MAX = 120;
const TAG_MAX = 5;
const TAG_LENGTH_MAX = 32;

export class CommunityError extends Error {
  constructor(message, { code = "community-error", fieldErrors = {} } = {}) {
    super(message);
    this.name = "CommunityError";
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class CommunityValidationError extends CommunityError {
  constructor(fieldErrors) {
    super("Revise os campos destacados.", { code: "validation-error", fieldErrors });
    this.name = "CommunityValidationError";
  }
}

function asTrimmedText(value) {
  return String(value ?? "").trim();
}

function finiteCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function legacyIdPart(value) {
  return String(value).replace(/[^a-z0-9_-]/gi, "-");
}

function createLegacyInteractions(state) {
  const likes = Array.isArray(state.likes) ? [...state.likes] : [];
  const comments = Array.isArray(state.comments) ? [...state.comments] : [];
  const savedPosts = Array.isArray(state.savedPosts) ? [...state.savedPosts] : [];
  const postLikes = new Map();
  const postComments = new Map();
  const postSaves = new Map();

  likes.forEach((item) => postLikes.set(item.postId, (postLikes.get(item.postId) || 0) + 1));
  comments
    .filter((item) => item.status === "published")
    .forEach((item) => postComments.set(item.postId, (postComments.get(item.postId) || 0) + 1));
  savedPosts.forEach((item) => postSaves.set(item.postId, (postSaves.get(item.postId) || 0) + 1));

  state.posts.forEach((post) => {
    const postPart = legacyIdPart(post.id);
    const createdAt = post.createdAt || new Date(0).toISOString();
    const missingLikes = Math.max(0, finiteCount(post.likesCount) - (postLikes.get(post.id) || 0));
    const missingComments = Math.max(0, finiteCount(post.commentsCount) - (postComments.get(post.id) || 0));
    const missingSaves = Math.max(0, finiteCount(post.savesCount) - (postSaves.get(post.id) || 0));

    for (let index = 0; index < missingLikes; index += 1) {
      likes.push({
        id: `legacy-like-${postPart}-${index}`,
        postId: post.id,
        userId: `legacy-like-user-${postPart}-${index}`,
        createdAt,
        origin: "seed-summary"
      });
    }

    for (let index = 0; index < missingComments; index += 1) {
      comments.push({
        id: `legacy-comment-${postPart}-${index}`,
        postId: post.id,
        authorId: `legacy-comment-user-${postPart}-${index}`,
        parentCommentId: null,
        content: "Comentário demonstrativo preservado da fase inicial.",
        spoiler: false,
        status: "published",
        createdAt,
        updatedAt: createdAt,
        origin: "seed-summary"
      });
    }

    for (let index = 0; index < missingSaves; index += 1) {
      savedPosts.push({
        id: `legacy-save-${postPart}-${index}`,
        postId: post.id,
        userId: `legacy-save-user-${postPart}-${index}`,
        createdAt,
        origin: "seed-summary"
      });
    }
  });

  return { likes, comments, savedPosts };
}

export function migrateCommunityState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Dados locais da comunidade são inválidos.");
  }

  if (state.schemaVersion === COMMUNITY_SCHEMA_VERSION) return state;
  if (state.schemaVersion !== 1 || !Array.isArray(state.posts) || !Array.isArray(state.users)) {
    throw new Error("Versão local da comunidade não suportada.");
  }

  const interactions = createLegacyInteractions({
    ...state,
    likes: Array.isArray(state.likes) ? state.likes : [],
    comments: Array.isArray(state.comments) ? state.comments : [],
    savedPosts: Array.isArray(state.savedPosts) ? state.savedPosts : []
  });

  return {
    ...state,
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    comments: interactions.comments,
    likes: interactions.likes,
    savedPosts: interactions.savedPosts,
    follows: Array.isArray(state.follows) ? state.follows : [],
    reports: Array.isArray(state.reports) ? state.reports : []
  };
}

export function assertCommunityState(state) {
  const hasCollections = COLLECTIONS.every((collection) => Array.isArray(state?.[collection]));
  if (!state || state.schemaVersion !== COMMUNITY_SCHEMA_VERSION || !hasCollections) {
    throw new Error("Dados locais da comunidade são inválidos.");
  }

  const usersAreValid = state.users.every((user) => (
    typeof user?.id === "string"
    && typeof user?.handle === "string"
    && typeof user?.displayName === "string"
  ));
  const postsAreValid = state.posts.every((post) => (
    typeof post?.id === "string"
    && typeof post?.authorId === "string"
    && POST_TYPES.includes(post?.type)
    && (post.gameId === null || (typeof post.gameId === "number" && Number.isInteger(post.gameId) && post.gameId > 0))
    && typeof post.title === "string"
    && typeof post.content === "string"
    && ["published", "deleted"].includes(post.status)
  ));
  const commentsAreValid = state.comments.every((comment) => (
    typeof comment?.id === "string"
    && typeof comment?.postId === "string"
    && typeof comment?.authorId === "string"
    && typeof comment?.content === "string"
    && ["published", "deleted"].includes(comment.status)
  ));
  const likesAreValid = state.likes.every((like) => (
    typeof like?.id === "string"
    && typeof like?.postId === "string"
    && typeof like?.userId === "string"
  ));
  const savesAreValid = state.savedPosts.every((savedPost) => (
    typeof savedPost?.id === "string"
    && typeof savedPost?.postId === "string"
    && typeof savedPost?.userId === "string"
  ));

  if (!usersAreValid || !postsAreValid || !commentsAreValid || !likesAreValid || !savesAreValid) {
    throw new Error("Usuários, publicações ou interações locais são inválidos.");
  }

  return state;
}

export function normalizeTags(value) {
  const values = Array.isArray(value) ? value : String(value ?? "").split(",");
  const normalized = [];

  values.forEach((tag) => {
    const cleanTag = asTrimmedText(tag)
      .replace(/#/g, "")
      .replace(/\s+/g, "-")
      .toLocaleLowerCase("pt-BR")
      .slice(0, TAG_LENGTH_MAX);
    if (cleanTag && !normalized.includes(cleanTag) && normalized.length < TAG_MAX) {
      normalized.push(cleanTag);
    }
  });

  return normalized;
}

export function validateMediaUrl(value) {
  const input = asTrimmedText(value);
  if (!input) return null;

  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch (error) {
    return null;
  }
}

export function validatePost(input, availableGames = []) {
  const fieldErrors = {};
  const type = POST_TYPES.includes(input?.type) ? input.type : "";
  const title = asTrimmedText(input?.title);
  const content = asTrimmedText(input?.content);
  const spoiler = Boolean(input?.spoiler);
  const spoilerLabel = asTrimmedText(input?.spoilerLabel);
  const tags = normalizeTags(input?.tags);
  const rawMediaUrl = asTrimmedText(input?.mediaUrl);
  const mediaUrl = validateMediaUrl(rawMediaUrl);
  const requestedGameId = input?.gameId === null || input?.gameId === undefined || input?.gameId === ""
    ? null
    : Number(input.gameId);
  const selectedGame = requestedGameId === null
    ? null
    : availableGames.find((game) => Number(game.id) === requestedGameId) || null;

  if (!type) fieldErrors.type = "Escolha um tipo de publicação.";
  if (!title) fieldErrors.title = "Informe um título.";
  else if (title.length < POST_TITLE_MIN) fieldErrors.title = "O título precisa ter pelo menos 4 caracteres.";
  else if (title.length > POST_TITLE_MAX) fieldErrors.title = "O título pode ter no máximo 120 caracteres.";
  if (!content) fieldErrors.content = "Escreva o conteúdo da publicação.";
  else if (content.length < POST_CONTENT_MIN) fieldErrors.content = "O conteúdo precisa ter pelo menos 5 caracteres.";
  else if (content.length > POST_CONTENT_MAX) fieldErrors.content = "O conteúdo pode ter no máximo 5000 caracteres.";
  if (requestedGameId !== null && !selectedGame) fieldErrors.gameId = "Selecione um jogo disponível na lista.";
  if (rawMediaUrl && !mediaUrl) fieldErrors.mediaUrl = "Use uma URL de imagem HTTPS válida.";
  if (spoilerLabel.length > SPOILER_LABEL_MAX) fieldErrors.spoilerLabel = "O rótulo pode ter no máximo 120 caracteres.";

  if (Object.keys(fieldErrors).length) throw new CommunityValidationError(fieldErrors);

  return {
    type,
    title,
    content,
    gameId: selectedGame ? Number(selectedGame.id) : null,
    gameName: selectedGame?.name || null,
    gameSlug: selectedGame?.slug || null,
    tags,
    media: mediaUrl ? [{
      type: "image",
      url: mediaUrl,
      thumbnail: mediaUrl,
      alt: `Imagem da publicação ${title}`,
      width: null,
      height: null
    }] : [],
    spoiler,
    spoilerLabel: spoiler ? spoilerLabel : ""
  };
}

export function validateComment(input) {
  const content = asTrimmedText(input?.content);
  const fieldErrors = {};

  if (!content) fieldErrors.content = "Escreva um comentário.";
  else if (content.length > COMMENT_CONTENT_MAX) fieldErrors.content = "O comentário pode ter no máximo 1000 caracteres.";

  if (Object.keys(fieldErrors).length) throw new CommunityValidationError(fieldErrors);

  return {
    content,
    spoiler: Boolean(input?.spoiler)
  };
}

export function normalizeListOptions(options = {}) {
  const tab = FEED_TABS.includes(options.tab) ? options.tab : "for-you";
  const type = options.type === "all" || POST_TYPES.includes(options.type) ? options.type : "all";
  const cursorNumber = Number.parseInt(options.cursor, 10);
  const limitNumber = Number.parseInt(options.limit, 10);

  return {
    tab,
    type,
    cursor: Number.isFinite(cursorNumber) && cursorNumber >= 0 ? cursorNumber : 0,
    limit: Number.isFinite(limitNumber) ? Math.min(12, Math.max(1, limitNumber)) : 6
  };
}
