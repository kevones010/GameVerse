export function createConfirmDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "community-dialog confirm-dialog";
  dialog.setAttribute("aria-labelledby", "confirmDialogTitle");
  dialog.setAttribute("aria-describedby", "confirmDialogDescription");

  const shell = document.createElement("div");
  shell.className = "dialog-shell";
  const title = document.createElement("h2");
  title.className = "dialog-title";
  title.id = "confirmDialogTitle";
  const description = document.createElement("p");
  description.id = "confirmDialogDescription";
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-secondary";
  cancel.textContent = "Cancelar";
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "btn btn-danger";
  confirm.textContent = "Excluir";
  actions.append(cancel, confirm);
  shell.append(title, description, actions);
  dialog.appendChild(shell);
  document.body.appendChild(dialog);

  let resolveRequest = null;
  let opener = null;

  function finish(result) {
    resolveRequest?.(result);
    resolveRequest = null;
    if (dialog.open) dialog.close();
  }

  cancel.addEventListener("click", () => finish(false));
  confirm.addEventListener("click", () => finish(true));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    finish(false);
  });
  dialog.addEventListener("close", () => opener?.focus());

  return function requestConfirmation({
    title: nextTitle,
    description: nextDescription,
    confirmLabel = "Excluir",
    trigger = document.activeElement
  }) {
    if (resolveRequest) finish(false);
    title.textContent = nextTitle;
    description.textContent = nextDescription;
    confirm.textContent = confirmLabel;
    opener = trigger instanceof HTMLElement ? trigger : null;
    dialog.showModal();
    requestAnimationFrame(() => cancel.focus());
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };
}
