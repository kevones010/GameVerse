const REASONS = [
  ["spam", "Spam ou conteúdo repetitivo"],
  ["offensive", "Conteúdo ofensivo"],
  ["spoiler", "Spoiler sem aviso"],
  ["misinformation", "Informação enganosa"],
  ["other", "Outro motivo"]
];

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createReportDialog({ service, onReported, onError }) {
  const dialog = document.createElement("dialog");
  dialog.className = "report-dialog";
  dialog.setAttribute("aria-labelledby", "reportDialogTitle");

  const shell = element("div", "report-dialog-shell");
  const header = element("header", "dialog-header");
  const title = element("h2", "", "Denunciar conteúdo");
  title.id = "reportDialogTitle";
  const close = element("button", "dialog-close", "×");
  close.type = "button";
  close.setAttribute("aria-label", "Fechar denúncia");
  header.append(title, close);

  const copy = element("p", "report-copy", "A denúncia fica registrada apenas neste navegador enquanto o GameVerse não possui backend de moderação.");
  const form = document.createElement("form");
  form.className = "report-form";
  form.noValidate = true;

  const reasonLabel = element("label", "", "Motivo");
  reasonLabel.htmlFor = "reportReason";
  const reason = document.createElement("select");
  reason.id = "reportReason";
  reason.name = "reason";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecione um motivo";
  reason.appendChild(placeholder);
  REASONS.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    reason.appendChild(option);
  });
  const reasonError = element("p", "form-error");
  reasonError.dataset.fieldError = "reason";

  const detailsLabel = element("label", "", "Detalhes — opcional");
  detailsLabel.htmlFor = "reportDetails";
  const details = document.createElement("textarea");
  details.id = "reportDetails";
  details.name = "details";
  details.rows = 4;
  details.maxLength = 500;
  details.placeholder = "Explique brevemente o problema…";
  const detailsError = element("p", "form-error");
  detailsError.dataset.fieldError = "details";
  const generalError = element("p", "form-error form-error--general");
  generalError.setAttribute("aria-live", "assertive");

  const actions = element("footer", "dialog-actions");
  const cancel = element("button", "btn btn-secondary", "Cancelar");
  cancel.type = "button";
  const submit = element("button", "btn btn-primary", "Enviar denúncia");
  submit.type = "submit";
  actions.append(cancel, submit);

  form.append(reasonLabel, reason, reasonError, detailsLabel, details, detailsError, generalError, actions);
  shell.append(header, copy, form);
  dialog.appendChild(shell);
  document.body.appendChild(dialog);

  let target = null;
  let opener = null;
  let submitting = false;

  function clearErrors() {
    form.querySelectorAll("[data-field-error]").forEach((node) => { node.textContent = ""; });
    form.querySelectorAll("[aria-invalid]").forEach((node) => node.removeAttribute("aria-invalid"));
    generalError.textContent = "";
  }

  function showErrors(fieldErrors = {}) {
    clearErrors();
    for (const [field, message] of Object.entries(fieldErrors)) {
      const error = form.querySelector(`[data-field-error="${field}"]`);
      if (error) error.textContent = message;
      const input = form.elements[field];
      input?.setAttribute("aria-invalid", "true");
    }
  }

  function setSubmitting(value) {
    submitting = Boolean(value);
    [...form.elements].forEach((field) => { field.disabled = submitting; });
    close.disabled = submitting;
    submit.textContent = submitting ? "Enviando…" : "Enviar denúncia";
  }

  function closeDialog() {
    if (!submitting && dialog.open) dialog.close();
  }

  close.addEventListener("click", closeDialog);
  cancel.addEventListener("click", closeDialog);
  dialog.addEventListener("cancel", (event) => {
    if (submitting) event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    requestAnimationFrame(() => opener?.focus());
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!target || submitting) return;
    clearErrors();
    setSubmitting(true);
    try {
      await service.createReport({
        targetType: target.type,
        targetId: target.id,
        reason: reason.value,
        details: details.value
      });
      dialog.close();
      await onReported?.(target);
    } catch (error) {
      if (Object.keys(error.fieldErrors || {}).length) showErrors(error.fieldErrors);
      else {
        generalError.textContent = error.message || "Não foi possível registrar a denúncia.";
        onError?.(error);
      }
    } finally {
      setSubmitting(false);
    }
  });

  return {
    open(nextTarget, trigger = document.activeElement) {
      if (submitting) return;
      target = nextTarget;
      opener = trigger instanceof HTMLElement ? trigger : null;
      form.reset();
      clearErrors();
      title.textContent = nextTarget?.type === "user" ? "Denunciar perfil" : "Denunciar publicação";
      document.body.classList.add("modal-open");
      dialog.showModal();
      requestAnimationFrame(() => reason.focus());
    },
    close: closeDialog
  };
}
