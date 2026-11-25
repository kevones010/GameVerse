import { CommunityError } from "./communityValidation.js";

const DEMO_USER_ID = "user-veemaster";

// Quem não entrou na conta vê a comunidade, mas não publica/curte/comenta.
export const GUEST_USER = Object.freeze({
  id: "guest",
  handle: "visitante",
  displayName: "Visitante",
  bio: "",
  avatar: "assets/vee/avatars/vee-avatar-default.webp",
  isGuest: true
});

export class CommunitySession {
  // Sem "accounts" (testes antigos), usa sempre o perfil de demonstração VeeMaster.
  constructor(repository, accounts = null) {
    this.repository = repository;
    this.accounts = accounts;
  }

  async getCurrentUser() {
    if (!this.accounts) return this.repository.getUserById(DEMO_USER_ID);
    const account = this.accounts.currentAccount();
    if (!account) return { ...GUEST_USER };

    const existing = await this.repository.getUserById(account.communityUserId);
    if (existing) return existing;
    // Primeira vez desta conta na comunidade: cria o perfil público dela.
    const base = {
      id: account.communityUserId,
      displayName: account.displayName,
      bio: "",
      avatar: "assets/vee/avatars/vee-avatar-default.webp",
      createdAt: account.createdAt || new Date().toISOString()
    };
    // Se o @ já existir (conta antiga excluída com o mesmo nome), usa uma variação.
    for (const handle of [account.username, `${account.username}_${account.communityUserId.slice(-4)}`]) {
      try {
        return await this.repository.createUser({ ...base, handle });
      } catch (error) {
        if (error?.code === "user-exists") return this.repository.getUserById(account.communityUserId);
        if (error?.code !== "handle-taken") throw error;
      }
    }
    throw new CommunityError("Não foi possível criar seu perfil na comunidade.", { code: "user-not-found" });
  }
}
