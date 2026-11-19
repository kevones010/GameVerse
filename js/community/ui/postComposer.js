import { createGamePicker } from "./gamePicker.js";
import { POST_TYPE_LABELS } from "../../services/community/postTypes.js";

const POST_TYPE_OPTIONS = Object.entries(POST_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const POLL_SLOTS = 4;

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

  // Nota da análise (só aparece no tipo "Análise").
  const ratingGroup = createElement("div", "composer-field composer-rating");
  const ratingLabel = createElement("label", "composer-label", "Sua nota");
  ratingLabel.htmlFor = "composer-rating";
  const ratingSelect = document.createElement("select");
  ratingSelect.id = "composer-rating";
  ratingSelect.name = "rating";
  ratingSelect.setAttribute("aria-describedby", "composer-rating-error");
  [["", "Sem nota"], ["5", "★★★★★ 5"], ["4", "★★★★ 4"], ["3", "★★★ 3"], ["2", "★★ 2"], ["1", "★ 1"]].forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    ratingSelect.append(option);
  });
  ratingGroup.append(ratingLabel, ratingSelect, createError("rating"));
  ratingGroup.hidden = true;

  // Enquete (só aparece no tipo "Pergunta").
  const pollGroup = createElement("fieldset", "composer-field composer-poll");
  const pollLegend = createElement("legend", "composer-label", "Enquete — opcional");
  const pollHint = createElement("span", "composer-hint", "Preencha de 2 a 4 opções para a pergunta virar uma votação.");
  pollHint.id = "composer-poll-hint";
  const pollInputs = Array.from({ length: POLL_SLOTS }, (_, index) => {
    const input = document.createElement("input");
    input.type = "text";
    input.name = `pollOption${index}`;
    input.maxLength = 60;
    input.autocomplete = "off";
    input.placeholder = `Opção ${index + 1}`;
    input.setAttribute("aria-label", `Opção ${index + 1} da enquete`);
    input.setAttribute("aria-describedby", "composer-poll-hint composer-pollOptions-error");
    return input;
  });
  const pollList = createElement("div", "composer-poll-options");
  pollList.append(...pollInputs);
  pollGroup.append(pollLegend, pollHint, pollList, createError("pollOptions"));
  pollGroup.hidden = true;

  const syncTypeFields = () => {
    const type = form.elements.type.value;
    ratingGroup.hidden = type !== "review";
    pollGroup.hidden = type !== "question";
  };
  typeOptions.addEventListener("change", syncTypeFields);
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
    ratingGroup,
    pollGroup,
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
    syncTypeFields();
    clearErrors();
  }

  function close() {
    gameField.close();
    if (dialog.open) dialog.close();
  }

  async function open(post = null, trigger = document.activeElement, game = null, preset = null) {
    if (isSubmitting) return;
    mode = post ? "edit" : "create";
    editingPost = post;
    opener = trigger instanceof HTMLElement ? trigger : null;
    resetForm();
    title.textContent = post ? "Editar publicação" : "Criar publicação";
    submitButton.textContent = post ? "Salvar alterações" : "Publicar";
    gameField.open(post ? post.game : game);

    // Texto já preenchido (ex.: análise vinda da página do jogo).
    if (!post && preset) {
      form.elements.type.value = preset.type || "guide";
      titleField.field.value = preset.title || "";
      contentField.field.value = preset.content || "";
      tagsField.field.value = (preset.tags || []).join(", ");
      ratingSelect.value = preset.rating ? String(preset.rating) : "";
      syncTypeFields();
    }

    if (post) {
      form.elements.type.value = post.type;
      titleField.field.value = post.title;
      contentField.field.value = post.content;
      tagsField.field.value = post.tags.join(", ");
      mediaField.field.value = post.media?.[0]?.url || "";
      spoilerInput.checked = post.spoiler;
      spoilerDetail.field.value = post.spoilerLabel || "";
      spoilerDetail.group.hidden = !post.spoiler;
      ratingSelect.value = post.rating ? String(post.rating) : "";
      pollInputs.forEach((input, index) => { input.value = post.poll?.options?.[index]?.label || ""; });
      syncTypeFields();
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
      spoilerLabel: spoilerDetail.field.value,
      rating: ratingSelect.value,
      pollOptions: pollInputs.map((input) => input.value)
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
    openCreate(trigger, game = null, preset = null) {
      return open(null, trigger, game, preset);
    },
    openEdit(post, trigger) {
      return open(post, trigger);
    },
    close
  };
}
