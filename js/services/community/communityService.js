import {
  mapCommunityComment,
  mapCommunityPost,
  mapCommunityUser
} from "./communityMappers.js";
import {
  CommunityError,
  normalizeGameId,
  normalizeListOptions,
  POST_TYPES,
  validateComment,
  validatePost,
  validateProfile,
  validateReport
} from "./communityValidation.js";

const HOUR = 60 * 60 * 1000;

function timestamp(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function createId(prefix) {
  const browserCrypto = globalThis.crypto;
  if (typeof browserCrypto?.randomUUID === "function") {
    return `${prefix}-${browserCrypto.randomUUID()}`;
  }

  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16));
    const randomPart = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${prefix}-${randomPart}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function recencyPoints(post, now = Date.now()) {
  const ageInHours = Math.max(0, (now - timestamp(post.createdAt)) / HOUR);
  return Math.max(0, 72 - ageInHours) / 6;
}

function trendingScore(post, now = Date.now()) {
  return (Number(post.likesCount) || 0)
    + ((Number(post.commentsCount) || 0) * 3)
    + ((Number(post.savesCount) || 0) * 2)
    + recencyPoints(post, now);
}

function forYouScore(post, now = Date.now(), personalization = {}) {
  const followedBonus = personalization.followingIds?.has(post.authorId) ? 18 : 0;
  const sharedTags = (post.tags || []).filter((tag) => personalization.interestTags?.has(String(tag).toLowerCase())).length;
  const interestBonus = Math.min(3, sharedTags) * 5;
  return (trendingScore(post, now) * 0.55) + (recencyPoints(post, now) * 4) + followedBonus + interestBonus;
}

function sortPosts(posts, tab, savedAtByPost = new Map(), personalization = {}) {
  const now = Date.now();
  return [...posts].sort((first, second) => {
    if (tab === "recent" || tab === "following") return timestamp(second.createdAt) - timestamp(first.createdAt);
    if (tab === "saved") {
      return timestamp(savedAtByPost.get(second.id)) - timestamp(savedAtByPost.get(first.id))
        || timestamp(second.createdAt) - timestamp(first.createdAt);
    }
    const firstScore = tab === "trending" ? trendingScore(first, now) : forYouScore(first, now, personalization);
    const secondScore = tab === "trending" ? trendingScore(second, now) : forYouScore(second, now, personalization);
    return secondScore - firstScore || timestamp(second.createdAt) - timestamp(first.createdAt);
  });
}

function authorIdOf(resource) {
  return resource?.authorId || resource?.author?.id || null;
}

export class CommunityService {
  constructor(repository, session) {
    this.repository = repository;
    this.session = session;
    this.initialization = null;
  }

  async initialize() {
    if (!this.initialization) {
      this.initialization = this.repository.initialize().catch((error) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  async requireCurrentUser() {
    const user = await this.session.getCurrentUser();
    if (!user) throw new CommunityError("Usuário local de demonstração não encontrado.", { code: "user-not-found" });
    return user;
  }

  async interactionContext(userId) {
    const [likes, savedPosts] = await Promise.all([
      this.repository.listLikesByUser(userId),
      this.repository.listSavedPostsByUser(userId)
    ]);
    return {
      likedPostIds: new Set(likes.map((like) => like.postId)),
      savedPostIds: new Set(savedPosts.map((savedPost) => savedPost.postId)),
      savedAtByPost: new Map(savedPosts.map((savedPost) => [savedPost.postId, savedPost.createdAt]))
    };
  }

  async listPosts(options = {}) {
    await this.initialize();
    const normalized = normalizeListOptions(options);
    const currentUser = await this.requireCurrentUser();
    const [posts, users, interactions, following] = await Promise.all([
      this.repository.listPosts(),
      this.repository.listUsers(),
      this.interactionContext(currentUser.id),
      this.repository.listFollowingByUser(currentUser.id)
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const followingIds = new Set(following.map((follow) => follow.followingId));
    const interestTags = new Set();
    posts.forEach((post) => {
      if (interactions.likedPostIds.has(post.id) || interactions.savedPostIds.has(post.id)) {
        (post.tags || []).forEach((tag) => interestTags.add(String(tag).toLowerCase()));
      }
    });
    const visiblePosts = posts.filter((post) => (
      post.status === "published"
      && post.visibility === "public"
      && (normalized.gameId === null || normalizeGameId(post.gameId) === normalized.gameId)
      && (normalized.type === "all" || post.type === normalized.type)
      && (normalized.tab !== "saved" || interactions.savedPostIds.has(post.id))
      && (normalized.tab !== "following" || followingIds.has(post.authorId))
    ));
    const orderedPosts = sortPosts(visiblePosts, normalized.tab, interactions.savedAtByPost, { followingIds, interestTags });
    const end = normalized.cursor + normalized.limit;

    return {
      items: orderedPosts
        .slice(normalized.cursor, end)
        .map((post) => mapCommunityPost(post, usersById.get(post.authorId), {
          liked: interactions.likedPostIds.has(post.id),
          saved: interactions.savedPostIds.has(post.id)
        })),
      nextCursor: end < orderedPosts.length ? String(end) : null,
      total: orderedPosts.length
    };
  }

  async getPostById(id) {
    await this.initialize();
    const [post, currentUser] = await Promise.all([
      this.repository.getPostById(id),
      this.requireCurrentUser()
    ]);
    if (!post || post.status !== "published" || post.visibility !== "public") return null;
    const [author, interactions] = await Promise.all([
      this.repository.getUserById(post.authorId),
      this.interactionContext(currentUser.id)
    ]);
    return mapCommunityPost(post, author, {
      liked: interactions.likedPostIds.has(post.id),
      saved: interactions.savedPostIds.has(post.id)
    });
  }

  async listPostsByGame(gameId, options = {}) {
    const id = normalizeGameId(gameId);
    if (id === null) throw new CommunityError("Jogo inválido.", { code: "invalid-game-id" });
    return this.listPosts({ ...options, gameId: id });
  }

  async countPostsByGame(gameId) {
    return (await this.getCommunityGameStats(gameId)).total;
  }

  async getCommunityGameStats(gameId) {
    const id = normalizeGameId(gameId);
    if (id === null) throw new CommunityError("Jogo inválido.", { code: "invalid-game-id" });
    await this.initialize();
    const [posts, users] = await Promise.all([this.repository.listPosts(), this.repository.listUsers()]);
    const published = posts.filter((post) => post.status === "published"
      && post.visibility === "public" && normalizeGameId(post.gameId) === id);
    const counts = Object.fromEntries(POST_TYPES.map((type) => [type, 0]));
    const tags = new Map();
    const creators = new Map();
    published.forEach((post) => {
      counts[post.type] += 1;
      new Set(post.tags || []).forEach((tag) => tags.set(tag, (tags.get(tag) || 0) + 1));
      creators.set(post.authorId, (creators.get(post.authorId) || 0) + 1);
    });
    const snapshot = sortPosts(published, "recent").find((post) => post.gameName);
    const byPopularity = (first, second) => second.postsCount - first.postsCount;
    return {
      gameId: id,
      total: published.length,
      counts,
      game: snapshot ? { id, name: snapshot.gameName, slug: snapshot.gameSlug || "" } : null,
      tags: [...tags].map(([tag, postsCount]) => ({ tag, postsCount }))
        .sort((a, b) => byPopularity(a, b) || a.tag.localeCompare(b.tag, "pt-BR")).slice(0, 8),
      creators: users.filter((user) => creators.has(user.id))
        .map((user) => ({ ...mapCommunityUser(user), postsCount: creators.get(user.id) }))
        .sort((a, b) => byPopularity(a, b) || a.displayName.localeCompare(b.displayName, "pt-BR")).slice(0, 5)
    };
  }

  async listTrendingPosts(options = {}) {
    return this.listPosts({ ...options, tab: "trending" });
  }

  async listRecentPosts(options = {}) {
    return this.listPosts({ ...options, tab: "recent" });
  }

  async listSavedPosts(options = {}) {
    return this.listPosts({ ...options, tab: "saved" });
  }

  async listFollowingPosts(options = {}) {
    return this.listPosts({ ...options, tab: "following" });
  }

  async listPostsByType(type, options = {}) {
    const normalizedType = POST_TYPES.includes(type) ? type : "all";
    return this.listPosts({ ...options, type: normalizedType });
  }

  async getUserById(id) {
    await this.initialize();
    return mapCommunityUser(await this.repository.getUserById(id));
  }

  async getCurrentUser() {
    await this.initialize();
    return mapCommunityUser(await this.requireCurrentUser());
  }

  async getUserProfile(userId) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    const [user, posts, followers, following, currentFollowing] = await Promise.all([
      this.repository.getUserById(userId),
      this.repository.listPosts(),
      this.repository.listFollowersByUser(userId),
      this.repository.listFollowingByUser(userId),
      this.repository.listFollowingByUser(currentUser.id)
    ]);
    if (!user) return null;
    const publishedPosts = posts.filter((post) => post.authorId === userId && post.status === "published" && post.visibility === "public");
    const counts = Object.fromEntries(POST_TYPES.map((type) => [type, 0]));
    publishedPosts.forEach((post) => { counts[post.type] += 1; });
    return {
      ...mapCommunityUser(user),
      postsCount: publishedPosts.length,
      followersCount: followers.length,
      followingCount: following.length,
      counts,
      isCurrentUser: user.id === currentUser.id,
      followedByCurrentUser: currentFollowing.some((follow) => follow.followingId === user.id)
    };
  }

  async listUserPosts(userId, options = {}) {
    await this.initialize();
    const user = await this.repository.getUserById(userId);
    if (!user) throw new CommunityError("Perfil não encontrado.", { code: "user-not-found" });
    const normalized = normalizeListOptions({ ...options, tab: options.tab || "recent" });
    const currentUser = await this.requireCurrentUser();
    const [posts, interactions] = await Promise.all([
      this.repository.listPosts(),
      this.interactionContext(currentUser.id)
    ]);
    const visible = posts.filter((post) => post.authorId === userId && post.status === "published" && post.visibility === "public"
      && (normalized.type === "all" || post.type === normalized.type));
    const ordered = sortPosts(visible, normalized.tab, interactions.savedAtByPost);
    const end = normalized.cursor + normalized.limit;
    return {
      items: ordered.slice(normalized.cursor, end).map((post) => mapCommunityPost(post, user, {
        liked: interactions.likedPostIds.has(post.id),
        saved: interactions.savedPostIds.has(post.id)
      })),
      nextCursor: end < ordered.length ? String(end) : null,
      total: ordered.length
    };
  }

  async listCurrentUserLikedPosts(options = {}) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    const [posts, users, likes, interactions] = await Promise.all([
      this.repository.listPosts(),
      this.repository.listUsers(),
      this.repository.listLikesByUser(currentUser.id),
      this.interactionContext(currentUser.id)
    ]);
    const likedIds = new Set(likes.map((like) => like.postId));
    const normalized = normalizeListOptions({ ...options, tab: "recent" });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const visible = posts.filter((post) => likedIds.has(post.id) && post.status === "published" && post.visibility === "public"
      && (normalized.type === "all" || post.type === normalized.type));
    const ordered = sortPosts(visible, "recent");
    const end = normalized.cursor + normalized.limit;
    return {
      items: ordered.slice(normalized.cursor, end).map((post) => mapCommunityPost(post, usersById.get(post.authorId), {
        liked: true, saved: interactions.savedPostIds.has(post.id)
      })),
      nextCursor: end < ordered.length ? String(end) : null,
      total: ordered.length
    };
  }

  async updateCurrentUserProfile(input) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    const normalized = validateProfile(input);
    const updated = await this.repository.updateUser(currentUser.id, {
      ...normalized,
      updatedAt: new Date().toISOString()
    }, currentUser.id);
    return mapCommunityUser(updated);
  }

  async toggleFollow(userId) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    if (!userId || userId === currentUser.id) {
      throw new CommunityError("Você não pode seguir o próprio perfil.", { code: "cannot-follow-self" });
    }
    const result = await this.repository.toggleFollow(currentUser.id, userId, {
      id: createId("follow"),
      createdAt: new Date().toISOString()
    });
    const [followers, following] = await Promise.all([
      this.repository.listFollowersByUser(userId),
      this.repository.listFollowingByUser(currentUser.id)
    ]);
    return { ...result, followersCount: followers.length, currentUserFollowingCount: following.length };
  }

  async listFollowers(userId, limit = 12) {
    await this.initialize();
    const [follows, users] = await Promise.all([this.repository.listFollowersByUser(userId), this.repository.listUsers()]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    return follows.slice().sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
      .map((follow) => mapCommunityUser(usersById.get(follow.followerId))).filter(Boolean).slice(0, limit);
  }

  async listFollowing(userId, limit = 12) {
    await this.initialize();
    const [follows, users] = await Promise.all([this.repository.listFollowingByUser(userId), this.repository.listUsers()]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    return follows.slice().sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
      .map((follow) => mapCommunityUser(usersById.get(follow.followingId))).filter(Boolean).slice(0, limit);
  }

  async listSuggestedUsers(limit = 5) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    const [users, posts, follows] = await Promise.all([
      this.repository.listUsers(),
      this.repository.listPosts(),
      this.repository.listFollowingByUser(currentUser.id)
    ]);
    const followingIds = new Set(follows.map((follow) => follow.followingId));
    const activity = new Map();
    posts.filter((post) => post.status === "published" && post.visibility === "public").forEach((post) => {
      const score = 1 + Math.min(20, trendingScore(post) / 25);
      activity.set(post.authorId, (activity.get(post.authorId) || 0) + score);
    });
    return users.filter((user) => user.id !== currentUser.id && !followingIds.has(user.id))
      .map((user) => ({ ...mapCommunityUser(user), activityScore: activity.get(user.id) || 0 }))
      .sort((a, b) => b.activityScore - a.activityScore || a.displayName.localeCompare(b.displayName, "pt-BR"))
      .slice(0, limit);
  }

  async createReport(input) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    const normalized = validateReport(input);
    const report = await this.repository.createReport({
      id: createId("report"),
      reporterId: currentUser.id,
      ...normalized,
      status: "pending",
      createdAt: new Date().toISOString()
    });
    return { id: report.id, createdAt: report.createdAt };
  }

  canEditPost(post, user) {
    return Boolean(post && user && post.status !== "deleted" && authorIdOf(post) === user.id);
  }

  canDeletePost(post, user) {
    return this.canEditPost(post, user);
  }

  canDeleteComment(comment, user) {
    return Boolean(comment && user && comment.status !== "deleted" && authorIdOf(comment) === user.id);
  }

  async listAvailableGames() {
    await this.initialize();
    const posts = await this.repository.listPosts();
    const games = new Map();

    posts.filter((post) => post.status === "published" && post.gameId !== null).forEach((post) => {
      const id = Number(post.gameId);
      if (!games.has(id)) {
        games.set(id, { id, name: post.gameName || "Jogo", slug: post.gameSlug || "" });
      }
    });

    return [...games.values()].sort((first, second) => first.name.localeCompare(second.name, "pt-BR"));
  }

  async createPost(input) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    const normalized = validatePost(input);
    const now = new Date().toISOString();
    const post = await this.repository.createPost({
      id: createId("post"),
      authorId: currentUser.id,
      ...normalized,
      status: "published",
      visibility: "public",
      createdAt: now,
      updatedAt: now,
      likesCount: 0,
      commentsCount: 0,
      savesCount: 0
    });
    return mapCommunityPost(post, currentUser, { liked: false, saved: false });
  }

  async updatePost(postId, input) {
    await this.initialize();
    const [currentUser, existingPost] = await Promise.all([
      this.requireCurrentUser(),
      this.repository.getPostById(postId)
    ]);
    if (!this.canEditPost(existingPost, currentUser)) {
      throw new CommunityError("Você só pode editar suas próprias publicações.", { code: "forbidden" });
    }
    const normalized = validatePost(input, [{
      id: existingPost.gameId, name: existingPost.gameName, slug: existingPost.gameSlug
    }]);
    const updatedTimestamp = Math.max(Date.now(), timestamp(existingPost.createdAt) + 1);
    const post = await this.repository.updatePost(postId, {
      ...normalized,
      updatedAt: new Date(updatedTimestamp).toISOString()
    }, currentUser.id);
    const interactions = await this.interactionContext(currentUser.id);
    return mapCommunityPost(post, currentUser, {
      liked: interactions.likedPostIds.has(post.id),
      saved: interactions.savedPostIds.has(post.id)
    });
  }

  async deletePost(postId) {
    await this.initialize();
    const [currentUser, post] = await Promise.all([
      this.requireCurrentUser(),
      this.repository.getPostById(postId)
    ]);
    if (!this.canDeletePost(post, currentUser)) {
      throw new CommunityError("Você só pode excluir suas próprias publicações.", { code: "forbidden" });
    }
    return this.repository.deletePost(postId, currentUser.id, new Date().toISOString());
  }

  async toggleLike(postId) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    return this.repository.toggleLike(postId, currentUser.id, {
      id: createId("like"),
      createdAt: new Date().toISOString()
    });
  }

  async toggleSaved(postId) {
    await this.initialize();
    const currentUser = await this.requireCurrentUser();
    return this.repository.toggleSaved(postId, currentUser.id, {
      id: createId("saved"),
      createdAt: new Date().toISOString()
    });
  }

  async listComments(postId) {
    await this.initialize();
    const [post, comments, users] = await Promise.all([
      this.repository.getPostById(postId),
      this.repository.listComments(postId),
      this.repository.listUsers()
    ]);
    if (!post || post.status !== "published") {
      throw new CommunityError("A publicação não está disponível.", { code: "post-not-found" });
    }
    const usersById = new Map(users.map((user) => [user.id, user]));
    const visibleComments = comments.filter((comment) => comment.origin !== "seed-summary");
    return {
      items: visibleComments
        .sort((first, second) => timestamp(first.createdAt) - timestamp(second.createdAt))
        .map((comment) => mapCommunityComment(comment, usersById.get(comment.authorId))),
      total: comments.length,
      preservedCount: comments.length - visibleComments.length
    };
  }

  async createComment(postId, input) {
    await this.initialize();
    const [currentUser, post] = await Promise.all([
      this.requireCurrentUser(),
      this.repository.getPostById(postId)
    ]);
    if (!post || post.status !== "published") {
      throw new CommunityError("A publicação não está disponível.", { code: "post-not-found" });
    }
    const normalized = validateComment(input);
    const now = new Date().toISOString();
    const comment = await this.repository.createComment({
      id: createId("comment"),
      postId,
      authorId: currentUser.id,
      parentCommentId: null,
      ...normalized,
      status: "published",
      createdAt: now,
      updatedAt: now
    });
    const updatedPost = await this.repository.getPostById(postId);
    return {
      comment: mapCommunityComment(comment, currentUser),
      commentsCount: updatedPost?.commentsCount || 0
    };
  }

  async deleteComment(commentId) {
    await this.initialize();
    const [currentUser, comment] = await Promise.all([
      this.requireCurrentUser(),
      this.repository.getCommentById(commentId)
    ]);
    if (!this.canDeleteComment(comment, currentUser)) {
      throw new CommunityError("Você só pode excluir seus próprios comentários.", { code: "forbidden" });
    }
    await this.repository.deleteComment(commentId, currentUser.id, new Date().toISOString());
    const post = await this.repository.getPostById(comment.postId);
    return { deleted: true, postId: comment.postId, commentsCount: post?.commentsCount || 0 };
  }

  async listPopularGames(limit = 5) {
    await this.initialize();
    const posts = await this.repository.listPosts();
    const games = new Map();

    posts.filter((post) => post.status === "published" && post.visibility === "public" && post.gameId !== null).forEach((post) => {
      const gameId = Number(post.gameId);
      const current = games.get(gameId) || {
        id: gameId,
        name: post.gameName,
        slug: post.gameSlug || "",
        postsCount: 0
      };
      current.postsCount += 1;
      games.set(gameId, current);
    });

    return [...games.values()]
      .sort((first, second) => second.postsCount - first.postsCount || first.name.localeCompare(second.name, "pt-BR"))
      .slice(0, limit);
  }

  async listPopularGuides(limit = 3) {
    const result = await this.listPosts({ tab: "trending", type: "guide", limit });
    return result.items;
  }

  async listPopularTags(limit = 8) {
    await this.initialize();
    const posts = await this.repository.listPosts();
    const tagCounts = new Map();

    posts.filter((post) => post.status === "published" && post.visibility === "public").forEach((post) => {
      (post.tags || []).forEach((tag) => {
        const normalizedTag = String(tag).trim().toLowerCase();
        if (normalizedTag) tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
      });
    });

    return [...tagCounts.entries()]
      .map(([tag, postsCount]) => ({ tag, postsCount }))
      .sort((first, second) => second.postsCount - first.postsCount || first.tag.localeCompare(second.tag, "pt-BR"))
      .slice(0, limit);
  }
}
