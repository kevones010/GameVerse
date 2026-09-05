export function createSpoilerContent(spoilerLabel, renderContent) {
  const wrapper = document.createElement("section");
  wrapper.className = "spoiler-box";
  wrapper.setAttribute("aria-label", "Conteúdo protegido por spoiler");

  const icon = document.createElement("span");
  icon.className = "spoiler-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⚠";

  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = "CONTÉM SPOILERS";
  const description = document.createElement("span");
  description.textContent = spoilerLabel || "O conteúdo desta publicação pode revelar partes importantes do jogo.";
  copy.append(title, description);

  const revealButton = document.createElement("button");
  revealButton.type = "button";
  revealButton.className = "spoiler-reveal";
  revealButton.textContent = "Revelar conteúdo";
  revealButton.setAttribute("aria-expanded", "false");
  revealButton.addEventListener("click", () => {
    const revealedContent = renderContent();
    wrapper.replaceChildren(revealedContent);
    wrapper.classList.add("is-revealed");
  }, { once: true });

  wrapper.append(icon, copy, revealButton);
  return wrapper;
}
