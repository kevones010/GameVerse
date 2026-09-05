const DEMO_USER_ID = "user-veemaster";

export class CommunitySession {
  constructor(repository) {
    this.repository = repository;
  }

  async getCurrentUser() {
    return this.repository.getUserById(DEMO_USER_ID);
  }
}
