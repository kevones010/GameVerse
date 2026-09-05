import { createSpoilerContent } from "./spoilerContent.js";

function safeAvatarUrl(value) {
  const url = String(value || "").trim();
  return /^(https:\/\/|assets\/)/i.test(url)
    ? url
    : "assets/vee/avatars/vee-avatar-default.webp";
}

function formatCommentTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "agora";
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

function countLabel(count) {
  return `${count} ${count === 1 ? "comentário" : "comentários"}`;
}

export function createCommentsSection({
  postId,
  initialCount,
  currentUser,
  service,
  confirmDelete,
  notify,
  onCountChange
}) {
  const safePostId = String(postId).replace(/[^a-z0-9_-]/gi, "-");
  const panelId = `comments-${safePostId}`;
  let count = initialCount;
  let loaded = false;
  let loading = false;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "post-stat post-comments-toggle";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", panelId);

  const panel = document.createElement("section");
  panel.className = "comments-panel";
  panel.id = panelId;
  panel.hidden = true;
  panel.setAttribute("aria-label", "Comentários da publicação");

  function updateToggle(nextCount = count) {
    count = Math.max(0, Number(nextCount) || 0);
    toggle.textContent = `💬 ${countLabel(count)}`;
    toggle.setAttribute("aria-label", `${countLabel(count)}. Abrir ou recolher comentários.`);
    onCountChange?.(count);
  }

  function createCommentItem(comment) {
    const item = document.createElement("article");
    item.className = "comment-item";
    item.dataset.commentId = comment.id;

    const avatar = document.createElement("img");
    avatar.className = "comment-avatar";
    avatar.src = safeAvatarUrl(comment.author.avatar);
    avatar.alt = "";
    avatar.width = 34;
    avatar.height = 34;

    const body = document.createElement("div");
    body.className = "comment-body";
    const header = document.createElement("header");
    header.className = "comment-header";
    const author = document.createElement("strong");
    author.textContent = comment.author.displayName;
    const handle = document.createElement("span");
    handle.textContent = `@${comment.author.handle}`;
    const time = document.createElement("time");
    time.dateTime = comment.createdAt;
    time.textContent = formatCommentTime(comment.createdAt);
    header.append(author, handle, time);

    const renderContent = () => {
      const content = document.createElement("p");
      content.className = "comment-content";
      content.textContent = comment.content;
      return content;
    };
    const content = comment.spoiler
      ? createSpoilerContent("", renderContent, {
        ariaLabel: "Comentário protegido por spoiler",
        title: "COMENTÁRIO CONTÉM SPOILER",
        description: "Este comentário pode revelar partes importantes do jogo.",
        buttonLabel: "Revelar comentário"
      })
      : renderContent();

    body.append(header, content);

    if (service.canDeleteComment(comment, currentUser)) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "comment-delete";
      deleteButton.textContent = "Excluir";
      deleteButton.addEventListener("click", async () => {
        const confirmed = await confirmDelete({
          title: "Excluir este comentário?",
          description: "O comentário será removido da sua comunidade local.",
          trigger: deleteButton
        });
        if (!confirmed) return;
        deleteButton.disabled = true;
        try {
          const result = await service.deleteComment(comment.id);
          updateToggle(result.commentsCount);
          notify("Comentário excluído.");
          await renderComments();
        } catch (error) {
          deleteButton.disabled = false;
          notify(error.message || "Não foi possível excluir o comentário.", "error");
        }
      });
      body.appendChild(deleteButton);
    }

    item.append(avatar, body);
    return item;
  }

  function createCommentForm() {
    const form = document.createElement("form");
    form.className = "comment-form";
    form.noValidate = true;
    const avatar = document.createElement("img");
    avatar.className = "comment-avatar";
    avatar.src = safeAvatarUrl(currentUser.avatar);
    avatar.alt = "";
    avatar.width = 34;
    avatar.height = 34;

    const fields = document.createElement("div");
    fields.className = "comment-form-fields";
    const label = document.createElement("label");
    label.className = "sr-only";
    label.htmlFor = `comment-input-${safePostId}`;
    label.textContent = "Escreva um comentário";
    const textarea = document.createElement("textarea");
    textarea.id = `comment-input-${safePostId}`;
    textarea.name = "content";
    textarea.rows = 3;
    textarea.maxLength = 1000;
    textarea.placeholder = "Participe da conversa…";
    textarea.setAttribute("aria-describedby", `comment-error-${safePostId}`);
    const error = document.createElement("p");
    error.id = `comment-error-${safePostId}`;
    error.className = "form-error";
    error.setAttribute("aria-live", "polite");

    const footer = document.createElement("div");
    footer.className = "comment-form-actions";
    const spoilerLabel = document.createElement("label");
    spoilerLabel.className = "composer-check";
    const spoiler = document.createElement("input");
    spoiler.type = "checkbox";
    spoiler.name = "spoiler";
    const spoilerText = document.createElement("span");
    spoilerText.textContent = "Contém spoiler";
    spoilerLabel.append(spoiler, spoilerText);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "btn btn-primary btn-small";
    submit.textContent = "Comentar";
    footer.append(spoilerLabel, submit);
    fields.append(label, textarea, error, footer);
    form.append(avatar, fields);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.textContent = "";
      textarea.removeAttribute("aria-invalid");
      submit.disabled = true;
      submit.textContent = "Publicando…";
      try {
        const result = await service.createComment(postId, {
          content: textarea.value,
          spoiler: spoiler.checked
        });
        textarea.value = "";
        spoiler.checked = false;
        updateToggle(result.commentsCount);
        notify("Comentário publicado.");
        await renderComments();
      } catch (actionError) {
        const message = actionError.fieldErrors?.content
          || actionError.message
          || "Não foi possível publicar o comentário.";
        error.textContent = message;
        textarea.setAttribute("aria-invalid", "true");
        textarea.focus();
      } finally {
        submit.disabled = false;
        submit.textContent = "Comentar";
      }
    });

    return form;
  }

  async function renderComments() {
    if (loading) return;
    loading = true;
    panel.setAttribute("aria-busy", "true");
    const loadingMessage = document.createElement("p");
    loadingMessage.className = "comments-status";
    loadingMessage.textContent = "Carregando comentários…";
    panel.replaceChildren(loadingMessage);

    try {
      const result = await service.listComments(postId);
      updateToggle(result.total);
      const fragment = document.createDocumentFragment();

      if (result.preservedCount > 0) {
        const preserved = document.createElement("p");
        preserved.className = "comments-preserved";
        preserved.textContent = `${countLabel(result.preservedCount)} da fase demonstrativa foram preservados sem texto público.`;
        fragment.appendChild(preserved);
      }

      const list = document.createElement("div");
      list.className = "comments-list";
      if (result.items.length) {
        result.items.forEach((comment) => list.appendChild(createCommentItem(comment)));
      } else if (!result.preservedCount) {
        const empty = document.createElement("p");
        empty.className = "comments-empty";
        empty.textContent = "Nenhum comentário ainda. Seja o primeiro a participar.";
        list.appendChild(empty);
      }
      fragment.append(list, createCommentForm());
      panel.replaceChildren(fragment);
      loaded = true;
    } catch (error) {
      const status = document.createElement("p");
      status.className = "comments-status comments-status--error";
      status.textContent = error.message || "Não foi possível carregar os comentários.";
      panel.replaceChildren(status);
    } finally {
      loading = false;
      panel.removeAttribute("aria-busy");
    }
  }

  toggle.addEventListener("click", async () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    toggle.setAttribute("aria-expanded", String(opening));
    if (opening && !loaded) await renderComments();
  });

  updateToggle(initialCount);
  return { button: toggle, panel, updateCount: updateToggle };
}
