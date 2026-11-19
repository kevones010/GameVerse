import { createSeedInteractions, createSeedExtras } from "../../../data/communitySeed.js";

export const COMMUNITY_SCHEMA_VERSION = 3;
export const POST_TYPES = Object.freeze(["guide", "art", "screenshot", "discussion", "question", "review"]);
export const REACTIONS = Object.freeze(["fire", "laugh", "wow"]);
export const FEED_TABS = Object.freeze(["for-you", "following", "trending", "recent", "saved"]);
export const REPORT_REASONS = Object.freeze(["spam", "offensive", "spoiler", "misinformation", "other"]);
export const PROFILE_AVATARS = Object.freeze([
  "assets/vee/avatars/vee-avatar-default.webp",
  "assets/vee/avatars/vee-avatar-happy.webp",
  "assets/vee/avatars/vee-avatar-blue.webp",
  "assets/vee/avatars/vee-avatar-purple.webp",
  "assets/vee/avatars/vee-avatar-green.webp",
  "assets/vee/avatars/vee-avatar-pink.webp"
]);

const COLLECTIONS = ["users", "posts", "comments", "likes", "savedPosts", "follows", "reports", "reactions", "pollVotes"];
const POLL_OPTIONS_MIN = 2;
const POLL_OPTIONS_MAX = 4;
const POLL_OPTION_MAX = 60;
const POST_TITLE_MIN = 4;
const POST_TITLE_MAX = 120;
const POST_CONTENT_MIN = 5;
const POST_CONTENT_MAX = 5000;
const COMMENT_CONTENT_MAX = 1000;
const SPOILER_LABEL_MAX = 120;
const TAG_MAX = 5;
const TAG_LENGTH_MAX = 32;
const PROFILE_NAME_MIN = 2;
const PROFILE_NAME_MAX = 32;
const PROFILE_BIO_MAX = 180;
const REPORT_DETAILS_MAX = 500;

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

// RAWG IDs are canonical decimal integers; slugs and loose numeric coercion
// (hex, fractions, exponents, booleans) must never identify a community.
export function normalizeGameId(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const id = Number(text);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
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

function migrateV1ToV2(state) {
  if (!Array.isArray(state.posts) || !Array.isArray(state.users)) {
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
    schemaVersion: 2,
    comments: interactions.comments,
    likes: interactions.likes,
    savedPosts: interactions.savedPosts,
    follows: Array.isArray(state.follows) ? state.follows : [],
    reports: Array.isArray(state.reports) ? state.reports : []
  };
}

// v3: troca as interações sintéticas (212 curtidas com 6 usuários…) por interações reais dos
// usuários de demonstração, e cria reações, enquetes e análises. O que a pessoa fez é preservado.
function migrateV2ToV3(state) {
  const isSynthetic = (item) => item?.origin === "seed-summary";
  const extras = createSeedExtras();
  const posts = [...state.posts];
  extras.posts.forEach((post) => {
    if (!posts.some((item) => item.id === post.id)) posts.push(post);
  });
  posts.forEach((post) => {
    const seedPoll = extras.polls[post.id];
    if (seedPoll && !post.poll) post.poll = seedPoll;
  });

  const seeded = createSeedInteractions(posts, state.users);
  const keep = (list) => (Array.isArray(list) ? list.filter((item) => !isSynthetic(item)) : []);
  const mergeById = (current, additions, sameAs) => {
    const merged = [...current];
    additions.forEach((item) => {
      if (!merged.some((existing) => existing.id === item.id || sameAs(existing, item))) merged.push(item);
    });
    return merged;
  };
  const samePostUser = (a, b) => a.postId === b.postId && a.userId === b.userId;

  return {
    ...state,
    schemaVersion: 3,
    posts,
    likes: mergeById(keep(state.likes), seeded.likes, samePostUser),
    savedPosts: mergeById(keep(state.savedPosts), seeded.savedPosts, samePostUser),
    comments: mergeById(keep(state.comments), seeded.comments, () => false),
    follows: mergeById(Array.isArray(state.follows) ? state.follows : [], seeded.follows,
      (a, b) => a.followerId === b.followerId && a.followingId === b.followingId),
    reactions: seeded.reactions,
    pollVotes: seeded.pollVotes,
    reports: Array.isArray(state.reports) ? state.reports : []
  };
}

export function migrateCommunityState(state) {
  if (!state || typeof state !== "object") {
    throw new Error("Dados locais da comunidade são inválidos.");
  }

  let current = state;
  if (current.schemaVersion === 1) current = migrateV1ToV2(current);
  if (current.schemaVersion === 2) current = migrateV2ToV3(current);
  if (current.schemaVersion !== COMMUNITY_SCHEMA_VERSION) {
    throw new Error("Versão local da comunidade não suportada.");
  }
  return current;
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
    && (post.poll === undefined || post.poll === null || isValidPoll(post.poll))
    && (post.rating === undefined || post.rating === null || (Number.isInteger(post.rating) && post.rating >= 1 && post.rating <= 5))
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
  const followsAreValid = state.follows.every((follow) => (
    typeof follow?.id === "string"
    && typeof follow?.followerId === "string"
    && typeof follow?.followingId === "string"
    && follow.followerId !== follow.followingId
  ));
  const reportsAreValid = state.reports.every((report) => (
    typeof report?.id === "string"
    && typeof report?.reporterId === "string"
    && ["post", "user"].includes(report?.targetType)
    && typeof report?.targetId === "string"
    && REPORT_REASONS.includes(report?.reason)
  ));

  const reactionsAreValid = state.reactions.every((reaction) => (
    typeof reaction?.id === "string"
    && typeof reaction?.postId === "string"
    && typeof reaction?.userId === "string"
    && REACTIONS.includes(reaction?.emoji)
  ));
  const pollVotesAreValid = state.pollVotes.every((vote) => (
    typeof vote?.id === "string"
    && typeof vote?.postId === "string"
    && typeof vote?.userId === "string"
    && Number.isInteger(vote?.optionIndex) && vote.optionIndex >= 0 && vote.optionIndex < POLL_OPTIONS_MAX
  ));

  if (!usersAreValid || !postsAreValid || !commentsAreValid || !likesAreValid || !savesAreValid || !followsAreValid
    || !reportsAreValid || !reactionsAreValid || !pollVotesAreValid) {
    throw new Error("Usuários, publicações ou interações locais são inválidos.");
  }

  return state;
}

function isValidPoll(poll) {
  return Array.isArray(poll?.options)
    && poll.options.length >= POLL_OPTIONS_MIN && poll.options.length <= POLL_OPTIONS_MAX
    && poll.options.every((option) => typeof option === "string" && option.trim() && option.length <= POLL_OPTION_MAX);
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
  const hasGame = input?.gameId !== null && input?.gameId !== undefined && input?.gameId !== "";
  const requestedGameId = normalizeGameId(input?.gameId);
  const previousSnapshot = requestedGameId === null ? null
    : availableGames.find((game) => normalizeGameId(game.id) === requestedGameId);
  const gameName = asTrimmedText(input?.gameName ?? previousSnapshot?.name);
  const gameSlug = asTrimmedText(input?.gameSlug ?? previousSnapshot?.slug);

  if (!type) fieldErrors.type = "Escolha um tipo de publicação.";
  if (!title) fieldErrors.title = "Informe um título.";
  else if (title.length < POST_TITLE_MIN) fieldErrors.title = "O título precisa ter pelo menos 4 caracteres.";
  else if (title.length > POST_TITLE_MAX) fieldErrors.title = "O título pode ter no máximo 120 caracteres.";
  if (!content) fieldErrors.content = "Escreva o conteúdo da publicação.";
  else if (content.length < POST_CONTENT_MIN) fieldErrors.content = "O conteúdo precisa ter pelo menos 5 caracteres.";
  else if (content.length > POST_CONTENT_MAX) fieldErrors.content = "O conteúdo pode ter no máximo 5000 caracteres.";
  if (hasGame && requestedGameId === null) fieldErrors.gameId = "Selecione um jogo válido.";
  if (hasGame && (gameName.length > 200 || gameSlug.length > 200)) {
    fieldErrors.gameId = "O nome ou identificador do jogo é muito longo.";
  }
  if (rawMediaUrl && !mediaUrl) fieldErrors.mediaUrl = "Use uma URL de imagem HTTPS válida.";
  if (spoilerLabel.length > SPOILER_LABEL_MAX) fieldErrors.spoilerLabel = "O rótulo pode ter no máximo 120 caracteres.";

  // Enquete: só em perguntas, com 2 a 4 opções.
  const pollOptions = (Array.isArray(input?.pollOptions) ? input.pollOptions : [])
    .map(asTrimmedText).filter(Boolean);
  let poll = null;
  if (type === "question" && pollOptions.length) {
    if (pollOptions.length < POLL_OPTIONS_MIN) fieldErrors.pollOptions = "A enquete precisa de pelo menos 2 opções.";
    else if (pollOptions.length > POLL_OPTIONS_MAX) fieldErrors.pollOptions = "A enquete pode ter no máximo 4 opções.";
    else if (pollOptions.some((option) => option.length > POLL_OPTION_MAX)) fieldErrors.pollOptions = "Cada opção pode ter no máximo 60 caracteres.";
    else if (new Set(pollOptions.map((option) => option.toLocaleLowerCase("pt-BR"))).size !== pollOptions.length) fieldErrors.pollOptions = "As opções precisam ser diferentes.";
    else poll = { options: pollOptions };
  }

  // Nota da análise: 1 a 5 estrelas, opcional.
  const ratingNumber = Number(input?.rating);
  const rating = type === "review" && Number.isInteger(ratingNumber) && ratingNumber >= 1 && ratingNumber <= 5 ? ratingNumber : null;
  if (type === "review" && input?.rating !== undefined && input?.rating !== null && input?.rating !== "" && rating === null) {
    fieldErrors.rating = "A nota precisa ser de 1 a 5.";
  }

  if (Object.keys(fieldErrors).length) throw new CommunityValidationError(fieldErrors);

  return {
    poll,
    rating,
    type,
    title,
    content,
    gameId: hasGame ? requestedGameId : null,
    gameName: hasGame ? gameName || null : null,
    gameSlug: hasGame ? gameSlug || null : null,
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

export function validateProfile(input) {
  const displayName = asTrimmedText(input?.displayName);
  const bio = asTrimmedText(input?.bio);
  const avatar = asTrimmedText(input?.avatar);
  const fieldErrors = {};

  if (!displayName) fieldErrors.displayName = "Informe um nome para o perfil.";
  else if (displayName.length < PROFILE_NAME_MIN) fieldErrors.displayName = "O nome precisa ter pelo menos 2 caracteres.";
  else if (displayName.length > PROFILE_NAME_MAX) fieldErrors.displayName = "O nome pode ter no máximo 32 caracteres.";
  if (bio.length > PROFILE_BIO_MAX) fieldErrors.bio = "A bio pode ter no máximo 180 caracteres.";
  if (!PROFILE_AVATARS.includes(avatar)) fieldErrors.avatar = "Escolha um avatar disponível no GameVerse.";

  if (Object.keys(fieldErrors).length) throw new CommunityValidationError(fieldErrors);
  return { displayName, bio, avatar };
}

export function validateReport(input) {
  const targetType = ["post", "user"].includes(input?.targetType) ? input.targetType : "";
  const targetId = asTrimmedText(input?.targetId);
  const reason = REPORT_REASONS.includes(input?.reason) ? input.reason : "";
  const details = asTrimmedText(input?.details);
  const fieldErrors = {};

  if (!targetType) fieldErrors.targetType = "Tipo de denúncia inválido.";
  if (!targetId) fieldErrors.targetId = "Conteúdo da denúncia inválido.";
  if (!reason) fieldErrors.reason = "Escolha um motivo.";
  if (details.length > REPORT_DETAILS_MAX) fieldErrors.details = "Os detalhes podem ter no máximo 500 caracteres.";

  if (Object.keys(fieldErrors).length) throw new CommunityValidationError(fieldErrors);
  return { targetType, targetId, reason, details };
}

export function normalizeListOptions(options = {}) {
  const tab = FEED_TABS.includes(options.tab) ? options.tab : "for-you";
  const type = options.type === "all" || POST_TYPES.includes(options.type) ? options.type : "all";
  const cursorNumber = Number.parseInt(options.cursor, 10);
  const limitNumber = Number.parseInt(options.limit, 10);
  const gameId = options.gameId === undefined || options.gameId === null ? null : normalizeGameId(options.gameId);
  if (options.gameId !== undefined && options.gameId !== null && gameId === null) {
    throw new CommunityError("Jogo inválido.", { code: "invalid-game-id" });
  }

  const tag = normalizeTags([options.tag])[0] || null;

  return {
    tab,
    type,
    tag,
    gameId,
    cursor: Number.isFinite(cursorNumber) && cursorNumber >= 0 ? cursorNumber : 0,
    limit: Number.isFinite(limitNumber) ? Math.min(12, Math.max(1, limitNumber)) : 6
  };
}
