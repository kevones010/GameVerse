import { createCommunitySeed } from "../../../data/communitySeed.js";
import { CommunityRepository } from "./communityRepository.js";
import {
  assertCommunityState,
  CommunityError,
  migrateCommunityState
} from "./communityValidation.js";

export const COMMUNITY_STORAGE_KEY = "gameverse-community:v1";

// Share the queue between repositories using the same storage in this page.
// Each mutation reads fresh data; cross-tab transactions belong to the backend.
const mutationQueues = new WeakMap();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function countByPost(items, predicate = () => true) {
  const counts = new Map();
  items.filter(predicate).forEach((item) => {
    counts.set(item.postId, (counts.get(item.postId) || 0) + 1);
  });
  return counts;
}

function synchronizeCounters(state) {
  const likes = countByPost(state.likes);
  const comments = countByPost(state.comments, (comment) => comment.status === "published");
  const saves = countByPost(state.savedPosts);

  state.posts.forEach((post) => {
    post.likesCount = likes.get(post.id) || 0;
    post.commentsCount = comments.get(post.id) || 0;
    post.savesCount = saves.get(post.id) || 0;
  });

  return state;
}

function requirePublishedPost(state, postId) {
  const post = state.posts.find((item) => item.id === postId);
  if (!post || post.status !== "published") {
    throw new CommunityError("A publicação não está disponível.", { code: "post-not-found" });
  }
  return post;
}

function assertAuthor(resource, actorId, message) {
  if (resource.authorId !== actorId) {
    throw new CommunityError(message, { code: "forbidden" });
  }
}

export class LocalCommunityRepository extends CommunityRepository {
  constructor(storage = window.localStorage) {
    super();
    this.storage = storage;
  }

  async initialize() {
    const storedState = this.storage.getItem(COMMUNITY_STORAGE_KEY);
    if (storedState === null) {
      const seed = assertCommunityState(synchronizeCounters(createCommunitySeed()));
      this.storage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(seed));
      return clone(seed);
    }

    return this.readState(storedState, { persistMigration: true });
  }

  readState(serializedState = this.storage.getItem(COMMUNITY_STORAGE_KEY), { persistMigration = false } = {}) {
    try {
      const parsedState = JSON.parse(serializedState);
      const normalizedState = assertCommunityState(synchronizeCounters(migrateCommunityState(parsedState)));
      const normalizedSerialized = JSON.stringify(normalizedState);
      if (persistMigration && normalizedSerialized !== serializedState) {
        this.storage.setItem(COMMUNITY_STORAGE_KEY, normalizedSerialized);
      }
      return normalizedState;
    } catch (error) {
      if (error instanceof CommunityError) throw error;
      throw new CommunityError("Não foi possível ler os dados locais da comunidade.", { code: "storage-invalid" });
    }
  }

  writeState(state) {
    const normalizedState = assertCommunityState(synchronizeCounters(state));
    this.storage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(normalizedState));
    return normalizedState;
  }

  async mutateState(mutator) {
    const previous = mutationQueues.get(this.storage) || Promise.resolve();
    const mutation = previous.then(async () => {
      const state = await this.initialize();
      const result = mutator(state);
      this.writeState(state);
      return clone(result);
    });
    // Preserve rejection for the caller while keeping the next mutation usable.
    mutationQueues.set(this.storage, mutation.catch(() => {}));
    return mutation;
  }

  async listPosts() {
    const state = await this.initialize();
    return clone(state.posts);
  }

  async getPostById(id) {
    const posts = await this.listPosts();
    return posts.find((post) => post.id === id) || null;
  }

  async createPost(post) {
    return this.mutateState((state) => {
      if (state.posts.some((item) => item.id === post.id)) {
        throw new CommunityError("Não foi possível gerar uma identidade única para a publicação.", { code: "duplicate-id" });
      }
      if (!state.users.some((user) => user.id === post.authorId)) {
        throw new CommunityError("Usuário atual não encontrado.", { code: "user-not-found" });
      }
      state.posts.push(clone(post));
      return state.posts.at(-1);
    });
  }

  async updatePost(postId, changes, actorId) {
    return this.mutateState((state) => {
      const post = requirePublishedPost(state, postId);
      assertAuthor(post, actorId, "Você só pode editar suas próprias publicações.");
      const editableFields = [
        "type", "title", "content", "gameId", "gameName", "gameSlug",
        "tags", "media", "spoiler", "spoilerLabel", "updatedAt"
      ];
      editableFields.forEach((field) => {
        if (Object.hasOwn(changes, field)) post[field] = clone(changes[field]);
      });
      return post;
    });
  }

  async deletePost(postId, actorId, deletedAt) {
    return this.mutateState((state) => {
      const post = requirePublishedPost(state, postId);
      assertAuthor(post, actorId, "Você só pode excluir suas próprias publicações.");
      post.status = "deleted";
      post.updatedAt = deletedAt;
      return post;
    });
  }

  async listUsers() {
    const state = await this.initialize();
    return clone(state.users);
  }

  async getUserById(id) {
    const users = await this.listUsers();
    return users.find((user) => user.id === id) || null;
  }

  async updateUser(userId, changes, actorId) {
    return this.mutateState((state) => {
      if (userId !== actorId) {
        throw new CommunityError("Você só pode editar o próprio perfil.", { code: "forbidden" });
      }
      const user = state.users.find((item) => item.id === userId);
      if (!user) throw new CommunityError("Perfil não encontrado.", { code: "user-not-found" });
      ["displayName", "bio", "avatar", "updatedAt"].forEach((field) => {
        if (Object.hasOwn(changes, field)) user[field] = clone(changes[field]);
      });
      return user;
    });
  }

  async listComments(postId) {
    const state = await this.initialize();
    return clone(state.comments.filter((comment) => (
      comment.postId === postId && comment.status === "published"
    )));
  }

  async getCommentById(id) {
    const state = await this.initialize();
    return clone(state.comments.find((comment) => comment.id === id) || null);
  }

  async createComment(comment) {
    return this.mutateState((state) => {
      requirePublishedPost(state, comment.postId);
      if (state.comments.some((item) => item.id === comment.id)) {
        throw new CommunityError("Não foi possível gerar uma identidade única para o comentário.", { code: "duplicate-id" });
      }
      if (!state.users.some((user) => user.id === comment.authorId)) {
        throw new CommunityError("Usuário atual não encontrado.", { code: "user-not-found" });
      }
      state.comments.push(clone(comment));
      return state.comments.at(-1);
    });
  }

  async deleteComment(commentId, actorId, deletedAt) {
    return this.mutateState((state) => {
      const comment = state.comments.find((item) => item.id === commentId && item.status === "published");
      if (!comment) {
        throw new CommunityError("O comentário não está disponível.", { code: "comment-not-found" });
      }
      assertAuthor(comment, actorId, "Você só pode excluir seus próprios comentários.");
      comment.status = "deleted";
      comment.updatedAt = deletedAt;
      return comment;
    });
  }

  async listLikesByUser(userId) {
    const state = await this.initialize();
    return clone(state.likes.filter((like) => like.userId === userId));
  }

  async listSavedPostsByUser(userId) {
    const state = await this.initialize();
    return clone(state.savedPosts.filter((savedPost) => savedPost.userId === userId));
  }

  async toggleLike(postId, userId, interaction) {
    return this.mutateState((state) => {
      requirePublishedPost(state, postId);
      const existingIndex = state.likes.findIndex((like) => like.postId === postId && like.userId === userId);
      if (existingIndex >= 0) {
        state.likes.splice(existingIndex, 1);
        return { liked: false, postId };
      }
      state.likes.push({ ...clone(interaction), postId, userId });
      return { liked: true, postId };
    }).then(async (result) => {
      const post = await this.getPostById(postId);
      return { ...result, likesCount: post?.likesCount || 0 };
    });
  }

  async toggleSaved(postId, userId, interaction) {
    return this.mutateState((state) => {
      requirePublishedPost(state, postId);
      const existingIndex = state.savedPosts.findIndex((savedPost) => (
        savedPost.postId === postId && savedPost.userId === userId
      ));
      if (existingIndex >= 0) {
        state.savedPosts.splice(existingIndex, 1);
        return { saved: false, postId };
      }
      state.savedPosts.push({ ...clone(interaction), postId, userId });
      return { saved: true, postId };
    }).then(async (result) => {
      const post = await this.getPostById(postId);
      return { ...result, savesCount: post?.savesCount || 0 };
    });
  }

  async listFollows() {
    const state = await this.initialize();
    return clone(state.follows);
  }

  async listFollowersByUser(userId) {
    const follows = await this.listFollows();
    return follows.filter((follow) => follow.followingId === userId);
  }

  async listFollowingByUser(userId) {
    const follows = await this.listFollows();
    return follows.filter((follow) => follow.followerId === userId);
  }

  async toggleFollow(followerId, followingId, interaction) {
    return this.mutateState((state) => {
      if (followerId === followingId) {
        throw new CommunityError("Você não pode seguir o próprio perfil.", { code: "cannot-follow-self" });
      }
      if (!state.users.some((user) => user.id === followerId)) {
        throw new CommunityError("Usuário atual não encontrado.", { code: "user-not-found" });
      }
      if (!state.users.some((user) => user.id === followingId)) {
        throw new CommunityError("Perfil não encontrado.", { code: "user-not-found" });
      }
      const existingIndex = state.follows.findIndex((follow) => (
        follow.followerId === followerId && follow.followingId === followingId
      ));
      if (existingIndex >= 0) {
        state.follows.splice(existingIndex, 1);
        return { followed: false, userId: followingId };
      }
      state.follows.push({ ...clone(interaction), followerId, followingId });
      return { followed: true, userId: followingId };
    });
  }

  async listReportsByUser(userId) {
    const state = await this.initialize();
    return clone(state.reports.filter((report) => report.reporterId === userId));
  }

  async createReport(report) {
    return this.mutateState((state) => {
      if (!state.users.some((user) => user.id === report.reporterId)) {
        throw new CommunityError("Usuário atual não encontrado.", { code: "user-not-found" });
      }
      if (report.targetType === "post") {
        const post = requirePublishedPost(state, report.targetId);
        if (post.authorId === report.reporterId) {
          throw new CommunityError("Você não pode denunciar a própria publicação.", { code: "cannot-report-self" });
        }
      } else if (report.targetType === "user") {
        const target = state.users.find((user) => user.id === report.targetId);
        if (!target) throw new CommunityError("Perfil não encontrado.", { code: "user-not-found" });
        if (target.id === report.reporterId) {
          throw new CommunityError("Você não pode denunciar o próprio perfil.", { code: "cannot-report-self" });
        }
      }
      const duplicate = state.reports.some((item) => (
        item.reporterId === report.reporterId
        && item.targetType === report.targetType
        && item.targetId === report.targetId
      ));
      if (duplicate) {
        throw new CommunityError("Você já registrou uma denúncia para este conteúdo.", { code: "duplicate-report" });
      }
      state.reports.push(clone(report));
      return report;
    });
  }
}
