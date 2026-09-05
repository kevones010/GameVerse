import { createCommunitySeed } from "../../../data/communitySeed.js";
import { CommunityRepository } from "./communityRepository.js";
import { assertCommunityState } from "./communityValidation.js";

export const COMMUNITY_STORAGE_KEY = "gameverse-community:v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class LocalCommunityRepository extends CommunityRepository {
  constructor(storage = window.localStorage) {
    super();
    this.storage = storage;
  }

  async initialize() {
    const storedState = this.storage.getItem(COMMUNITY_STORAGE_KEY);
    if (storedState === null) {
      const seed = createCommunitySeed();
      this.storage.setItem(COMMUNITY_STORAGE_KEY, JSON.stringify(seed));
      return clone(seed);
    }

    return this.readState(storedState);
  }

  readState(serializedState = this.storage.getItem(COMMUNITY_STORAGE_KEY)) {
    try {
      return assertCommunityState(JSON.parse(serializedState));
    } catch (error) {
      throw new Error("Não foi possível ler os dados locais da comunidade.");
    }
  }

  async listPosts() {
    const state = await this.initialize();
    return clone(state.posts);
  }

  async getPostById(id) {
    const posts = await this.listPosts();
    return posts.find((post) => post.id === id) || null;
  }

  async listUsers() {
    const state = await this.initialize();
    return clone(state.users);
  }

  async getUserById(id) {
    const users = await this.listUsers();
    return users.find((user) => user.id === id) || null;
  }
}
