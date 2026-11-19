// Nomes dos tipos de publicação em um lugar só (antes cada tela tinha sua própria cópia).
export const POST_TYPE_LABELS = Object.freeze({
  guide: "Guia",
  art: "Arte",
  screenshot: "Screenshot",
  discussion: "Discussão",
  question: "Pergunta",
  review: "Análise"
});

export const POST_TYPE_PLURALS = Object.freeze({
  guide: "Guias",
  art: "Artes",
  screenshot: "Screenshots",
  discussion: "Discussões",
  question: "Perguntas",
  review: "Análises"
});

// Reações além da curtida.
export const REACTION_EMOJIS = Object.freeze({
  fire: { emoji: "🔥", label: "Incrível" },
  laugh: { emoji: "😂", label: "Engraçado" },
  wow: { emoji: "😮", label: "Surpreendente" }
});
