export function getQueryParam(key) {
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export function escapeHtml(value) {
  if (!value) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDate(value) {
  if (!value) return "Em breve";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export function buildYouTubeEmbed(videoId) {
  return `https://www.youtube.com/embed/${videoId}`;
}

export function createSkeleton(container, count = 4) {
  container.innerHTML = Array.from({ length: count }, () => "<div class='skeleton-card'></div>").join("");
}

export function setLoadingState(container, isLoading) {
  container.classList.toggle("is-loading", isLoading);
}
