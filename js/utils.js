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

export function debounce(callback, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };
}

export function calculateGameRelevance(game = {}) {
  const rating = Number(game.rating) || 0;
  const ratingsCount = Math.max(0, Number(game.ratings_count) || 0);
  const metacritic = Number(game.metacritic) || 0;
  const added = Math.max(0, Number(game.added) || 0);

  return (rating * 20) + (Math.log10(ratingsCount + 1) * 8) + (metacritic * 0.12) + (Math.log10(added + 1) * 3);
}

export function sortByRelevance(games = []) {
  return [...games].sort((a, b) => calculateGameRelevance(b) - calculateGameRelevance(a));
}

export function observeLazyImages() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll("img[loading='lazy']").forEach((image) => image.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  });

  document.querySelectorAll("img[loading='lazy']").forEach((image) => observer.observe(image));
}
