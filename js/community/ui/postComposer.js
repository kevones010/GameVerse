import { createGamePicker } from "./gamePicker.js";

const POST_TYPE_OPTIONS = [
  { value: "guide", label: "Guia" },
  { value: "art", label: "Arte" },
  { value: "screenshot", label: "Screenshot" },
  { value: "discussion", label: "Discussão" },
  { value: "question", label: "Pergunta" }
];

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createError(fieldName) {
  const error = createElement("p", "form-error");
  error.id = `composer-${fieldName}-error`;
  error.dataset.fieldError = fieldName;
  error.setAttribute("aria-live", "polite");
  return error;
}

function createTextField({ name, label, tag = "input", hint = "", ...attributes }) {
  const group = createElement("div", "composer-field");
  const fieldLabel = createElement("label", "composer-label", label);
  fieldLabel.htmlFor = `composer-${name}`;
  const field = document.createElement(tag);
  field.id = `composer-${name}`;
  field.name = name;
  field.setAttribute("aria-describedby", `composer-${name}-hint composer-${name}-error`);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined) field.setAttribute(key, value);
  });
  const fieldHint = createElement("span", "composer-hint", hint);
  fieldHint.id = `composer-${name}-hint`;
  group.append(fieldLabel, field, fieldHint, createError(name));
  return { group, field };
}

export function createPostComposer({ service, onSaved, onError }) {
  const dialog = createElement("dialog", "community-dialog composer-dialog");
  dialog.setAttribute("aria-labelledby", "composerTitle");

  const shell = createElement("div", "dialog-shell");
  const header = createElement("header", "dialog-header");
  const headingGroup = createElement("div");
  const eyebrow = createElement("span", "eyebrow", "Compartilhe com a comunidade");
  const title = createElement("h2", "dialog-title", "Criar publicação");
  title.id = "composerTitle";
  headingGroup.append(eyebrow, title);

  const closeButton = createElement("button", "dialog-close", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar composer");
  header.append(headingGroup, closeButton);

  const form = createElement("form", "composer-form");
  form.noValidate = true;

  const typeField = createElement("fieldset", "composer-field composer-type-field");
  const typeLegend = createElement("legend", "composer-label", "Tipo");
  const typeOptions = createElement("div", "composer-type-options");
  POST_TYPE_OPTIONS.forEach((option, index) => {
    const label = createElement("label", "composer-type-option");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "type";
    input.value = option.value;
    if (index === 0) input.checked = true;
    const text = createElement("span", "", option.label);
    label.append(input, text);
    typeOptions.appendChild(label);
  });
  typeField.setAttribute("aria-describedby", "composer-type-error");
  typeField.append(typeLegend, typeOptions, createError("type"));

  const titleField = createTextField({
    name: "title",
    label: "Título",
    maxlength: "120",
    autocomplete: "off",
    hint: "Entre 4 e 120 caracteres."
  });
  const contentField = createTextField({
    name: "content",
    label: "Conteúdo",
    tag: "textarea",
    rows: "7",
    maxlength: "5000",
    hint: "Texto simples, até 5000 caracteres."
  });
  const gameField = createGamePicker();
  const tagsField = createTextField({
    name: "tags",
    label: "Tags",
    maxlength: "180",
    autocomplete: "off",
    placeholder: "persona5, guia, confidants",
    hint: "Separe por vírgulas. No máximo 5 tags."
  });
  const mediaField = createTextField({
    name: "mediaUrl",
    label: "URL da imagem — opcional",
    inputmode: "url",
    autocomplete: "url",
    placeholder: "https://exemplo.com/imagem.jpg",
    hint: "Somente URL HTTPS. Não há upload de arquivos nesta fase."
  });

  const spoilerGroup = createElement("div", "composer-field");
  const spoilerLabel = createElement("label", "composer-check");
  const spoilerInput = document.createElement("input");
  spoilerInput.type = "checkbox";
  spoilerInput.name = "spoiler";
  const spoilerText = createElement("span", "", "Contém spoilers");
  spoilerLabel.append(spoilerInput, spoilerText);
  const spoilerDetail = createTextField({
    name: "spoilerLabel",
    label: "Rótulo do spoiler — opcional",
    maxlength: "120",
    autocomplete: "off",
    placeholder: "Ex.: Final do jogo",
    hint: "Ajude outras pessoas a entenderem o que será revelado."
  });
  spoilerDetail.group.classList.add("composer-spoiler-detail");
  spoilerDetail.group.hidden = true;
  spoilerGroup.append(spoilerLabel, spoilerDetail.group);

  const actions = createElement("footer", "dialog-actions");
  const cancelButton = createElement("button", "btn btn-secondary", "Cancelar");
  cancelButton.type = "button";
  const submitButton = createElement("button", "btn btn-primary", "Publicar");
  submitButton.type = "submit";
  actions.append(cancelButton, submitButton);

  const generalError = createElement("p", "form-error form-error--general");
  generalError.setAttribute("aria-live", "assertive");
  const fields = createElement("div", "composer-fields");
  fields.append(
    typeField,
    titleField.group,
    contentField.group,
    gameField.group,
    tagsField.group,
    mediaField.group,
    spoilerGroup,
    generalError
  );
  form.append(fields, actions);
  shell.append(header, form);
  dialog.appendChild(shell);
  document.body.appendChild(dialog);

  let mode = "create";
  let editingPost = null;
  let opener = null;
  let isSubmitting = false;

  function clearErrors() {
    form.querySelectorAll("[data-field-error]").forEach((error) => {
      error.textContent = "";
      const field = form.elements[error.dataset.fieldError];
      if (field instanceof RadioNodeList) {
        [...field].forEach((input) => input.removeAttribute("aria-invalid"));
      } else if (field) {
        field.removeAttribute("aria-invalid");
      }
    });
    generalError.textContent = "";
  }

  function showErrors(fieldErrors = {}) {
    clearErrors();
    let firstField = null;
    Object.entries(fieldErrors).forEach(([fieldName, message]) => {
      const error = form.querySelector(`[data-field-error="${fieldName}"]`);
      const field = form.elements[fieldName];
      if (error) error.textContent = message;
      if (field instanceof RadioNodeList) {
        [...field].forEach((input) => input.setAttribute("aria-invalid", "true"));
        firstField ||= field[0];
      } else if (field) {
        field.setAttribute("aria-invalid", "true");
        firstField ||= field;
      }
    });
    firstField?.focus();
  }

  function setSubmitting(submitting) {
    isSubmitting = Boolean(submitting);
    [...form.elements].forEach((element) => {
      element.disabled = isSubmitting;
    });
    closeButton.disabled = isSubmitting;
    gameField.setDisabled(isSubmitting);
    submitButton.textContent = isSubmitting
      ? (mode === "edit" ? "Salvando…" : "Publicando…")
      : (mode === "edit" ? "Salvar alterações" : "Publicar");
  }

  function resetForm() {
    form.reset();
    form.elements.type.value = "guide";
    spoilerDetail.group.hidden = true;
    clearErrors();
  }

  function close() {
    gameField.close();
    if (dialog.open) dialog.close();
  }

  async function open(post = null, trigger = document.activeElement, game = null) {
    if (isSubmitting) return;
    mode = post ? "edit" : "create";
    editingPost = post;
    opener = trigger instanceof HTMLElement ? trigger : null;
    resetForm();
    title.textContent = post ? "Editar publicação" : "Criar publicação";
    submitButton.textContent = post ? "Salvar alterações" : "Publicar";
    gameField.open(post ? post.game : game);

    if (post) {
      form.elements.type.value = post.type;
      titleField.field.value = post.title;
      contentField.field.value = post.content;
      tagsField.field.value = post.tags.join(", ");
      mediaField.field.value = post.media?.[0]?.url || "";
      spoilerInput.checked = post.spoiler;
      spoilerDetail.field.value = post.spoilerLabel || "";
      spoilerDetail.group.hidden = !post.spoiler;
    }

    document.body.classList.add("modal-open");
    dialog.showModal();
    requestAnimationFrame(() => titleField.field.focus());
  }

  spoilerInput.addEventListener("change", () => {
    spoilerDetail.group.hidden = !spoilerInput.checked;
    if (!spoilerInput.checked) spoilerDetail.field.value = "";
  });

  closeButton.addEventListener("click", close);
  cancelButton.addEventListener("click", close);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
  dialog.addEventListener("close", () => {
    // A queued close event can arrive after the same dialog has reopened.
    if (dialog.open) return;
    gameField.close();
    document.body.classList.remove("modal-open");
    requestAnimationFrame(() => {
      if (!dialog.open) opener?.focus();
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    clearErrors();
    const input = {
      type: form.elements.type.value,
      title: titleField.field.value,
      content: contentField.field.value,
      ...gameField.getValue(),
      tags: tagsField.field.value,
      mediaUrl: mediaField.field.value,
      spoiler: spoilerInput.checked,
      spoilerLabel: spoilerDetail.field.value
    };

    setSubmitting(true);
    try {
      const savedPost = mode === "edit"
        ? await service.updatePost(editingPost.id, input)
        : await service.createPost(input);
      const savedMode = mode;
      close();
      resetForm();
      await onSaved(savedPost, savedMode);
    } catch (error) {
      if (Object.keys(error.fieldErrors || {}).length) {
        showErrors(error.fieldErrors);
      } else {
        generalError.textContent = error.message || "Não foi possível salvar a publicação.";
        onError?.(error);
      }
    } finally {
      setSubmitting(false);
    }
  });

  return {
    openCreate(trigger, game = null) {
      return open(null, trigger, game);
    },
    openEdit(post, trigger) {
      return open(post, trigger);
    },
    close
  };
}
