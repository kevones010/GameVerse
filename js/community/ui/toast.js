export function createToastRegion() {
  const region = document.createElement("div");
  region.className = "toast-region";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("aria-atomic", "true");
  document.body.appendChild(region);

  let timeoutId = null;

  return function showToast(message, variant = "success") {
    window.clearTimeout(timeoutId);
    const toast = document.createElement("div");
    toast.className = `community-toast community-toast--${variant}`;
    toast.textContent = message;
    region.replaceChildren(toast);
    requestAnimationFrame(() => toast.classList.add("is-visible"));
    timeoutId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 180);
    }, 3200);
  };
}
