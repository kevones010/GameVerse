import { CommunityService } from "../../services/community/communityService.js";
import { CommunitySession } from "../../services/community/communitySession.js";
import { LocalCommunityRepository } from "../../services/community/localCommunityRepository.js";
import { normalizeGameId } from "../../services/community/communityValidation.js";

const TYPE_LABELS = { guide: "Guia", art: "Arte", screenshot: "Screenshot", discussion: "Discussão", question: "Pergunta" };

export async function renderGameCommunityPreview(section, gameId) {
  const id = normalizeGameId(gameId);
  if (id === null) throw new Error("Jogo inválido.");
  const repository = new LocalCommunityRepository();
  const service = new CommunityService(repository, new CommunitySession(repository));
  // Same ordering as the Hub, paginated by the service before rendering.
  const result = await service.listPostsByGame(id, { tab: "trending", limit: 3 });
  const container = section.querySelector("#gameCommunityPosts");
  section.querySelector("#gameCommunityCount").textContent = `${result.total} ${result.total === 1 ? "publicação" : "publicações"}`;
  const href = `comunidade-jogo.html?gameId=${id}`;
  const fragment = document.createDocumentFragment();
  if (!result.items.length) {
    const empty = document.createElement("p");
    empty.textContent = "Ninguém publicou sobre este jogo ainda.";
    const create = document.createElement("a");
    create.className = "btn btn-secondary";
    create.href = href;
    create.textContent = "Criar primeira publicação";
    fragment.append(empty, create);
  } else {
    const list = document.createElement("ul");
    list.className = "game-community-list";
    result.items.forEach((post) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = href;
      const type = document.createElement("span");
      type.textContent = TYPE_LABELS[post.type] || "Publicação";
      const title = document.createElement("strong");
      // Spoiler titles are protected here too; revealing happens in the Hub.
      title.textContent = post.spoiler ? "Publicação com spoiler · veja no hub" : post.title;
      link.append(type, title);
      item.appendChild(link);
      list.appendChild(item);
    });
    fragment.appendChild(list);
  }
  container.replaceChildren(fragment);
  container.removeAttribute("aria-busy");
}
