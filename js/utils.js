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
  // "2017-02-24" sozinho vira meia-noite UTC, que no Brasil ainda é o dia anterior.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
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

// Nomes dos gêneros da RAWG em português (para os cards).
const GENRE_PT = {
  'Action': 'Ação', 'Adventure': 'Aventura', 'RPG': 'RPG', 'Indie': 'Indie', 'Strategy': 'Estratégia',
  'Shooter': 'Tiro', 'Casual': 'Casual', 'Simulation': 'Simulação', 'Puzzle': 'Puzzle', 'Arcade': 'Arcade',
  'Platformer': 'Plataforma', 'Racing': 'Corrida', 'Massively Multiplayer': 'MMO', 'Sports': 'Esportes',
  'Fighting': 'Luta', 'Family': 'Família', 'Board Games': 'Tabuleiro', 'Educational': 'Educativo', 'Card': 'Cartas'
};

export function genreLabel(name) {
  return GENRE_PT[name] || name;
}

export function genreLine(game, max = 2) {
  return (game?.genres || []).map((genre) => genreLabel(genre?.name)).filter(Boolean).slice(0, max).join(' · ');
}
