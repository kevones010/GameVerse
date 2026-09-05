import { PROFILE_AVATARS } from "../../services/community/communityValidation.js";

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createProfileEditor({ service, onSaved, onError }) {
  const dialog = document.createElement("dialog");
  dialog.className = "profile-dialog";
  dialog.setAttribute("aria-labelledby", "profileEditorTitle");

  const shell = element("div", "profile-dialog-shell");
  const header = element("header", "dialog-header");
  const title = element("h2", "", "Editar perfil");
  title.id = "profileEditorTitle";
  const closeButton = element("button", "dialog-close", "×");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Fechar editor de perfil");
  header.append(title, closeButton);

  const form = document.createElement("form");
  form.className = "profile-form";
  form.noValidate = true;

  const nameGroup = element("div", "composer-field");
  const nameLabel = element("label", "", "Nome de exibição");
  nameLabel.htmlFor = "profileDisplayName";
  const nameInput = document.createElement("input");
  nameInput.id = "profileDisplayName";
  nameInput.name = "displayName";
  nameInput.maxLength = 32;
  nameInput.autocomplete = "nickname";
  const nameError = element("p", "form-error");
  nameError.dataset.fieldError = "displayName";
  nameError.setAttribute("aria-live", "polite");
  nameGroup.append(nameLabel, nameInput, nameError);

  const bioGroup = element("div", "composer-field");
  const bioLabel = element("label", "", "Bio");
  bioLabel.htmlFor = "profileBioInput";
  const bioInput = document.createElement("textarea");
  bioInput.id = "profileBioInput";
  bioInput.name = "bio";
  bioInput.rows = 4;
  bioInput.maxLength = 180;
  bioInput.placeholder = "Conte um pouco sobre os jogos que você curte…";
  const bioHint = element("p", "composer-hint", "Até 180 caracteres.");
  const bioError = element("p", "form-error");
  bioError.dataset.fieldError = "bio";
  bioError.setAttribute("aria-live", "polite");
  bioGroup.append(bioLabel, bioInput, bioHint, bioError);

  const avatarGroup = element("fieldset", "profile-avatar-fieldset");
  const avatarLegend = element("legend", "", "Avatar do Vee");
  const avatarGrid = element("div", "profile-avatar-grid");
  PROFILE_AVATARS.forEach((src, index) => {
    const label = element("label", "profile-avatar-option");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "avatar";
    radio.value = src;
    const image = document.createElement("img");
    image.src = src;
    image.alt = `Avatar ${index + 1} do Vee`;
    image.width = 64;
    image.height = 64;
    label.append(radio, image);
    avatarGrid.appendChild(label);
  });
  const avatarError = element("p", "form-error");
  avatarError.dataset.fieldError = "avatar";
  avatarError.setAttribute("aria-live", "polite");
  avatarGroup.append(avatarLegend, avatarGrid, avatarError);

  const generalError = element("p", "form-error form-error--general");
  generalError.setAttribute("aria-live", "assertive");

  const actions = element("footer", "dialog-actions");
  const cancel = element("button", "btn btn-secondary", "Cancelar");
  cancel.type = "button";
  const submit = element("button", "btn btn-primary", "Salvar perfil");
  submit.type = "submit";
  actions.append(cancel, submit);

  form.append(nameGroup, bioGroup, avatarGroup, generalError, actions);
  shell.append(header, form);
  dialog.appendChild(shell);
  document.body.appendChild(dialog);

  let opener = null;
  let currentProfile = null;
  let submitting = false;

  function clearErrors() {
    form.querySelectorAll("[data-field-error]").forEach((node) => { node.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    generalError.textContent = "";
  }

  function showErrors(fieldErrors = {}) {
    clearErrors();
    let focusTarget = null;
    for (const [field, message] of Object.entries(fieldErrors)) {
      const error = form.querySelector(`[data-field-error="${field}"]`);
      if (error) error.textContent = message;
      const input = form.elements[field];
      if (input instanceof RadioNodeList) {
        [...input].forEach((item) => item.setAttribute("aria-invalid", "true"));
        focusTarget ||= input[0];
      } else if (input) {
        input.setAttribute("aria-invalid", "true");
        focusTarget ||= input;
      }
    }
    focusTarget?.focus();
  }

  function setSubmitting(value) {
    submitting = Boolean(value);
    [...form.elements].forEach((field) => { field.disabled = submitting; });
    closeButton.disabled = submitting;
    submit.textContent = submitting ? "Salvando…" : "Salvar perfil";
  }

  function close() {
    if (!submitting && dialog.open) dialog.close();
  }

  closeButton.addEventListener("click", close);
  cancel.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => {
    if (submitting) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    requestAnimationFrame(() => opener?.focus());
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting) return;
    clearErrors();
    setSubmitting(true);
    try {
      const saved = await service.updateCurrentUserProfile({
        displayName: nameInput.value,
        bio: bioInput.value,
        avatar: form.elements.avatar.value
      });
      dialog.close();
      await onSaved?.(saved);
    } catch (error) {
      if (Object.keys(error.fieldErrors || {}).length) showErrors(error.fieldErrors);
      else {
        generalError.textContent = error.message || "Não foi possível atualizar o perfil.";
        onError?.(error);
      }
    } finally {
      setSubmitting(false);
    }
  });

  return {
    open(profile, trigger = document.activeElement) {
      if (submitting) return;
      currentProfile = profile;
      opener = trigger instanceof HTMLElement ? trigger : null;
      clearErrors();
      nameInput.value = currentProfile?.displayName || "";
      bioInput.value = currentProfile?.bio || "";
      const avatar = PROFILE_AVATARS.includes(currentProfile?.avatar) ? currentProfile.avatar : PROFILE_AVATARS[0];
      form.elements.avatar.value = avatar;
      document.body.classList.add("modal-open");
      dialog.showModal();
      requestAnimationFrame(() => nameInput.focus());
    },
    close
  };
}
