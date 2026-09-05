const NOT_IMPLEMENTED = (method) => new Error(`CommunityRepository.${method}() não implementado.`);

export class CommunityRepository {
  async initialize() { throw NOT_IMPLEMENTED("initialize"); }
  async listPosts() { throw NOT_IMPLEMENTED("listPosts"); }
  async getPostById() { throw NOT_IMPLEMENTED("getPostById"); }
  async createPost() { throw NOT_IMPLEMENTED("createPost"); }
  async updatePost() { throw NOT_IMPLEMENTED("updatePost"); }
  async deletePost() { throw NOT_IMPLEMENTED("deletePost"); }
  async listUsers() { throw NOT_IMPLEMENTED("listUsers"); }
  async getUserById() { throw NOT_IMPLEMENTED("getUserById"); }
  async updateUser() { throw NOT_IMPLEMENTED("updateUser"); }
  async listComments() { throw NOT_IMPLEMENTED("listComments"); }
  async getCommentById() { throw NOT_IMPLEMENTED("getCommentById"); }
  async createComment() { throw NOT_IMPLEMENTED("createComment"); }
  async deleteComment() { throw NOT_IMPLEMENTED("deleteComment"); }
  async listLikesByUser() { throw NOT_IMPLEMENTED("listLikesByUser"); }
  async listSavedPostsByUser() { throw NOT_IMPLEMENTED("listSavedPostsByUser"); }
  async toggleLike() { throw NOT_IMPLEMENTED("toggleLike"); }
  async toggleSaved() { throw NOT_IMPLEMENTED("toggleSaved"); }
  async listFollows() { throw NOT_IMPLEMENTED("listFollows"); }
  async listFollowersByUser() { throw NOT_IMPLEMENTED("listFollowersByUser"); }
  async listFollowingByUser() { throw NOT_IMPLEMENTED("listFollowingByUser"); }
  async toggleFollow() { throw NOT_IMPLEMENTED("toggleFollow"); }
  async listReportsByUser() { throw NOT_IMPLEMENTED("listReportsByUser"); }
  async createReport() { throw NOT_IMPLEMENTED("createReport"); }
}
