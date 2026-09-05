const NOT_IMPLEMENTED_MESSAGE = "Operação social disponível em uma fase futura.";

export class CommunityRepository {
  async initialize() {
    throw new Error("CommunityRepository.initialize() não implementado.");
  }

  async listPosts() {
    throw new Error("CommunityRepository.listPosts() não implementado.");
  }

  async getPostById() {
    throw new Error("CommunityRepository.getPostById() não implementado.");
  }

  async listUsers() {
    throw new Error("CommunityRepository.listUsers() não implementado.");
  }

  async getUserById() {
    throw new Error("CommunityRepository.getUserById() não implementado.");
  }

  async createPost() { throw new Error(NOT_IMPLEMENTED_MESSAGE); }
  async updatePost() { throw new Error(NOT_IMPLEMENTED_MESSAGE); }
  async deletePost() { throw new Error(NOT_IMPLEMENTED_MESSAGE); }
  async createComment() { throw new Error(NOT_IMPLEMENTED_MESSAGE); }
  async toggleLike() { throw new Error(NOT_IMPLEMENTED_MESSAGE); }
  async toggleSaved() { throw new Error(NOT_IMPLEMENTED_MESSAGE); }
  async followUser() { throw new Error(NOT_IMPLEMENTED_MESSAGE); }
}
