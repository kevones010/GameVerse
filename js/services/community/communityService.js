import { mapCommunityPost, mapCommunityUser } from "./communityMappers.js";
import { normalizeListOptions, POST_TYPES } from "./communityValidation.js";

const HOUR = 60 * 60 * 1000;

function timestamp(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
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

function forYouScore(post, now = Date.now()) {
  return (trendingScore(post, now) * 0.55) + (recencyPoints(post, now) * 4);
}

function sortPosts(posts, tab) {
  const now = Date.now();
  return [...posts].sort((first, second) => {
    if (tab === "recent") return timestamp(second.createdAt) - timestamp(first.createdAt);
    const firstScore = tab === "trending" ? trendingScore(first, now) : forYouScore(first, now);
    const secondScore = tab === "trending" ? trendingScore(second, now) : forYouScore(second, now);
    return secondScore - firstScore || timestamp(second.createdAt) - timestamp(first.createdAt);
  });
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

  async listPosts(options = {}) {
    await this.initialize();
    const normalized = normalizeListOptions(options);
    const [posts, users] = await Promise.all([
      this.repository.listPosts(),
      this.repository.listUsers()
    ]);
    const usersById = new Map(users.map((user) => [user.id, user]));
    const visiblePosts = posts.filter((post) => (
      post.status === "published"
      && post.visibility === "public"
      && (normalized.type === "all" || post.type === normalized.type)
    ));
    const orderedPosts = sortPosts(visiblePosts, normalized.tab);
    const end = normalized.cursor + normalized.limit;

    return {
      items: orderedPosts
        .slice(normalized.cursor, end)
        .map((post) => mapCommunityPost(post, usersById.get(post.authorId))),
      nextCursor: end < orderedPosts.length ? String(end) : null,
      total: orderedPosts.length
    };
  }

  async getPostById(id) {
    await this.initialize();
    const post = await this.repository.getPostById(id);
    if (!post || post.status !== "published" || post.visibility !== "public") return null;
    const author = await this.repository.getUserById(post.authorId);
    return mapCommunityPost(post, author);
  }

  async listTrendingPosts(options = {}) {
    return this.listPosts({ ...options, tab: "trending" });
  }

  async listRecentPosts(options = {}) {
    return this.listPosts({ ...options, tab: "recent" });
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
    return mapCommunityUser(await this.session.getCurrentUser());
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
