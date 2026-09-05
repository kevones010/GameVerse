export const COMMUNITY_SCHEMA_VERSION = 1;
export const POST_TYPES = Object.freeze(["guide", "art", "screenshot", "discussion", "question"]);
export const FEED_TABS = Object.freeze(["for-you", "trending", "recent"]);

const COLLECTIONS = ["users", "posts", "comments", "likes", "savedPosts", "follows", "reports"];

export function assertCommunityState(state) {
  const hasCollections = COLLECTIONS.every((collection) => Array.isArray(state?.[collection]));
  if (!state || state.schemaVersion !== COMMUNITY_SCHEMA_VERSION || !hasCollections) {
    throw new Error("Dados locais da comunidade são inválidos.");
  }

  const usersAreValid = state.users.every((user) => user?.id && user?.handle && user?.displayName);
  const postsAreValid = state.posts.every((post) => (
    post?.id
    && post?.authorId
    && POST_TYPES.includes(post?.type)
    && (post.gameId === null || (typeof post.gameId === "number" && Number.isInteger(post.gameId) && post.gameId > 0))
    && typeof post.title === "string"
    && typeof post.content === "string"
  ));

  if (!usersAreValid || !postsAreValid) {
    throw new Error("Usuários ou publicações locais são inválidos.");
  }

  return state;
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
